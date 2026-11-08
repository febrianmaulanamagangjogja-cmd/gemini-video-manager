-- Migration: 006_add_aspect_ratio_column.sql
-- Menambahkan kolom aspect_ratio ke tabel video_jobs dengan default '9:16'

ALTER TABLE `video_jobs`
ADD COLUMN `aspect_ratio` ENUM('9:16', '16:9') NOT NULL DEFAULT '9:16' AFTER `reference_image_path`;
