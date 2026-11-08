import { browserProfileManager, BrowserProfileManager } from './browserProfileManager.js';
import { pool } from '../database/db.js';
import { config } from '../config/index.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { Page } from 'playwright';
import path from 'path';

// Cancellation token tracking per job
const cancelledJobs = new Set<number>();

export function requestJobCancellation(jobId: number): void {
  cancelledJobs.add(jobId);
}

export function cancelJob(jobId: number): boolean {
  cancelledJobs.add(jobId);
  return true;
}

export function isJobCancellationRequested(jobId: number): boolean {
  return cancelledJobs.has(jobId);
}

export function clearJobCancellation(jobId: number): void {
  cancelledJobs.delete(jobId);
}

export class BrowserWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 10000; // Check every 10 seconds
  private stuckThresholdMs = 120 * 1000; // Consider job stuck if not updated for 120 seconds
  private profileManager: BrowserProfileManager;
  // Track the currently processing job for external cancellation
  private currentJobId: number | null = null;
  private currentAccountId: number | null = null;

  constructor() {
    this.profileManager = browserProfileManager;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[BrowserWorker] Started real browser automation worker loop (Simulation mode removed).');
    this.timer = setInterval(async () => {
      await this.processNextJob();
    }, this.intervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    if (this.timer) clearInterval(this.timer);
    this.isRunning = false;
    console.log('[BrowserWorker] Stopped browser automation worker loop.');
  }

  private async resetStuckJobs() {
    const connection = await pool.getConnection();
    try {
      const now = new Date();
      const stuckTime = new Date(now.getTime() - this.stuckThresholdMs);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE video_jobs 
         SET status = 'queued', progress = 0, updated_at = NOW() 
         WHERE status IN ('preparing', 'running', 'downloading', 'awaiting_user') 
         AND updated_at < ?`,
        [stuckTime]
      );
      const affected = result.affectedRows;
      if (affected > 0) {
        console.log(`[BrowserWorker] Reset ${affected} stuck job(s) to queued.`);
        await connection.execute(
          `INSERT INTO job_logs (job_id, account_id, level, event, message) 
           SELECT id, account_id, 'info', 'job_reset', CONCAT('Job reset due to stuck in status: ', status) 
           FROM video_jobs 
           WHERE status IN ('preparing', 'running', 'downloading', 'awaiting_user') 
           AND updated_at < ?`,
          [stuckTime]
        );
      }
    } catch (err) {
      console.error('[BrowserWorker] Error resetting stuck jobs:', err);
    } finally {
      connection.release();
    }
  }

  private async processNextJob() {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Find one queued job and claim it atomically (MariaDB compatible — no SKIP LOCKED)
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, prompt, reference_image_path, account_id, aspect_ratio 
         FROM video_jobs 
         WHERE status = 'queued' 
         ORDER BY created_at ASC 
         LIMIT 1`
      );
      if (rows.length === 0) {
        await connection.commit();
        return;
      }
      const job = rows[0];
      const jobId = job.id;
      let accountId = job.account_id;

      // Claim the job: only proceed if status is still 'queued' (prevents double-claim)
      const [claimResult] = await connection.execute<ResultSetHeader>(
        `UPDATE video_jobs SET status = 'preparing', progress = 15, started_at = NOW(), updated_at = NOW() 
         WHERE id = ? AND status = 'queued'`,
        [jobId]
      );
      if (claimResult.affectedRows === 0) {
        await connection.commit();
        return;
      }

      // If no account assigned, pick an available one
      if (!accountId) {
        // Priority: available status, not disabled, ordered by last_used_at (round-robin)
        const [accounts] = await connection.execute<RowDataPacket[]>(
          `SELECT id FROM gemini_accounts 
           WHERE status = 'available' 
           AND (cooldown_until IS NULL OR cooldown_until < NOW())
           ORDER BY last_used_at ASC, id ASC 
           LIMIT 1`
        );
        if (accounts.length > 0) {
          accountId = accounts[0].id;
          await connection.execute(
            `UPDATE video_jobs SET account_id = ?, updated_at = NOW() WHERE id = ?`, 
            [accountId, jobId]
          );
          // Mark account as busy in DB immediately to prevent other workers from picking it if we had multiple
          await connection.execute(
            `UPDATE gemini_accounts SET status = 'busy', last_used_at = NOW() WHERE id = ?`,
            [accountId]
          );
        }
      } else {
        // If account was already assigned, check if it's available or already busy by THIS job
        const [accCheck] = await connection.execute<RowDataPacket[]>(
          `SELECT status FROM gemini_accounts WHERE id = ?`,
          [accountId]
        );
        
        if (accCheck.length > 0 && accCheck[0].status === 'disabled') {
           await connection.execute(
            `UPDATE video_jobs SET status = 'queued', account_id = NULL, progress = 0, updated_at = NOW() WHERE id = ?`,
            [jobId]
          );
          await this.addLog(connection, jobId, null, 'warn', 'account_disabled', `Assigned account #${accountId} is disabled. Job returned to queue.`);
          await connection.commit();
          return;
        }

        // Update last_used_at for assigned account
        await connection.execute(
          `UPDATE gemini_accounts SET status = 'busy', last_used_at = NOW() WHERE id = ?`,
          [accountId]
        );
      }

      if (!accountId) {
        // Revert status to queued so job does not stay stuck in preparing without an account
        await connection.execute(
          `UPDATE video_jobs SET status = 'queued', progress = 0, started_at = NULL, updated_at = NOW() WHERE id = ?`,
          [jobId]
        );
        await this.addLog(connection, jobId, null, 'warn', 'job_waiting', 'No available account found to process job. Reverted to queued.');
        await connection.commit();
        return;
      }

      console.log(`[BrowserWorker] Processing job #${jobId} with account #${accountId}`);
      await this.addLog(connection, jobId, accountId, 'info', 'job_preparing', `Job #${jobId} preparing with account #${accountId}.`);

      await connection.commit();

      // Track active processing job
      this.currentJobId = jobId;
      this.currentAccountId = accountId;

      try {
        await this.executeJobSteps(jobId, accountId, job);
      } finally {
        this.currentJobId = null;
        this.currentAccountId = null;
        clearJobCancellation(jobId);
        // Clean up the job-to-page correlation map to prevent stale event pollution
        this.profileManager.unregisterJobPage(jobId);
        // Always ensure the profile lock is safely released
        await this.profileManager.releaseProfileForJob(accountId);
      }
    } catch (err: any) {
      if (connection) await connection.rollback();
      console.error('[BrowserWorker] Error processing job:', err);
    } finally {
      if (connection) connection.release();
    }
  }

  private async checkCancelled(jobId: number): Promise<boolean> {
    if (isJobCancellationRequested(jobId)) {
      return true;
    }
    const [rows] = await pool.query<RowDataPacket[]>('SELECT status FROM video_jobs WHERE id = ?', [jobId]);
    if (rows.length > 0 && rows[0].status === 'cancelled') {
      requestJobCancellation(jobId);
      return true;
    }
    return false;
  }

  private async executeSubmissionFlow(
    page: Page,
    jobId: number,
    accountId: number,
    job: any
  ): Promise<{ success: boolean; submitted: boolean; reason?: string }> {
    // Add logging for aspect_ratio selection
    console.log(`[BrowserWorker] Job #${jobId}: Processing aspect_ratio selection. Job aspect_ratio: ${job.aspect_ratio || 'NOT SET'}`);
    
    // 1. Jika ada gambar referensi, lakukan penanganan upload gambar terlebih dahulu secara independen
    if (job.reference_image_path) {
      try {
        // Gunakan storagePath dari config untuk mendapatkan path absolut yang konsisten
        const storageBase = path.resolve(process.cwd(), config.storagePath || '../storage');
        let absoluteImagePath: string;
        
        if (path.isAbsolute(job.reference_image_path)) {
          absoluteImagePath = job.reference_image_path;
        } else {
          const relativePath = job.reference_image_path.replace(/^storage[\\/]/, '');
          absoluteImagePath = path.resolve(storageBase, relativePath);
        }

        // Verifikasi file ada sebelum mencoba diunggah
        const fs = await import('fs');
        if (!fs.existsSync(absoluteImagePath)) {
          await this.addLogStandalone(jobId, accountId, 'error', 'image_file_missing', `File gambar tidak ditemukan di disk: ${absoluteImagePath}`);
        } else {
          // Buka menu/tombol upload terlebih dahulu agar input[type="file"] dirender oleh DOM Gemini
          const uploadTriggerBtn = page.locator('button[aria-label*="Upload file"], button[aria-label*="Upload & alat"], button[aria-label*="Upload & tools"]').first();
          if (await uploadTriggerBtn.count() > 0 && await uploadTriggerBtn.isVisible()) {
            await uploadTriggerBtn.click();
            await page.waitForTimeout(800);
          }

          // Cari input file (prioritaskan yang accept image atau input[type="file"])
          let fileInput = page.locator('input[type="file"][accept*="image"]').first();
          if (await fileInput.count() === 0) {
            fileInput = page.locator('input[type="file"]').first();
          }

          if (await fileInput.count() > 0) {
            await fileInput.setInputFiles(absoluteImagePath);
            await this.addLogStandalone(jobId, accountId, 'info', 'image_attached', `Gambar referensi diunggah: ${job.reference_image_path}`);
            
            // Tunggu hingga thumbnail gambar benar-benar muncul di UI Gemini (composer)
            const thumbnailSelectors = [
              'img[alt*="attachment"]',
              'img[src^="blob:"]',
              'img[src^="data:image"]',
              '.image-preview',
              '.file-preview',
              '[data-test-id*="attachment"]',
              'div[aria-label*="Attachment"]',
              'div[aria-label*="Lampiran"]',
              'button[aria-label*="Hapus"] img',
              'button[aria-label*="Remove"] img',
              'mat-chip img',
              'mat-chip'
            ];

            let imageRendered = false;
            for (let i = 0; i < 15; i++) {
              for (const thumbSel of thumbnailSelectors) {
                if (await page.locator(thumbSel).count() > 0 && await page.locator(thumbSel).first().isVisible()) {
                  imageRendered = true;
                  break;
                }
              }
              if (imageRendered) break;
              await page.waitForTimeout(1000);
            }

            if (imageRendered) {
              await this.addLogStandalone(jobId, accountId, 'info', 'image_rendered', 'Gambar referensi berhasil dirender dan terpasang pada antarmuka Gemini.');
            } else {
              await this.addLogStandalone(jobId, accountId, 'warn', 'image_render_timeout', 'Gambar referensi diunggah tetapi pratinjunjuk tidak dapat diverifikasi secara visual.');
            }

            // Beri jeda stabilitas tambahan setelah upload diverifikasi
            await page.waitForTimeout(1500);
          } else {
            await this.addLogStandalone(jobId, accountId, 'warn', 'image_input_missing', 'Elemen input[type="file"] tidak ditemukan di halaman.');
          }
        }
      } catch (imgErr: any) {
        console.warn('[BrowserWorker] Reference image upload error:', imgErr.message);
        await this.addLogStandalone(jobId, accountId, 'error', 'image_upload_failed', `Gagal mengunggah gambar referensi: ${imgErr.message}`);
      }
    }

    // 1.5. Pilih rasio aspek (9:16 atau 16:9) sebelum mengirim prompt
    if (job.aspect_ratio) {
      try {
        const requestedRatio = job.aspect_ratio; // '9:16' or '16:9'
        const isPortrait = requestedRatio === '9:16';
        
        // Cari tombol pemicu menu rasio aspek di Gemini UI
        const ratioTriggerSelectors = [
          'button[aria-label*="Rasio aspek"]',
          'button[aria-label*="Aspect ratio"]',
          'button:has-text("Rasio aspek")',
          'button:has-text("Aspect ratio")'
        ];

        let ratioTriggerBtn = null;
        for (const sel of ratioTriggerSelectors) {
          const loc = page.locator(sel).first();
          if (await loc.count() > 0 && await loc.isVisible()) {
            ratioTriggerBtn = loc;
            console.log(`[BrowserWorker] Job #${jobId}: Found ratio trigger button with selector: ${sel}`);
            break;
          }
        }

        if (ratioTriggerBtn) {
          const checkBtnLabel = async () => {
            try {
              const ariaLabel = (await ratioTriggerBtn!.getAttribute('aria-label')) || '';
              const textContent = (await ratioTriggerBtn!.innerText()) || '';
              const fullText = `${ariaLabel} ${textContent}`.toLowerCase();
              if (isPortrait) {
                return fullText.includes('potret') || fullText.includes('portrait') || fullText.includes('9:16');
              } else {
                return fullText.includes('lanskap') || fullText.includes('landscape') || fullText.includes('16:9');
              }
            } catch {
              return false;
            }
          };

          const isAlreadySelected = await checkBtnLabel();
          console.log(`[BrowserWorker] Job #${jobId}: Aspect ratio trigger check - Is already selected? ${isAlreadySelected}`);
          
          if (isAlreadySelected) {
            await this.addLogStandalone(jobId, accountId, 'info', 'aspect_ratio_verified', `Rasio aspek ${requestedRatio} sudah aktif pada antarmuka Gemini.`);
          } else {
            await ratioTriggerBtn.click();
            await page.waitForTimeout(800);

            // Cari opsi dari overlay menu (Potret 9:16 atau Lanskap 16:9)
            const targetKeywords = isPortrait ? ['potret', 'portrait', '9:16'] : ['lanskap', 'landscape', '16:9'];
            let optionClicked = false;

            for (const kw of targetKeywords) {
              const ratioOption = page.locator(`[role="menuitemradio"][aria-label*="${kw}" i], [role="menuitem"][aria-label*="${kw}" i], [role="menuitemradio"]:has-text("${kw}"), button:has-text("${kw}")`).first();
              if (await ratioOption.count() > 0 && await ratioOption.isVisible()) {
                await ratioOption.click();
                optionClicked = true;
                console.log(`[BrowserWorker] Job #${jobId}: Selected aspect ratio option with keyword: ${kw}`);
                break;
              }
            }

            if (optionClicked) {
              await page.waitForTimeout(1000);
              const verifiedAfterClick = await checkBtnLabel();
              if (verifiedAfterClick) {
                await this.addLogStandalone(jobId, accountId, 'info', 'aspect_ratio_verified', `Rasio aspek ${requestedRatio} berhasil dipilih dan diverifikasi aktif.`);
              } else {
                await this.addLogStandalone(jobId, accountId, 'warn', 'aspect_ratio_unverified', `Rasio aspek ${requestedRatio} dipilih tetapi verifikasi label UI tidak cocok.`);
              }
            } else {
              await this.addLogStandalone(jobId, accountId, 'warn', 'aspect_ratio_option_not_found', `Opsi menu rasio aspek ${requestedRatio} tidak dapat diklik di overlay.`);
            }
          }
        } else {
          console.warn(`[BrowserWorker] Job #${jobId}: Aspect ratio trigger button not found for ${requestedRatio}`);
          await this.addLogStandalone(jobId, accountId, 'warn', 'aspect_ratio_trigger_not_found', 'Tombol pemicu rasio aspek tidak ditemukan pada antarmuka Gemini.');
        }
      } catch (err: any) {
        console.warn('[BrowserWorker] Aspect ratio selection error:', err.message);
        await this.addLogStandalone(jobId, accountId, 'error', 'aspect_ratio_selection_failed', `Gagal memilih rasio aspek ${job.aspect_ratio}: ${err.message}`);
      }
    } else {
      console.warn(`[BrowserWorker] Job #${jobId}: aspect_ratio is NOT SET in job data, skipping aspect ratio selection`);
    }

    // 2. Masukkan prompt teks dan submit (secara terpisah setelah pengunggahan gambar)
    return await this.fillPromptAndSubmit(page, jobId, accountId, job.prompt);
  }

  public async fillPromptAndSubmit(
    page: Page,
    jobId: number,
    accountId: number,
    prompt: string
  ): Promise<{ success: boolean; submitted: boolean; reason?: string }> {
    if (await this.checkCancelled(jobId)) return { success: false, submitted: false, reason: 'cancelled' };

    // Pastikan prompt valid dan tidak kosong
    const trimmedPrompt = (prompt || '').trim();
    if (!trimmedPrompt) {
      await this.addLogStandalone(jobId, accountId, 'error', 'prompt_empty', 'Prompt pekerjaan kosong.');
      return { success: false, submitted: false, reason: 'prompt_empty' };
    }

    const composerSelectors = [
      'rich-textarea p',
      'rich-textarea [contenteditable="true"]',
      'rich-textarea',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[aria-label*="Prompt"]',
      'textarea[aria-label*="prompt"]',
      '[aria-label*="Enter a prompt"]',
      '[aria-label*="Masukkan prompt"]',
      'textarea'
    ];

    let promptFilled = false;
    let activeComposerLocator: any = null;

    for (const sel of composerSelectors) {
      if (await this.checkCancelled(jobId)) return { success: false, submitted: false, reason: 'cancelled' };
      try {
        const locator = page.locator(sel).first();
        if (await locator.isVisible({ timeout: 2000 })) {
          await locator.click();
          await page.waitForTimeout(300);

          // Coba metode 1: locator.fill()
          try {
            await locator.fill(trimmedPrompt);
          } catch {
            // Coba metode 2: locator.pressSequentially / type
            try {
              await locator.pressSequentially(trimmedPrompt, { delay: 10 });
            } catch {
              // Coba metode 3: direct innerText / value via evaluate
              await locator.evaluate((el: any, val: string) => {
                if ('value' in el) {
                  el.value = val;
                } else {
                  el.innerText = val;
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }, trimmedPrompt);
            }
          }

          // Verifikasi teks benar-benar masuk
          const enteredText = await locator.evaluate((el: any) => {
            return (el.value !== undefined ? el.value : el.innerText) || '';
          });

          if (enteredText.trim().length > 0) {
            promptFilled = true;
            activeComposerLocator = locator;
            await this.addLogStandalone(
              jobId,
              accountId,
              'info',
              'prompt_entered',
              `Teks prompt berhasil dimasukkan ke Gemini Web menggunakan selector: ${sel}`
            );
            break;
          }
        }
      } catch (e: any) {
        console.warn(`[BrowserWorker] Selector attempt failed (${sel}):`, e.message);
      }
    }

    if (!promptFilled) {
      await this.addLogStandalone(
        jobId,
        accountId,
        'warn',
        'composer_not_found',
        'Tidak dapat menemukan atau memvalidasi teks pada kolom prompt Gemini. Browser dibiarkan terbuka.'
      );
      await this.updateJobStatusStandalone(
        jobId,
        'paused',
        45,
        'Gagal memasukkan teks prompt secara otomatis. Silakan periksa di browser.'
      );
      return { success: false, submitted: false, reason: 'composer_not_found' };
    }

    if (await this.checkCancelled(jobId)) return { success: false, submitted: false, reason: 'cancelled' };

    // Submisi prompt (hindari tombol "Buat Video" jika sudah berada di halaman /videos)
    let submitted = false;
    const isVideosPage = page.url().includes('gemini.google.com/videos');
    const submitButtonSelectors = [
      'button[aria-label*="Kirim pesan"]',
      'button[aria-label*="Send message"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="Kirim"]',
      'button[aria-label*="Generate"]',
      'button.send-button',
      'button.submit-button',
      'button[mat-flat-button]',
      'button:has(mat-icon:text("send"))',
      'button:has(mat-icon:text("arrow_forward"))'
    ];
    
    // Jika tidak di halaman videos, tambahkan selektor Buat ke prioritas rendah
    if (!isVideosPage) {
        submitButtonSelectors.splice(3, 0, 'button[aria-label*="Buat"]');
    }

    for (const btnSel of submitButtonSelectors) {
      if (await this.checkCancelled(jobId)) return { success: false, submitted: false, reason: 'cancelled' };
      try {
        const btnLocator = page.locator(btnSel).first();
        if (await btnLocator.isVisible({ timeout: 2000 }) && await btnLocator.isEnabled()) {
          await btnLocator.click();
          submitted = true;
          await this.addLogStandalone(
            jobId,
            accountId,
            'info',
            'prompt_submitted',
            `Prompt berhasil dikirim menggunakan tombol: ${btnSel}`
          );
          break;
        }
      } catch {}
    }

    // Fallback tekan Enter pada elemen composer
    if (!submitted) {
      try {
        if (await this.checkCancelled(jobId)) return { success: false, submitted: false, reason: 'cancelled' };
        if (activeComposerLocator) {
          await activeComposerLocator.press('Enter');
        } else {
          await page.keyboard.press('Enter');
        }
        submitted = true;
        await this.addLogStandalone(
          jobId,
          accountId,
          'info',
          'prompt_submitted_enter',
          'Prompt dikirim via tombol Enter pada elemen composer.'
        );
      } catch (enterErr: any) {
        console.warn('[BrowserWorker] Enter key submission failed:', enterErr.message);
      }
    }

    return { success: true, submitted };
  }

  private async executeJobSteps(jobId: number, accountId: number, job: any) {
    if (await this.checkCancelled(jobId)) {
      console.log(`[BrowserWorker] Job #${jobId} was cancelled before starting execution steps.`);
      return;
    }

    // 1. Acquire the manager-owned browser profile (reuse an open session safely)
    const acquireResult = await this.profileManager.acquireProfileForJob(accountId, jobId);
    if (!acquireResult.success || !acquireResult.profileInfo) {
      if (await this.checkCancelled(jobId)) return;
      await this.addLogStandalone(jobId, accountId, 'error', 'job_failed', `Failed to acquire browser profile: ${acquireResult.message}`);
      await this.updateJobStatusStandalone(jobId, 'failed', 0, `Browser profile unavailable: ${acquireResult.message}`);
      return;
    }

    if (await this.checkCancelled(jobId)) {
      console.log(`[BrowserWorker] Job #${jobId} cancelled after acquiring profile.`);
      return;
    }

    // Ensure we're on the videos page
    const profileInfo2 = this.profileManager.getProfileInfo(accountId);
    const page = profileInfo2?.page;
    if (!page) {
      if (await this.checkCancelled(jobId)) return;
      await this.addLogStandalone(jobId, accountId, 'error', 'job_failed', 'Browser profile page is missing.');
      await this.updateJobStatusStandalone(jobId, 'failed', 0, 'Browser profile page missing.');
      return;
    }

    await page.goto('https://gemini.google.com/videos');

    if (await this.checkCancelled(jobId)) return;

    // 2. Check login status
    const loginStatus = await this.profileManager.checkLoginStatus(accountId);
    if (loginStatus.status !== 'available') {
      if (await this.checkCancelled(jobId)) return;
      await this.addLogStandalone(jobId, accountId, 'error', 'job_failed', `Login status not available: ${loginStatus.status} - ${loginStatus.message}`);
      await this.updateJobStatusStandalone(jobId, 'failed', 0, `Login issue: ${loginStatus.status}`);
      await this.profileManager.closeProfile(accountId);
      return;
    }

    if (await this.checkCancelled(jobId)) return;

    // 3. Update to running
    await this.updateJobStatusStandalone(jobId, 'running', 40, 'Browser session active. Interacting with Gemini Web UI...');
    await this.addLogStandalone(jobId, accountId, 'info', 'job_running', `Job #${jobId}: Browser session active. Interacting with Gemini Web.`);

    // Register the exact Page and its initial URL context before any result can be downloaded.
    // Update initial context dynamically whenever prompt submission leads to a new conversation URL
    const initialContext = page.url();
    this.profileManager.registerJobPage(jobId, page, initialContext);
    console.log(`[BrowserWorker] Job #${jobId}: registered page context ${initialContext}`);

    // Re-fetch page after navigation to ensure valid reference
    const pageRef = this.profileManager.getProfileInfo(accountId);
    if (!pageRef || !pageRef.page) {
      throw new Error('Browser profile active but page reference is missing.');
    }

    // Ensure Gemini Video page is loaded correctly for video creation
    const targetUrl = 'https://gemini.google.com/videos';
    if (!page.url().includes('gemini.google.com/videos')) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
    }

    if (await this.checkCancelled(jobId)) return;

    // Terapkan pola pengiriman prompt: Jika ada gambar, unggah dulu.
    // Jika tidak, langsung masukkan prompt dan submit.
    const promptResult = await this.executeSubmissionFlow(page, jobId, accountId, job);
    if (!promptResult.success) {
      return;
    }

    const submitted = promptResult.submitted;

    if (await this.checkCancelled(jobId)) return;

    if (submitted) {
      // Re-register context setelah submission jika URL berubah (misalnya ID chat baru dibuat)
      const afterSubmitContext = page.url();
      this.profileManager.registerJobPage(jobId, page, afterSubmitContext);
      console.log(`[BrowserWorker] Job #${jobId}: re-registered context after submit: ${afterSubmitContext}`);

      await this.updateJobStatusStandalone(
        jobId, 
        'running', 
        70, 
        'Prompt submitted successfully. Video generation started. Awaiting completion/download.'
      );
      await this.addLogStandalone(
        jobId, 
        accountId, 
        'info', 
        'job_running_generation', 
        'Video generation sequence initiated automatically.'
      );
      console.log(`[BrowserWorker] Job #${jobId}: Prompt submitted and generation initiated.`);

      // 7. Check for Gemini rejection / refusal message before waiting for download
      await page.waitForTimeout(5000); // Increased wait for processing
      if (await this.checkCancelled(jobId)) return;

      const rejectionDetected = await this.checkForGeminiRejection(page, jobId, accountId);
      if (rejectionDetected) {
        // Stop worker logic for this job because it's awaiting_user action
        return;
      }

      // 8. Automate detection of video completion & download
      await this.handleVideoCompletionAndDownload(page, jobId, accountId);
    } else {
      // If submission control cannot be verified, fallback to awaiting_user
      if (await this.checkCancelled(jobId)) return;
      await this.updateJobStatusStandalone(
        jobId, 
        'awaiting_user', 
        60, 
        'Prompt entered in Gemini Web. Please review and initiate video generation manually in the browser.'
      );
      await this.addLogStandalone(
        jobId, 
        accountId, 
        'warn', 
        'awaiting_user_action', 
        'Submit control not found automatically. Awaiting manual generation.'
      );
    }
  }

  private async checkForGeminiRejection(page: Page, jobId: number, accountId: number): Promise<boolean> {
    try {
      const pageText = await page.evaluate(() => {
        const globalObj = globalThis as any;
        return globalObj.document && globalObj.document.body ? globalObj.document.body.innerText : '';
      });
      const rejectionPhrases = [
        'Saya dirancang hanya untuk memproses dan membuat teks',
        'tidak bisa membantu Anda',
        'I am designed to process and generate text only',
        'cannot help with that',
        'I cannot generate video',
        'Fitur pembuatan video belum didukung',
        'Fitur video tidak tersedia',
        'Gagal membuat video',
        'Couldn\'t generate video',
        'An error occurred while generating',
        'Terjadi kesalahan saat membuat video'
      ];

      for (const phrase of rejectionPhrases) {
        if (pageText.includes(phrase)) {
          console.warn(`[BrowserWorker] Gemini temporary failure/rejection detected for Job #${jobId}: "${phrase}"`);
          if (await this.checkCancelled(jobId)) return true;

          await this.addLogStandalone(
            jobId,
            accountId,
            'warn',
            'gemini_generation_failed_retryable',
            `Gemini belum berhasil membuat video (${phrase}). Menunggu pengguna menekan Retry di browser.`
          );
          await this.updateJobStatusStandalone(
            jobId,
            'awaiting_user',
            60,
            'Gemini belum berhasil membuat video. Silakan tekan Retry pada jendela Gemini. Pemantauan akan berlanjut secara otomatis.'
          );
          return true;
        }
      }
    } catch (e: any) {
      console.warn('[BrowserWorker] Error during rejection check:', e.message);
    }
    return false;
  }

  private async handleVideoCompletionAndDownload(page: Page, jobId: number, accountId: number) {
    try {
      this.addLogStandalone(jobId, accountId, 'info', 'waiting_completion', 'Waiting for video generation to complete...');
      
      // Wait for completion indicator or download button
      const downloadButtonSelectors = [
        'button[aria-label*="Download"]',
        'button[aria-label*="Unduh"]',
        'a[aria-label*="Download"]',
        'a[aria-label*="Unduh"]'
      ];
      
      // Set to downloading status
      await this.updateJobStatusStandalone(jobId, 'downloading', 85, 'Video generation complete. Detecting download button.');
      
      // Ambil batas waktu unduhan dari pengaturan database (default 30 menit)
      const { getSetting } = await import('./settingsService.js');
      const downloadTimeoutMinutes = await getSetting('downloadTimeout');
      const maxIterations = Math.max(6, Math.floor((downloadTimeoutMinutes * 60) / 10));

      for (let i = 0; i < maxIterations; i++) {
        if (await this.checkCancelled(jobId)) return;
        for (const sel of downloadButtonSelectors) {
          if (await page.locator(sel).count() > 0) {
              this.addLogStandalone(jobId, accountId, 'info', 'download_detected', 'Download button detected, initiating download.');
              await page.locator(sel).first().click();

              // Wait for the download event to fire and be processed by context.on('download')
              // This ensures job status transitions to 'completed' before we release the page/profile
              const downloadPromise = page.waitForEvent('download').then(async (download) => {
                  // Wait briefly for browserProfileManager.ts download handler to save file & update DB
                  await page.waitForTimeout(2000);
              });

              try {
                  await downloadPromise;
              } catch (e: any) {
                  this.addLogStandalone(jobId, accountId, 'warn', 'download_wait_timeout', `Tunggu unduhan gagal: ${e.message}. Coba lanjutkan.`);
              }

              return; // Exit only after download has been picked up
          }
        }
        await page.waitForTimeout(10000); // 10s intervals
      }
      
      throw new Error('Timeout waiting for download button');
    } catch (err: any) {
      if (await this.checkCancelled(jobId)) return;
      await this.updateJobStatusStandalone(jobId, 'awaiting_user', 80, `Auto-download failed: ${err.message}. Please download manually.`);
      this.addLogStandalone(jobId, accountId, 'warn', 'auto_download_failed', err.message);
    }
  }

  private async updateJobStatusStandalone(jobId: number, status: string, progress: number, message: string) {
    await pool.execute(
      `UPDATE video_jobs SET status = ?, progress = ?, updated_at = NOW(), error_message = ? WHERE id = ?`,
      [status, progress, message, jobId]
    );
  }

  private async addLog(connection: any, jobId: number, accountId: number | null, level: string, event: string, message: string) {
    await connection.execute(
      `INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, ?, ?, ?)`,
      [jobId, accountId, level, event, message]
    );
  }

  private async addLogStandalone(jobId: number, accountId: number | null, level: string, event: string, message: string) {
    await pool.execute(
      `INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, ?, ?, ?)`,
      [jobId, accountId, level, event, message]
    );
  }
  // Method untuk mengekspos profileManager untuk testing
  public getProfileManager(): BrowserProfileManager {
    return this.profileManager;
  }
}

export const browserWorker = new BrowserWorker();