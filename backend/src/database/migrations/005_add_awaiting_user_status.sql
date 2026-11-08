-- Migration: 005_add_awaiting_user_status.sql
-- Menambahkan status 'awaiting_user' ke ENUM video_jobs

ALTER TABLE `video_jobs` 
MODIFY COLUMN `status` ENUM('queued', 'preparing', 'running', 'downloading', 'completed', 'failed', 'paused', 'cancelled', 'awaiting_user') NOT NULL DEFAULT 'queued' COMMENT 'Status eksekusi pekerjaan';
