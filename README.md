# Gemini Video Manager

Aplikasi web untuk mengelola pembuatan video melalui antarmuka browser Gemini Web secara otomatis dan terstruktur menggunakan Playwright.

## 🚀 Status Proyek
Fokus proyek saat ini adalah deployment berbasis website HTTPS (menggantikan versi desktop Electron). Aplikasi telah diuji secara menyeluruh di lingkungan **Windows (XAMPP/MySQL)** dan siap untuk dideploy ke **VPS Linux** (Nginx + SSL).

## ✨ Fitur Utama
- **Autentikasi & RBAC:** Login/Register dengan role `user` dan `admin`.
- **Dashboard:** Pemantauan status pekerjaan video secara real-time.
- **Admin Panel:** Manajemen akun pengguna, pengaturan sistem, dan audit logs.
- **Video Automation:** Pembuatan video via Gemini Web dengan prompt & gambar referensi.
- **Otomasi Browser:** Manajemen profil browser yang persisten via Playwright.
- **Job System:** Antrean pekerjaan dengan fitur retry, pembatalan, dan pemulihan otomatis.
- **Storage Management:** Pengelolaan upload gambar dan hasil video terstruktur.

## 🛠️ Tech Stack
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Zustand.
- **Backend:** Node.js, Express, TypeScript, mysql2, Playwright.
- **Real-time:** Socket.IO untuk update status pekerjaan.
- **Database:** MySQL / MariaDB.

## 📖 Dokumentasi
- [Panduan Instalasi (Development)](docs/INSTALLATION.md)
- [Panduan Deployment (VPS Linux)](DEPLOYMENT.md)

## ⚠️ Batasan & Catatan
- **Bukan Gemini API:** Pembuatan video dilakukan via otomasi browser pada Gemini Web.
- **Persyaratan Akun:** Pengguna wajib login ke akun Gemini pada profil browser yang disediakan sistem.
- **Koneksi:** Membutuhkan akses internet stabil untuk interaksi dengan Gemini.

## 📜 Lisensi
Lisensi belum ditentukan. Hak cipta milik pemilik proyek.

<file|separator>
<file>frontend/dist/index.html<file>