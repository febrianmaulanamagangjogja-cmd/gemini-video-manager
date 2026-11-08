-- Migration: 002_create_video_jobs_table.sql
-- Tabel utama untuk pekerjaan pembuatan video

CREATE TABLE IF NOT EXISTS `video_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `prompt` TEXT NOT NULL COMMENT 'Prompt teks untuk generasi video',
    `reference_image_path` VARCHAR(500) NULL COMMENT 'Path file gambar referensi (opsional)',
    `account_id` BIGINT UNSIGNED NULL COMMENT 'Akun browser yang dipakai (NULL = belum ditugaskan)',
    `status` ENUM('queued', 'preparing', 'running', 'downloading', 'completed', 'failed', 'paused', 'cancelled') NOT NULL DEFAULT 'queued' COMMENT 'Status eksekusi pekerjaan',
    `progress` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Persentase progress (0-100)',
    `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Jumlah percobaan eksekusi',
    `output_video_path` VARCHAR(500) NULL COMMENT 'Path file video hasil download',
    `error_message` TEXT NULL COMMENT 'Pesan error jika gagal',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `started_at` DATETIME NULL COMMENT 'Waktu mulai eksekusi',
    `completed_at` DATETIME NULL COMMENT 'Waktu selesai (berhasil/gagal)',
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`account_id`) REFERENCES `gemini_accounts`(`id`) ON DELETE SET NULL,
    INDEX `idx_status` (`status`),
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Antrean pekerjaan pembuatan video';