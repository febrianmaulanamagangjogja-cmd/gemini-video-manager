import { pool } from '../database/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class DemoWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 5000; // Check every 5 seconds
  private stuckThresholdMs = 30 * 1000; // Consider job stuck if not updated for 30 seconds

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[DemoWorker] Started simulation worker loop.');
    // Reset any stuck jobs on start
    this.resetStuckJobs().catch(console.error);
    this.timer = setInterval(async () => {
      await this.processNextJob();
    }, this.intervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    if (this.timer) clearInterval(this.timer);
    this.isRunning = false;
    console.log('[DemoWorker] Stopped simulation worker loop.');
  }

  private async resetStuckJobs() {
    const connection = await pool.getConnection();
    try {
      const now = new Date();
      const stuckTime = new Date(now.getTime() - this.stuckThresholdMs);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE video_jobs 
         SET status = 'queued', progress = 0, updated_at = NOW() 
         WHERE status IN ('preparing', 'running', 'downloading') 
         AND updated_at < ?`,
        [stuckTime]
      );
      const affected = result.affectedRows;
      if (affected > 0) {
        console.log(`[DemoWorker] Reset ${affected} stuck job(s) to queued.`);
        // Insert log for each reset? We'll just log generally.
        await connection.execute(
          `INSERT INTO job_logs (job_id, account_id, level, event, message) 
           SELECT id, account_id, 'info', 'job_reset', CONCAT('Job reset due to stuck in status: ', status) 
           FROM video_jobs 
           WHERE status IN ('preparing', 'running', 'downloading') 
           AND updated_at < ?`,
          [stuckTime]
        );
      }
    } catch (err) {
      console.error('[DemoWorker] Error resetting stuck jobs:', err);
    } finally {
      connection.release();
    }
  }

  private async processNextJob() {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Find one queued job with row lock (SKIP LOCKED)
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, prompt, reference_image_path, account_id, attempt_count 
         FROM video_jobs 
         WHERE status = 'queued' 
         ORDER BY created_at ASC 
         LIMIT 1 FOR UPDATE`
      );

      if (rows.length === 0) {
        await connection.commit();
        return;
      }

      const job = rows[0];
      const jobId = job.id;
      console.log(`[DemoWorker] Processing job #${jobId}: "${job.prompt}"`);

      // 1. Update to preparing
      await connection.execute(
        `UPDATE video_jobs SET status = 'preparing', progress = 10, started_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [jobId]
      );
      await this.addLog(connection, jobId, null, 'info', 'job_preparing', `Job #${jobId} started preparation in Demo Mode.`);

      await connection.commit();

      // Simulate steps with slight delays outside transaction
      await this.sleep(2000);

      // 2. Update to running
      await this.updateJobStatus(jobId, 'running', 50, 'Job is being simulated by DemoWorker.');
      await this.addLogStandalone(jobId, null, 'info', 'job_running', `Job #${jobId} simulation running...`);

      await this.sleep(3000);

      // 3. Update to downloading
      await this.updateJobStatus(jobId, 'downloading', 90, 'Downloading simulated output video.');
      await this.addLogStandalone(jobId, null, 'info', 'job_downloading', `Job #${jobId} simulated video asset ready.`);

      await this.sleep(1500);

      // 4. Complete job
      const simulatedOutputVideo = `/storage/outputs/simulated_video_${jobId}.mp4`;
      const conn2 = await pool.getConnection();
      try {
        await conn2.beginTransaction();
        await conn2.execute(
          `UPDATE video_jobs SET status = 'completed', progress = 100, output_video_path = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
          [simulatedOutputVideo, jobId]
        );
        // Insert output asset
        await conn2.execute(
          `INSERT INTO video_assets (job_id, asset_type, file_path, mime_type, file_size) VALUES (?, 'output_video', ?, 'video/mp4', 1048576)`,
          [jobId, simulatedOutputVideo]
        );
        await this.addLog(conn2, jobId, null, 'info', 'job_completed', `Job #${jobId} completed successfully in Demo Mode.`);
        await conn2.commit();
        console.log(`[DemoWorker] Job #${jobId} completed successfully.`);
      } catch (err) {
        await conn2.rollback();
        throw err;
      } finally {
        conn2.release();
      }

    } catch (err: any) {
      await connection.rollback();
      console.error('[DemoWorker] Error processing job:', err);
      // Optionally mark job as failed?
    } finally {
      connection.release();
    }
  }

  private async updateJobStatus(jobId: number, status: string, progress: number, message: string) {
    await pool.execute(
      `UPDATE video_jobs SET status = ?, progress = ?, updated_at = NOW() WHERE id = ?`,
      [status, progress, jobId]
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

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const demoWorker = new DemoWorker();
