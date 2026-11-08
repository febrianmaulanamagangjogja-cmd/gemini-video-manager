-- Migration: Add user_settings table for isolated user automation & download settings
CREATE TABLE IF NOT EXISTS `user_settings` (
    `user_id` BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    `auto_retry` BOOLEAN NOT NULL DEFAULT FALSE,
    `max_retries` INT NOT NULL DEFAULT 3,
    `download_timeout` INT NOT NULL DEFAULT 30,
    `cache_clean_interval` INT NOT NULL DEFAULT 60,
    `validate_video_integrity` BOOLEAN NOT NULL DEFAULT TRUE,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Pengaturan otomasi & unduhan terisolasi per user';
