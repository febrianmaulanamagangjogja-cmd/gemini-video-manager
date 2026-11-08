-- Migration: 008_create_admin_audit_logs_table.sql
-- Tabel untuk mencatat riwayat aktivitas administratif

CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_id` BIGINT UNSIGNED NOT NULL COMMENT 'ID user admin yang melakukan aksi',
    `action` VARCHAR(100) NOT NULL COMMENT 'Jenis aksi (e.g., CREATE_USER, UPDATE_ROLE, TOGGLE_STATUS, RESET_PASSWORD)',
    `target_id` BIGINT UNSIGNED NULL COMMENT 'ID user sasaran jika ada',
    `details` TEXT NULL COMMENT 'Detail deskripsi aksi dalam format teks atau JSON',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_actor_id` (`actor_id`),
    INDEX `idx_action` (`action`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log aktivitas administrasi';