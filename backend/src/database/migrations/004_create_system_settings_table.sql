-- Migration: 004_create_system_settings_table.sql
-- Tabel untuk menyimpan konfigurasi sistem global

CREATE TABLE IF NOT EXISTS `system_settings` (
    `key` VARCHAR(100) NOT NULL PRIMARY KEY,
    `value` LONGTEXT NOT NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial default settings
INSERT IGNORE INTO `system_settings` (`key`, `value`) VALUES 
('auto_retry', 'false'),
('max_retries', '3'),
('download_timeout', '30'),
('cache_clean_interval', '60'),
('validate_video_integrity', 'true');
