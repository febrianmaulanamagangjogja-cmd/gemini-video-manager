-- Migration: 005_create_app_users_table.sql
-- Tabel untuk autentikasi pengguna aplikasi (terpisah dari gemini_accounts)

CREATE TABLE IF NOT EXISTS `app_users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL UNIQUE COMMENT 'Username unik untuk login',
    `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash password menggunakan bcrypt',
    `role` VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT 'Role pengguna',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Status aktif akun',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabel pengguna aplikasi untuk autentikasi login';

-- Tabel session untuk menyimpan session login di database
CREATE TABLE IF NOT EXISTS `app_sessions` (
    `id` VARCHAR(128) NOT NULL PRIMARY KEY,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE,
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tabel session server-side';
