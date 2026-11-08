# Arsitektur & Desain Gemini Video Manager

## Ringkasan Sistem
Gemini Video Manager mengelola pembuatan video via Gemini Web tanpa mengandalkan Gemini API video.

## Komponen Utama
1. **Frontend (React + Vite + Tailwind + Socket.IO)**
   - Dashboard statistik real-time
   - Form pembuatan video (upload gambar + prompt + batch count)
   - Manajemen antrean (Pause/Resume/Cancel)
   - Manajemen akun browser (Profile session status & account rotation counters)
   - Riwayat video & pemutar video

2. **Backend (Node.js + Express + TypeScript + Socket.IO)**
   - REST API
   - Persistent MySQL Queue Engine
   - Account Rotation Manager (Max 3 successful jobs per account before soft-rotation)
   - Browser Worker Manager (Playwright Persistent Contexts)
   - Demo Mode Adapter (untuk simulasi/testing terisolasi)

3. **Database (MySQL/MariaDB XAMPP)**
   - `gemini_accounts`: Melacak profil browser persistent, status login, statistik & cooldown
   - `video_jobs`: Menyimpan prompt, referensi gambar, status, progress, & path output video
   - `video_assets`: Menyimpan aset terkait job
   - `job_logs`: Event log audit trail per perubahan status job

4. **Browser Automation Layer (Playwright)**
   - Adapter terisolasi untuk Gemini Web
   - Penggunaan persistent context per akun agar tidak perlu re-login
   - Penanganan error, modal detection, & detection fallback
