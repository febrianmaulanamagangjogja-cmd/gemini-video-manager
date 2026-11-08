-- Migration: Add avatar_url to app_users
ALTER TABLE `app_users` ADD COLUMN `avatar_url` VARCHAR(255) NULL AFTER `role`;
