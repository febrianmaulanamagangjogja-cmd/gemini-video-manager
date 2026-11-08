-- Seed demo account if no accounts exist
INSERT INTO `gemini_accounts` (`id`, `name`, `profile_path`, `status`, `completed_job_count`, `total_job_count`)
SELECT 1, 'Demo Account 1', 'browser-profiles/demo-profile-1', 'available', 0, 0
WHERE NOT EXISTS (SELECT 1 FROM `gemini_accounts` WHERE `id` = 1);
