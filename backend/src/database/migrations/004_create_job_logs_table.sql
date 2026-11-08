-- Migration: 004_create_job_logs_table.sql
-- Tabel audit trail untuk riwayat perubahan status pekerjaan

CREATE TABLE IF NOT EXISTS `job_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` BIGINT UNSIGNED NOT NULL COMMENT 'Pekerjaan terkait',
    `account_id` BIGINT UNSIGNED NULL COMMENT 'Akun yang memproses (opsional)',
    `level` ENUM('info', 'warning', 'error', 'debug') NOT NULL DEFAULT 'info' COMMENT 'Level log',
    `event` VARCHAR(100) NOT NULL COMMENT 'Nama event (status_change, retry, error, download_start, etc)',
    `message` TEXT NOT NULL COMMENT 'Deskripsi detail event',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`job_id`) REFERENCES `video_jobs`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `gemini_accounts`(`id`) ON DELETE SET NULL,
    INDEX `idx_job_id` (`job_id`),
    INDEX `idx_account_id` (`account_id`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_event` (`event`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log audit trail pekerjaan video';