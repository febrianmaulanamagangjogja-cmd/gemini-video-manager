-- Migration: 001_create_gemini_accounts_table.sql
-- Tabel untuk menyimpan browser profiles yang diotorisasi untuk Gemini Web

CREATE TABLE IF NOT EXISTS `gemini_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT 'Nama akun yang mudah dikenali',
    `profile_path` VARCHAR(500) NOT NULL COMMENT 'Path absolut ke direktori browser profile Playwright',
    `status` ENUM('unconfigured', 'available', 'busy', 'limited', 'cooldown', 'error', 'disabled') NOT NULL DEFAULT 'unconfigured' COMMENT 'Status operasi akun',
    `completed_job_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total pekerjaan selesai oleh akun ini sejak rotasi terakhir',
    `total_job_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total pekerjaan seluruh waktu',
    `last_used_at` DATETIME NULL COMMENT 'Waktu terakhir akun digunakan untuk job',
    `cooldown_until` DATETIME NULL COMMENT 'Waktu hingga cooldown berakhir',
    `last_error` TEXT NULL COMMENT 'Pesan error terakhir jika status error',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_profile_path` (`profile_path`),
    INDEX `idx_status` (`status`),
    INDEX `idx_completed_job_count` (`completed_job_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Browser profiles yang memiliki sesi login Gemini Web';