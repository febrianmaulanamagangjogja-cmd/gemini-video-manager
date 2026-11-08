-- Migration: 009_add_user_id_and_website_settings.sql
-- 1. Add user_id column to gemini_accounts
ALTER TABLE `gemini_accounts` 
ADD COLUMN `user_id` BIGINT UNSIGNED NULL AFTER `id`,
ADD CONSTRAINT `fk_gemini_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE;

-- 2. Add user_id column to video_jobs
ALTER TABLE `video_jobs` 
ADD COLUMN `user_id` BIGINT UNSIGNED NULL AFTER `id`,
ADD CONSTRAINT `fk_video_jobs_user` FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON DELETE CASCADE;

-- 3. Associate all existing unassigned accounts and jobs with the first admin user
UPDATE `gemini_accounts` 
SET `user_id` = (SELECT `id` FROM `app_users` WHERE `role` = 'admin' ORDER BY `id` ASC LIMIT 1)
WHERE `user_id` IS NULL;

UPDATE `video_jobs` 
SET `user_id` = (SELECT `id` FROM `app_users` WHERE `role` = 'admin' ORDER BY `id` ASC LIMIT 1)
WHERE `user_id` IS NULL;

-- 4. Add system settings for website branding
INSERT IGNORE INTO `system_settings` (`key`, `value`) VALUES 
('website_name', 'Gemini Video Manager'),
('website_icon', '');
