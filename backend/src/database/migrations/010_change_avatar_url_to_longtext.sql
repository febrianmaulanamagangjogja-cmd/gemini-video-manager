-- Migration: Change avatar_url in app_users to LONGTEXT to support Base64 images
ALTER TABLE `app_users` MODIFY COLUMN `avatar_url` LONGTEXT NULL;
