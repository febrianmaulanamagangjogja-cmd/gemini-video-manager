-- Migration: 003_create_video_assets_table.sql
-- Tabel untuk melacak aset file (gambar referensi & video hasil)

CREATE TABLE IF NOT EXISTS `video_assets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` BIGINT UNSIGNED NOT NULL COMMENT 'Pekerjaan terkait',
    `asset_type` ENUM('reference_image', 'output_video', 'thumbnail') NOT NULL COMMENT 'Jenis aset',
    `file_path` VARCHAR(500) NOT NULL COMMENT 'Path relatif atau absolut file',
    `mime_type` VARCHAR(100) NULL COMMENT 'MIME type file',
    `file_size` BIGINT UNSIGNED NULL COMMENT 'Ukuran file dalam bytes',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`job_id`) REFERENCES `video_jobs`(`id`) ON DELETE CASCADE,
    INDEX `idx_job_id` (`job_id`),
    INDEX `idx_asset_type` (`asset_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Aset file terkait pekerjaan video';