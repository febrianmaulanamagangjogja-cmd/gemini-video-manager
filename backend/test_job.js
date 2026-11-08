import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gemini_video_manager'
});

async function insertTestJob() {
  try {
    const [result] = await connection.execute(
      `INSERT INTO video_jobs (status, prompt, created_at) VALUES ('queued', 'Test job for browser worker', NOW())`
    );
    console.log('Inserted job ID:', result.insertId);
  } catch (err) {
    console.error('Error inserting test job:', err);
  } finally {
    await connection.end();
  }
}

insertTestJob();