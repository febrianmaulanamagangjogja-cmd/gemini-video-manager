import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { pool } from '../database/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { config } from '../config/index.js';

export interface BrowserProfileManager {
  launchProfile(profileId: number): Promise<{ success: boolean; message?: string }>;
  closeProfile(profileId: number, force?: boolean): Promise<{ success: boolean; message?: string; activeJobId?: number | null }>;
  acquireProfileForJob(profileId: number, jobId?: number): Promise<{ success: boolean; message?: string; profileInfo?: ProfileInfo | null }>;
  releaseProfileForJob(profileId: number): Promise<void>;
  checkLoginStatus(profileId: number): Promise<{ success?: boolean; accountId?: number; checkedAt?: string; status: string; message?: string; diagnosticReason?: string }>;
  isProfileRunning(profileId: number): boolean;
  isProfileInUse(profileId: number): boolean;
  getActiveJobId(profileId: number): number | null;
  getProfileInfo(profileId: number): ProfileInfo | null;
  registerJobPage(jobId: number, page: Page, initialContext?: string): void;
  unregisterJobPage(jobId: number): void;
  getJobPage(jobId: number): Page | null;
  getJobIdByPage(page: Page | null | undefined): number | null;
  getJobContextSnapshot(jobId: number): string | null;
}

export interface ProfileInfo {
  id: number;
  name: string;
  profilePath: string;
  status: string;
  context: BrowserContext | null;
  browser: Browser | null;
  page: Page | null;
}

const baseProfileDir = path.resolve(process.cwd(), config.browserProfilesPath || '../browser-profiles');

// In-memory map to track active browser contexts
const activeProfiles = new Map<number, ProfileInfo>();

// Track which accounts are currently running a job (profileId -> jobId or boolean)
const activeJobs = new Map<number, number | boolean>();

// Map jobId -> dedicated Page object for video generation
const jobPages = new Map<number, Page>();

// Map Page object to jobId for exact download correlation
const pageJobMap = new Map<Page, number>();

// Store initial conversation context (e.g. Gemini prompt/chat ID or URL snapshot)
const jobContextMap = new Map<number, string>();

export function registerJobPage(jobId: number, page: Page, initialContext?: string): void {
  jobPages.set(jobId, page);
  pageJobMap.set(page, jobId);
  if (initialContext) {
    jobContextMap.set(jobId, initialContext);
  }
  console.log(`[BrowserManager] Registered page for job #${jobId}${initialContext ? ` with context snapshot [${initialContext}]` : ''}`);
}

export function unregisterJobPage(jobId: number): void {
  const page = jobPages.get(jobId);
  if (page) {
    pageJobMap.delete(page);
  }
  jobPages.delete(jobId);
  jobContextMap.delete(jobId);
  console.log(`[BrowserManager] Unregistered page for job #${jobId}`);
}

export function getJobPage(jobId: number): Page | null {
  return jobPages.get(jobId) || null;
}

export function getJobIdByPage(page: Page | null | undefined): number | null {
  if (!page) return null;
  return pageJobMap.get(page) || null;
}

export function getJobContextSnapshot(jobId: number): string | null {
  return jobContextMap.get(jobId) || null;
}

// Ensure base directory exists
async function ensureBaseDir() {
  try {
    await fs.access(baseProfileDir);
  } catch {
    await fs.mkdir(baseProfileDir, { recursive: true });
  }
}

// Validate profile path is within allowed directory
function validateProfilePath(profilePath: string): string {
  const resolved = path.resolve(profilePath);
  const resolvedBase = path.resolve(baseProfileDir);
  
  if (!resolved.startsWith(resolvedBase)) {
    throw new Error('Profile path must be within browser-profiles directory');
  }
  
  return resolved;
}

async function getAccountFromDb(profileId: number): Promise<ProfileInfo | null> {
  if (!profileId) return null;
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, name, profile_path, status FROM gemini_accounts WHERE id = ?',
    [profileId]
  );
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    profilePath: row.profile_path,
    status: row.status,
    context: null,
    browser: null,
    page: null
  };
}

async function updateAccountStatus(profileId: number, status: string, lastError?: string) {
  const updates = ['status = ?', 'updated_at = NOW()'];
  const values: any[] = [status];
  
  if (lastError !== undefined) {
    updates.push('last_error = ?');
    values.push(lastError);
  }
  
  values.push(profileId);
  
  await pool.execute(
    `UPDATE gemini_accounts SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
}

async function waitForPageReady(page: Page, timeoutMs = 30000): Promise<boolean> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function checkLoginStatusOnPage(page: Page): Promise<{ status: string; message: string }> {
  try {
    // Wait a bit for page to stabilize and settle redirects
    await page.waitForTimeout(4000);

    const url = page.url();
    const title = await page.title().catch(() => '');

    const lowerUrl = url.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // 1. Explicit login required check
    if (
      lowerUrl.includes('accounts.google.com') ||
      lowerUrl.includes('/signin') ||
      lowerUrl.includes('/login') ||
      lowerTitle.includes('sign in') ||
      lowerTitle.includes('login') ||
      lowerTitle.includes('masuk')
    ) {
      return { status: 'login_required', message: 'Google login page detected' };
    }

    // 2. Check if we are on Gemini or AI Studio domain
    const geminiPatterns = ['gemini.google.com', 'aistudio.google.com'];
    const isGeminiDomain = geminiPatterns.some(pattern => lowerUrl.includes(pattern));

    if (!isGeminiDomain) {
      return { status: 'unknown', message: `On external domain: ${url}` };
    }

    // 3. Detailed authenticated UI check for Gemini
    // Let's check for specific authenticated elements or composer input
    let hasComposerInput = false;
    let hasUserAccountBadge = false;
    let hasSignOutOrAccountMenu = false;
    let hasNavMenu = false;

    try {
      // Composer input selectors (where user types prompt)
      const composerSelectors = [
        'rich-textarea',
        'textarea[aria-label*="Prompt"]',
        'div[contenteditable="true"][role="textbox"]',
        '[aria-label*="Enter a prompt"]',
        '[aria-label*="Masukkan prompt"]'
      ];
      for (const sel of composerSelectors) {
        if (await page.locator(sel).count() > 0) {
          hasComposerInput = true;
          break;
        }
      }
    } catch {}

    try {
      // User account badge or profile image button
      const accountSelectors = [
        'button[aria-label*="Google Account"]',
        'button[aria-label*="Akun Google"]',
        'img[alt*="Profile photo"]',
        'img[alt*="Foto profil"]',
        '[data-test-id="avatar-button"]'
      ];
      for (const sel of accountSelectors) {
        if (await page.locator(sel).count() > 0) {
          hasUserAccountBadge = true;
          break;
        }
      }
    } catch {}

    try {
      // Sign out / account options in menu or UI
      const signOutCount = await page.locator(':has-text("Sign out"), :has-text("Keluar")').count();
      if (signOutCount > 0) hasSignOutOrAccountMenu = true;
    } catch {}

    try {
      // Standard navigation menu (side nav)
      const navCount = await page.locator('bard-sidenav-container, [role="navigation"], aria-label*="Menu"').count();
      if (navCount > 0) hasNavMenu = true;
    } catch {}

    // Build diagnostic array
    const diag: string[] = [];
    if (hasComposerInput) diag.push('composer_found');
    if (hasUserAccountBadge) diag.push('account_badge_found');
    if (hasSignOutOrAccountMenu) diag.push('sign_out_found');
    if (hasNavMenu) diag.push('nav_menu_found');

    // Rule for available: Must have composer input OR user account badge (strong authenticated signals)
    if (hasComposerInput || hasUserAccountBadge || hasSignOutOrAccountMenu) {
      return { status: 'available', message: `Authenticated Gemini UI confirmed (${diag.join(', ')})` };
    }

    // If only nav menu or domain matched without chat interface/avatar, it might still be loading or asking for sign in
    if (hasNavMenu) {
      return { status: 'unknown', message: `On Gemini domain with nav menu only, authentication unclear (diag: ${diag.join(', ') || 'none'})` };
    }

    return { status: 'unknown', message: `On Gemini domain but no authenticated UI indicators found` };
  } catch (err: any) {
    console.error('[checkLoginStatusOnPage] Exception:', err.message);
    return { status: 'error', message: `Failed to check login: ${err.message}` };
  }
}

export class BrowserProfileManagerImpl implements BrowserProfileManager {
  async launchProfile(profileId: number): Promise<{ success: boolean; message?: string }> {
    // Check if already running in memory
    if (this.isProfileRunning(profileId)) {
      const info = this.getProfileInfo(profileId);
      // Ensure the page and context are still open and healthy
      if (info && info.context) {
        try {
          const pages = info.context.pages();
          if (pages.length > 0 && !pages[0].isClosed()) {
            info.page = pages[0];
            return { success: true, message: 'Reusing existing active browser profile' };
          } else {
            // Context has no open pages, create a new one
            const newPage = await info.context.newPage();
            info.page = newPage;
            return { success: true, message: 'Reusing active browser profile with new page' };
          }
        } catch (pageErr: any) {
          console.warn(`[BrowserManager] Active profile context check failed, re-launching:`, pageErr.message);
          activeProfiles.delete(profileId);
        }
      } else {
        return { success: true, message: 'Profile marked running, reusing session' };
      }
    }
    
    // Get account from DB
    const account = await getAccountFromDb(profileId);
    if (!account) {
      return { success: false, message: 'Account not found in database' };
    }
    
    try {
      await ensureBaseDir();
      const validatedPath = validateProfilePath(account.profilePath);
      
      // Ensure profile directory exists
      await fs.mkdir(validatedPath, { recursive: true });
      
      await updateAccountStatus(profileId, 'busy');
      
      console.log(`[BrowserManager] Launching profile ${profileId} at ${validatedPath}`);
      
      // Launch persistent context (BrowserContext)
      const context = await chromium.launchPersistentContext(validatedPath, {
        headless: false,
        acceptDownloads: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--no-default-browser-check'
        ],
        viewport: { width: 1280, height: 800 }
      });

      // Register download event handler on BrowserContext (Playwright standard for persistent context)
      context.on('download', async (download) => {
        try {
          const suggestedFilename = download.suggestedFilename();
          const page = download.page();
          const jobId = getJobIdByPage(page);

          if (!jobId) {
            console.warn(`[BrowserManager] Download detected from untracked page or other session (${suggestedFilename}). Ignoring.`);
            return;
          }

          console.log(`[BrowserManager] Download event detected for Job #${jobId}: ${suggestedFilename}`);

          // Extra validation: Check if job is still active
          const activeJobId = this.getActiveJobId(profileId);
          if (activeJobId !== jobId) {
            console.warn(`[BrowserManager] Job #${jobId} is no longer the active job for profile ${profileId}. Actual active: ${activeJobId}. Ignoring stale download.`);
            return;
          }

          // Conversation context validation: detect if user switched chats in the same tab
          const initialContext = getJobContextSnapshot(jobId);
          if (initialContext && page) {
            const currentUrl = page.url();
            
            // Extract Chat ID using regex: /app/([a-zA-Z0-9_-]+)
            const getChatId = (url: string) => {
              const match = url.match(/\/app\/([a-zA-Z0-9_-]+)/);
              return match ? match[1] : null;
            };

            const initialChatId = getChatId(initialContext);
            const currentChatId = getChatId(currentUrl);

            // Logic:
            // 1. If both are null/empty, we are at root /app (still in same app context)
            // 2. If both match, we are in the same chat.
            // 3. If initial is root, but current has chatId, we transitioned to a valid new chat created by our job.
            // 4. Otherwise, it's a context mismatch.
            const isMatch = (initialChatId === currentChatId) || (!initialChatId && !!currentChatId);
            
            if (!isMatch) {
              console.warn(`[BrowserManager] Conversation context mismatch for Job #${jobId}. Initial: [${initialContext}], Current: [${currentUrl}]. Rejecting result.`);
              
              const connection = await pool.getConnection();
              try {
                await connection.execute(
                  `INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, 'warn', 'context_switch', ?)`,
                  [jobId, profileId, `Download rejected because the Gemini conversation was switched (Chat mismatch: ${initialChatId} vs ${currentChatId}).`]
                );
              } finally {
                connection.release();
              }
              return;
            }
          }

          // Check download failure if any
          const failure = await download.failure();
          if (failure) {
            console.error(`[BrowserManager] Download failed for Job #${jobId}: ${failure}`);
            try {
              await pool.execute(
                "UPDATE video_jobs SET status = 'awaiting_user', error_message = ?, updated_at = NOW() WHERE id = ? AND status = 'downloading'",
                [`Pengunduhan otomatis gagal: ${failure}. Silakan unduh secara manual dari browser.`, jobId]
              );
              await pool.execute(
                "INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, 'warn', 'download_failed', ?)",
                [jobId, profileId, `Pengunduhan Playwright gagal: ${failure}`]
              );
            } catch (err: any) {
              console.error('[BrowserManager] Failed to update job status on download failure:', err.message);
            }
            return;
          }

          const storageBase = path.resolve(process.cwd(), config.storagePath || '../storage');
          const outputsDir = path.resolve(storageBase, 'outputs');
          if (!fsSync.existsSync(outputsDir)) {
            fsSync.mkdirSync(outputsDir, { recursive: true });
          }

          const ext = path.extname(suggestedFilename) || '.mp4';
          const uniqueFilename = `gemini_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
          const destinationPath = path.resolve(outputsDir, uniqueFilename);

          await download.saveAs(destinationPath);
          console.log(`[BrowserManager] Job #${jobId} file saved to storage/outputs: ${destinationPath}`);

          if (fsSync.existsSync(destinationPath)) {
            const stats = fsSync.statSync(destinationPath);
            if (stats.size > 1024) { // Minimum 1KB for valid video
              const connection = await pool.getConnection();
              try {
                const relativePath = path.join('storage', 'outputs', uniqueFilename).replace(/\\/g, '/');

                await connection.beginTransaction();

                // Final re-check: ensure job status is still valid for completion (not cancelled/failed)
                const [jobStatus] = await connection.execute<RowDataPacket[]>(
                  'SELECT status FROM video_jobs WHERE id = ?', [jobId]
                );

                if (jobStatus.length > 0 && ['preparing', 'running', 'downloading', 'awaiting_user'].includes(jobStatus[0].status)) {
                  await connection.execute(
                    `UPDATE video_jobs SET status = 'completed', progress = 100, output_video_path = ?, error_message = NULL, completed_at = NOW() WHERE id = ?`,
                    [relativePath, jobId]
                  );
                  await connection.execute(
                    `INSERT INTO video_assets (job_id, asset_type, file_path, mime_type, file_size) VALUES (?, ?, ?, ?, ?)`,
                    [jobId, 'output_video', relativePath, 'video/mp4', stats.size]
                  );
                  await connection.execute(
                    `INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, 'info', 'video_downloaded', ?)`,
                    [jobId, profileId, `Downloaded video saved automatically: ${uniqueFilename}`]
                  );
                  await connection.execute(
                    `INSERT INTO job_logs (job_id, account_id, level, event, message) VALUES (?, ?, 'info', 'job_completed', 'Job marked completed via Playwright context download event')`,
                    [jobId, profileId]
                  );
                  await connection.commit();
                  console.log(`[BrowserManager] Linked downloaded video to job #${jobId}`);
                } else {
                  console.warn(`[BrowserManager] Job #${jobId} status is ${jobStatus[0]?.status || 'unknown'}, skipping completion.`);
                  await connection.rollback();
                  try { fsSync.unlinkSync(destinationPath); } catch {}
                }
              } catch (dbErr: any) {
                console.error('[BrowserManager] Error linking download:', dbErr);
              } finally {
                connection.release();
              }
            } else {
              console.error(`[BrowserManager] Downloaded file size too small (${stats.size} bytes), discarded.`);
              try { fsSync.unlinkSync(destinationPath); } catch {}
            }
          }
        } catch (err: any) {
          console.error('[BrowserManager] Error processing download:', err);
        }
      });

      // Handle context close (e.g. user manually closes browser window or browser terminates)
      context.on('close', async () => {
        console.log(`[BrowserManager] Context closed for profile ${profileId}`);
        const currentActiveJob = this.getActiveJobId(profileId);
        if (currentActiveJob) {
          try {
            const { requestJobCancellation, cancelJob } = await import('./browserWorker.js');
            requestJobCancellation(currentActiveJob);
            cancelJob(currentActiveJob);
          } catch {}
        }

        activeProfiles.delete(profileId);
        activeJobs.delete(profileId);

        try {
          await pool.execute(
            "UPDATE video_jobs SET status = 'cancelled', progress = 0, error_message = 'Job cancelled due to browser window closure', updated_at = NOW() WHERE account_id = ? AND status IN ('preparing', 'running', 'downloading', 'awaiting_user', 'paused')",
            [profileId]
          );
          const account = await getAccountFromDb(profileId);
          const targetStatus = (account && ['busy', 'available'].includes(account.status)) ? 'available' : (account?.status || 'available');
          await updateAccountStatus(profileId, targetStatus);
        } catch (dbErr: any) {
          console.warn(`[BrowserManager] Failed to update jobs/account on context close for profile ${profileId}:`, dbErr.message);
        }
      });
      
      const page = await context.newPage();
      
      // Navigate to Gemini Video creation page or main app
      const targetUrl = 'https://gemini.google.com/videos';
      await page.goto(targetUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });

      // Verify if we were redirected or if videos page is not available
      const currentUrl = page.url();
      if (!currentUrl.includes('video') && !currentUrl.includes('gemini.google.com')) {
        console.warn(`[BrowserManager] Redirected away from target URL: ${currentUrl}`);
      }
      
      // Store profile info
      const profileInfo: ProfileInfo = {
        ...account,
        context: context,
        browser: null, // Persistent context doesn't expose browser directly
        page
      };
      
      activeProfiles.set(profileId, profileInfo);
      
      // Check initial login status
      const loginCheck = await checkLoginStatusOnPage(page);
      await updateAccountStatus(profileId, loginCheck.status, loginCheck.message);
      
      // Update in-memory status
      const stored = activeProfiles.get(profileId);
      if (stored) {
        stored.status = loginCheck.status;
      }
      
      console.log(`[BrowserManager] Profile ${profileId} launched. Login status: ${loginCheck.status}`);
      
      return { 
        success: true, 
        message: `Browser launched. Status: ${loginCheck.status} - ${loginCheck.message}` 
      };
      
    } catch (err: any) {
      console.error(`[BrowserManager] Failed to launch profile ${profileId}:`, err);
      await updateAccountStatus(profileId, 'error', err.message);
      return { success: false, message: `Failed to launch: ${err.message}` };
    }
  }
  
  async closeProfile(profileId: number, force: boolean = false): Promise<{ success: boolean; message?: string; activeJobId?: number | null }> {
    const profileInfo = activeProfiles.get(profileId);

    if (!profileInfo) {
      // Jika force = true meskipun profil tidak ada di memori aktif (misal setelah server di-restart atau browser crash),
      // tetap bersihkan pekerjaan yang macet di DB untuk akun ini dan pulihkan status akun menjadi available!
      if (force) {
        try {
          await pool.execute(
            "UPDATE video_jobs SET status = 'cancelled', progress = 0, error_message = 'Job cancelled due to forced profile reset', updated_at = NOW() WHERE account_id = ? AND status IN ('preparing', 'running', 'downloading', 'awaiting_user', 'paused')",
            [profileId]
          );
          await updateAccountStatus(profileId, 'available');
          return { success: true, message: 'Browser tidak berjalan di memori. Pekerjaan yang macet pada akun ini telah dibatalkan di database dan status dipulihkan.' };
        } catch (dbErr: any) {
          return { success: false, message: `Gagal membatalkan job macet: ${dbErr.message}` };
        }
      }
      return { success: false, message: 'Profile not running' };
    }

    const currentJobId = this.getActiveJobId(profileId);

    // Jangan tutup browser jika masih ada pekerjaan aktif yang memakai profil ini, kecuali jika force = true
    if (activeJobs.has(profileId) && !force) {
      return { success: false, message: 'Profile is in use by active job', activeJobId: currentJobId };
    }

    // Jika force = true atau sedang menutup profil, batalkan runtime job dan update DB
    if (force) {
      if (currentJobId) {
        try {
          const { requestJobCancellation, cancelJob } = await import('./browserWorker.js');
          requestJobCancellation(currentJobId);
          cancelJob(currentJobId);
        } catch {}
      }

      // Update status job di DB menjadi 'cancelled'
      try {
        await pool.execute(
          "UPDATE video_jobs SET status = 'cancelled', progress = 0, error_message = 'Job cancelled due to browser closing', updated_at = NOW() WHERE account_id = ? AND status IN ('preparing', 'running', 'downloading', 'awaiting_user', 'paused')",
          [profileId]
        );
      } catch (dbErr: any) {
        console.warn(`[BrowserManager] Failed to update jobs to cancelled on close for profile ${profileId}:`, dbErr.message);
      }

      // Tunggu hingga worker melepaskan lock secara aman (maksimal 3 detik)
      let waited = 0;
      while (activeJobs.has(profileId) && waited < 3000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      activeJobs.delete(profileId);
    }

    try {
      if (profileInfo.context) {
        await profileInfo.context.close();
      }

      activeProfiles.delete(profileId);
      activeJobs.delete(profileId);

      // Update DB status: restore ke 'available' jika profil sebelumnya valid atau berjalan
      const account = await getAccountFromDb(profileId);
      const targetStatus = (account && ['busy', 'available'].includes(account.status)) ? 'available' : (account?.status || 'available');
      await updateAccountStatus(profileId, targetStatus);

      console.log(`[BrowserManager] Profile ${profileId} closed`);
      return { success: true, message: 'Browser closed successfully' };

    } catch (err: any) {
      console.error(`[BrowserManager] Error closing profile ${profileId}:`, err);
      // Periksa apakah context masih terbuka sebelum menghapus registry
      let stillOpen = false;
      try {
        if (profileInfo.context && profileInfo.context.pages().length > 0) {
          stillOpen = true;
        }
      } catch {
        stillOpen = false;
      }

      if (!stillOpen) {
        activeProfiles.delete(profileId);
        activeJobs.delete(profileId);
      }
      return { success: false, message: `Error closing browser: ${err.message}` };
    }
  }

  async acquireProfileForJob(profileId: number, jobId?: number): Promise<{ success: boolean; message?: string; profileInfo?: ProfileInfo | null }> {
    // Cek apakah profil sudah berjalan (sudah dibuka)
    const isRunning = this.isProfileRunning(profileId);

    // Jika belum berjalan, coba launch terlebih dahulu
    if (!isRunning) {
      const launchResult = await this.launchProfile(profileId);
      if (!launchResult.success) {
        return { success: false, message: launchResult.message };
      }
    }

    // Tandai profil sedang digunakan oleh pekerjaan (dengan jobId jika tersedia)
    activeJobs.set(profileId, jobId !== undefined ? jobId : true);

    const profileInfo = this.getProfileInfo(profileId);
    if (!profileInfo || !profileInfo.page) {
      activeJobs.delete(profileId);
      return { success: false, message: 'Profile info missing after launch' };
    }

    // Periksa apakah page masih valid dan belum ditutup
    try {
      const pages = profileInfo.context?.pages() || [];
      if (pages.length === 0 || pages[0].isClosed()) {
        const newPage = await profileInfo.context?.newPage();
        if (newPage) {
          profileInfo.page = newPage;
        } else {
          activeJobs.delete(profileId);
          return { success: false, message: 'Cannot open new page on context' };
        }
      } else {
        profileInfo.page = pages[0];
      }
    } catch (pageErr: any) {
      activeJobs.delete(profileId);
      return { success: false, message: `Page not valid: ${pageErr.message}` };
    }

    return { success: true, message: 'Profile acquired for job', profileInfo };
  }

  async releaseProfileForJob(profileId: number): Promise<void> {
    activeJobs.delete(profileId);
    // Tidak menutup browser — biarkan terbuka untuk reuse oleh pekerjaan berikutnya
  }

  isProfileInUse(profileId: number): boolean {
    return activeJobs.has(profileId);
  }

  getActiveJobId(profileId: number): number | null {
    const val = activeJobs.get(profileId);
    return typeof val === 'number' ? val : null;
  }

  registerJobPage(jobId: number, page: Page, initialContext?: string): void {
    jobPages.set(jobId, page);
    pageJobMap.set(page, jobId);
    if (initialContext) jobContextMap.set(jobId, initialContext);
    console.log(`[BrowserManager] Registered page for job #${jobId}`);
  }

  unregisterJobPage(jobId: number): void {
    const page = jobPages.get(jobId);
    if (page) pageJobMap.delete(page);
    jobPages.delete(jobId);
    jobContextMap.delete(jobId);
    console.log(`[BrowserManager] Unregistered page for job #${jobId}`);
  }

  getJobPage(jobId: number): Page | null {
    return jobPages.get(jobId) || null;
  }

  getJobIdByPage(page: Page | null | undefined): number | null {
    if (!page) return null;
    return pageJobMap.get(page) || null;
  }

  getJobContextSnapshot(jobId: number): string | null {
    return jobContextMap.get(jobId) || null;
  }
  
  async checkLoginStatus(profileId: number): Promise<{ success?: boolean; accountId?: number; checkedAt?: string; status: string; message?: string; diagnosticReason?: string }> {
    const profileInfo = activeProfiles.get(profileId);
    
    if (!profileInfo || !profileInfo.page) {
      // Try to get from DB
      const account = await getAccountFromDb(profileId);
      if (account) {
        return { 
          status: account.status, 
          message: 'From database (browser not running)',
          accountId: profileId,
          checkedAt: new Date().toISOString()
        };
      }
      return { status: 'unconfigured', message: 'Profile not found' };
    }
    
    try {
      // Ensure we're still on a valid page
      const isValidContext = profileInfo.context && !profileInfo.context.pages().length;
      const pages = profileInfo.context?.pages() || [];
      
      // Re-check pages to ensure we're looking at an active one
      let activePage = profileInfo.page;
      if (pages.length > 0) {
        activePage = pages[pages.length - 1] || profileInfo.page;
        profileInfo.page = activePage;
      }

      const result = await checkLoginStatusOnPage(activePage);

      // Collect diagnostic info
      const diagnostic: string[] = [];
      diagnostic.push(`profile_id=${profileId}`);
      diagnostic.push(`context_active=${profileInfo.context ? 'yes' : 'no'}`);
      diagnostic.push(`pages_count=${pages.length}`);
      diagnostic.push(`url=${activePage.url()}`);
      
      try {
        const loadState = await activePage.evaluate(() => {
          try {
            return (globalThis as any).document.readyState;
          } catch {
            return 'unknown';
          }
        }).catch(() => 'unknown');
              diagnostic.push(`load_state=${loadState}`);
            } catch {
              diagnostic.push(`load_state=unknown`);
            }

      diagnostic.push(`check_result=${result.status}`);

      console.log(`[BrowserManager] Check login for profile ${profileId}: ${diagnostic.join(', ')}`);

      // Update DB if status changed
      if (result.status !== profileInfo.status) {
        await updateAccountStatus(profileId, result.status, result.message);
        profileInfo.status = result.status;
      }
      
      return {
        success: true,
        accountId: profileId,
        checkedAt: new Date().toISOString(),
        status: result.status,
        message: result.message,
        diagnosticReason: result.status === 'unknown' ? diagnostic.join('; ') : undefined
      };
    } catch (err: any) {
      console.error(`[BrowserManager] Error checking login for ${profileId}:`, err);
      await updateAccountStatus(profileId, 'error', err.message);
      return { 
        success: false,
        accountId: profileId,
        checkedAt: new Date().toISOString(),
        status: 'error', 
        message: `Check failed: ${err.message}` 
      };
    }
  }
  
  isProfileRunning(profileId: number): boolean {
    return activeProfiles.has(profileId);
  }
  
  getProfileInfo(profileId: number): ProfileInfo | null {
    return activeProfiles.get(profileId) || null;
  }
}

export const browserProfileManager = new BrowserProfileManagerImpl();