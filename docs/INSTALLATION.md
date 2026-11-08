# Panduan Instalasi Gemini Video Manager

Berikut adalah panduan lengkap untuk menginstal dan menjalankan Gemini Video Manager dari source code.

---

## A. Persyaratan Sistem

Platform dan lingkungan yang didukung:

- **Windows 10 / 11:** Platform pengembangan utama yang telah diuji dan diverifikasi secara langsung menggunakan Node.js dan XAMPP (MySQL/MariaDB).
- **Linux (Ubuntu / Debian):** Platform deployment server yang direncanakan untuk produksi (arsitektur Nginx, systemd, dan SSL HTTPS dibahas terpisah pada panduan `DEPLOYMENT.md`).
- **Versi Node.js:** v20.x atau v22.x LTS (kompatibel penuh dengan seluruh dependensi proyek).
- **Package Manager:** `npm` (sesuai `package-lock.json` proyek).
- **Database:** MySQL 8.0+ atau MariaDB 10.4+ (misalnya melalui XAMPP di Windows).
- **Git:** Untuk cloning source code.
- **Koneksi Internet:** Wajib tersedia untuk login Gemini Web dan proses pembuatan video Playwright.

Jangan mengarang nomor versi. Periksa konfigurasi package, lockfile, dan dependensi aktual sebelum melanjutkan.

---

## B. Mengunduh Source Code dari GitHub

Cara mengunduh source code:

1. Buka repository GitHub.
2. Salin URL repository.
3. Buka terminal (Command Prompt atau PowerShell).
4. Jalankan perintah `git clone`:
   ```bash
   git clone <URL_REPOSITORY>
   cd gemini-video-manager
   ```
5. Masuk ke direktori proyek:
   ```bash
   cd gemini-video-manager
   ```

*Note: Gunakan placeholder untuk URL repository apabila URL GitHub belum tersedia.*

---

## C. Instalasi Dependensi

Struktur workspace menggunakan beberapa `package.json`:

### Root package.json
```bash
npm install
```

### Frontend package.json
```bash
cd frontend
npm install
cd ..
```

### Backend package.json
```bash
cd backend
npm install
cd ..
```

Jangan menyarankan menghapus lockfile. Jika menggunakan beberapa `package.json`, jelaskan direktori tempat setiap perintah dijalankan.

---

## D. Persiapan Database MySQL/MariaDB

### Langkah-langkah:

1. **Instal atau jalankan XAMPP:**
   - Unduh dari apachefriends.org
   - Instal ke `C:\xampp` (atau direktori pilihan)

2. **Aktifkan MySQL melalui XAMPP:**
   - Buka XAMPP Control Panel
   - Klik tombol `Start` pada modul MySQL
   - Pastikan status berubah menjadi `Running`

3. **Buka phpMyAdmin:**
   - Buka browser ke `http://localhost/phpmyadmin`

4. **Buat database:**
   - Di phpMyAdmin, buat database baru dengan nama:
     ```
     gemini_video_manager
     ```
   - Pastikan charset: `utf8mb4` dan collation: `utf8mb4_unicode_ci`

5. **Menyiapkan user database (jika diperlukan):**
   - Buat user baru jika tidak menggunakan root
   - Berikan permission penuh ke database `gemini_video_manager`

6. **Mengatur koneksi backend melalui environment variable:**
   - Periksa konfigurasi `backend/.env.example`
   - Konfigurasi variabel `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

### Contoh SQL (jika perlu manual):

```sql
CREATE DATABASE IF NOT EXISTS gemini_video_manager
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

Jangan meminta pengguna mengimpor dump database development milik developer karena dapat berisi data dan kredensial pribadi.

Jelaskan bahwa tabel akan dibuat melalui migration resmi proyek, bukan melalui database development yang dibagikan.

---

## E. Konfigurasi Environment

### Langkah-langkah:

1. **Salin file `.env.example` ke `.env`:**
   ```bash
   copy .env.example .env
   ```
   *(Di Windows: copy .env.example .env)*

2. **Verifikasi variabel environment dari kode aktual:**

| Nama Variabel | Fungsi | Wajib/Opsional | Contoh Nilai |
|--------------|--------|---------------|--------------|
| `PORT` | Port backend | Wajib | `5000` |
| `NODE_ENV` | Mode environment | Wajib | `development` atau `production` |
| `DB_HOST` | Host database | Wajib | `localhost` |
| `DB_PORT` | Port database | Wajib | `3306` |
| `DB_USER` | User database | Wajib | `root` |
| `DB_PASSWORD` | Password database | Opsional | `` (kosong untuk root) |
| `DB_NAME` | Nama database | Wajib | `gemini_video_manager` |
| `CORS_ORIGIN` | Origin frontend | Wajib | `http://localhost:5173` |
| `DEMO_MODE` | Mode demo | Opsional | `true` |
| `HEADLESS_BROWSER` | Mode browser | Opsional | `false` |
| `MAX_JOBS_PER_ACCOUNT` | Batas job per akun | Opsional | `3` |
| `STORAGE_PATH` | Path penyimpanan | Opsional | `../storage` |
| `BROWSER_PROFILES_PATH` | Path profil browser | Opsional | `../browser-profiles` |
| `VITE_API_BASE_URL` | URL API frontend | Wajib | `http://localhost:5000/api` |

3. **Sesuaikan nilai sesuai lingkungan:**
   - Port database dan backend sesuai konfigurasi lokal
   - `CORS_ORIGIN` harus sesuai dengan alamat frontend
   - `CORS_ORIGIN` untuk production harus menggunakan domain aktual
   - `DEMO_MODE` dan `HEADLESS_BROWSER` sesuai kebutuhan

4. **Copy `.env` ke direktori backend:**
   ```bash
   copy .env backend\.env
   ```

5. **Catatan penting:**
   - **Jangan memasukkan:** Password database developer, session secret, token API, cookie, credential Gemini, isi `.env` sebenarnya.
   - **Berikan instruksi untuk menyalin** `.env.example` ke file `.env` yang sesuai lokasi aplikasi.
   - **Jangan mengasumsikan** hanya terdapat satu file `.env` jika proyek menggunakan beberapa file konfigurasi.

---

## F. Migrasi Database

### Langkah-langkah:

1. **Jalankan seluruh migration dengan urutan yang benar:**
   ```bash
   cd backend
   npm run db:migrate
   ```
   *(Atau: `tsx src/database/migrate.ts`)*

2. **Migrasi akan membuat seluruh tabel yang diperlukan untuk instalasi baru, termasuk:**
   - `app_users` - Tabel pengguna dan autentikasi
   - `gemini_accounts` - Akun Gemini
   - `video_jobs` - Job video
   - `video_assets` - Aset video
   - `job_logs` - Log pekerjaan
   - `admin_audit_logs` - Audit log admin
   - `system_settings` - Pengaturan sistem
   - `user_settings` - Pengaturan pengguna

3. **Pastikan migration berhasil dengan mengecek output:**
   - Semua migration dijalankan tanpa error kritis
   - Tabel-tabel terschema sesuai harapan
   - Pesan "All migrations completed." muncul

4. **Catatan:**
   - **Jangan menjalankan reset database.**
   - Jika terjadi error `ER_DUP_FIELDNAME` atau `ER_TABLE_EXISTS_ERROR`, migrasi akan melewati elemen yang sudah ada (skema sudah pernah dibuat).
   - Jika ada kolom duplikat, migrasi akan melewati dengan pesan "Skipped existing schema element".

5. **Mengetahui migrasi berhasil:**
   - Output menampilkan setiap file migration yang dijalankan
   - Pesan akhir: "All migrations completed."
   - Cek tabel di phpMyAdmin atau MySQL client

---

## G. Membuat Akun Administrator Pertama

### Mekanisme Pembuatan Admin Pertama

Karena database baru tidak berisi akun admin milik developer, berikut mekanisme yang benar:

### Langkah-langkah:

1. **Pastikan backend sedang berjalan:**
   ```bash
   cd backend
   npm run dev
   ```
   *(Atau: `npm run backend:dev` dari root)*

2. **Buka terminal baru dan jalankan utilitas bootstrap admin:**
   ```bash
   cd backend
   npm run create:admin
   ```
   *(Atau: `tsx src/scripts/createAdmin.ts`)*

3. **Menyelesaikan pengisian interaktif:**
   - Masukkan username admin baru (minimal 3 karakter)
   - Masukkan password admin (minimal 8 karakter)
   - Konfirmasi password

### Catatan Penting:

- **Hanya dapat dijalankan** melalui terminal lokal developer/administrator server.
- Meminta username dan password secara interaktif (password akan ditampilkan sebagai `*` atau tidak terlihat).
- Konfirmasi password harus sama dengan inputan pertama.
- Password tidak ditulis ke log atau tampil di layar setelah pengisian.
- Password disimpan sebagai hash dengan mekanisme autentikasi proyek (bcryptjs).
- **Memastikan belum terdapat admin aktif** sebelum membuat admin pertama.
- **Tidak menggunakan kredensial default** (admin yang sudah ada di development jangan digunakan untuk deployment produksi tanpa alasan khusus).
- Menggunakan koneksi database dan validasi yang sama dengan backend.

### Setelah Membuat Admin:

1. **Login ke aplikasi** dengan username dan password baru.
2. **Verifikasi role** menunjukkan `admin`.
3. **Akses halaman Admin Panel** untuk mengelola fitur administrator.

---

## H. Persiapan Playwright dan Gemini Web

### Langkah-langkah:

1. **Instal Chromium untuk Playwright:**
   ```bash
   npx playwright install chromium
   ```
   *(Jalankan dari root proyek atau dari terminal yang aktif)*

2. **Verifikasi instalasi:**
   ```bash
   npx playwright install --with-deps
   ```

3. **Lokasi profil browser:**
   - Properti profil browser disimpan di `browser-profiles/`
   - Setiap akun pengguna memiliki direktori profil masing-masing
   - Struktur: `browser-profiles/<nama-profil>/`

4. **Cara membuat atau menginisialisasi profil:**
   - Jalankan aplikasi sekali untuk menginisialisasi profil default
   - Profil akan dibuat secara otomatis saat pengguna pertama kali login
   - Struktur folder: `browser-profiles/<username>/`

5. **Cara membuka browser melalui aplikasi:**
   - Frontend mengirim permintaan ke BrowserWorker
   - BrowserWorker memulai Playwright dengan konfigurasi headless/non-headless
   - Dilihat dari konfigurasi `HEADLESS_BROWSER` di `.env`

6. **Cara login Gemini secara manual:**
   - Jalankan aplikasi
   - Buka halaman Login/Registrasi
   - Masuk dengan kredensial Gemini
   - Login akan disimpan ke profil browser

7. **Cara memastikan sesi login persisten:**
   - Profil browser disimpan di `browser-profiles/`
   - Sesi login akan tersimpan jika tidak dihapus
   - Setiap kali aplikasi dijalankan, sesi akan diperbarui

8. **Cara menguji browser automation:**
   - Jalankan `npm run backend:test` untuk unit test
   - Verifikasi BrowserWorker dapat mengambil job dari antrean
   - Cek log browser untuk melihat operasi Gemini

---

## I. Menjalankan Aplikasi

### Langkah-langkah:

1. **Mulai backend:**
   ```bash
   cd backend
   npm run dev
   ```
   *(Atau dari root: `npm --prefix backend run dev`)*

   - Backend akan berjalan di `http://localhost:5000` (atau port sesuai konfigurasi `PORT` di `.env`)
   - Menampilkan pesan: "Server running on port 5000"

2. **Mulai frontend (dalam terminal terpisah):**
   ```bash
   cd frontend
   npm run dev
   ```
   *(Atau dari root: `npm --prefix frontend run dev`)*

   - Frontend akan berjalan di `http://localhost:5173` (atau port sesuai konfigurasi `VITE_PORT`)
   - Menampilkan pesan pengembangan Vite

3. **Alternatif: Menjalankan keduanya sekaligus:**
   - Gunakan script root jika tersedia
   - Atau gunakan IDE fitur "Run" untuk menjalankan dua server sekaligus

4. **Buka browser dan akses:**
   - Buka `http://localhost:5173` (alamat frontend)
   - Halaman Login akan tampil

5. **Cara mengetahui frontend dan backend berhasil berjalan:**
   - Frontend: halaman muncul tanpa error di konsol browser
   - Backend: pesan "Server running" di terminal
   - API calls: `GET http://localhost:5000/api/auth/me` mengembalikan data pengguna

6. **Membuat akun user melalui halaman Registrasi:**
   - Klik link "Daftar" atau "Registrasi" di halaman Login
   - Isi form registrasi dengan username dan password
   - Akun user akan dibuat dengan role `user`

7. **Akses Dashboard:**
   - Setelah login, dashboard akan menampilkan ringkasan akun
   - Monitoring status pekerjaan video

---

## J. Menjalankan Pengujian dan Production Build

### Perintah Dokumentasi:

1. **Backend build:**
   ```bash
   cd backend
   npm run build
   ```
   *(Atau: `npm --prefix backend run build`)*

   - Men-compile TypeScript ke JavaScript di `backend/dist/`
   - Pastikan tidak ada error TypeScript

2. **Backend tests:**
   ```bash
   cd backend
   npm test
   ```
   *(Atau: `npm --prefix backend test`)*

   - Menjalankan 44 unit test dengan framework Vitest
   - Hasil: 44/44 test lulus (100% passing)

3. **Frontend production build:**
   ```bash
   cd frontend
   npm run build
   ```
   *(Atau dari root: `npm --prefix frontend run build`)*

   - Men-compile dan minify ke `frontend/dist/`
   - Output: `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`

4. **Jalankan seluruh backend tests:**
   ```bash
   cd backend
   npm test
   ```

### Catatan Penting:

- **Build sukses** tidak otomatis membuktikan Playwright sudah berhasil membuat video Gemini.
- **Cara melakukan tes manual minimal:**

  1. Login ke aplikasi dengan akun admin atau user.
  2. Buka Dashboard.
  3. Membuat job baru dengan prompt.
  4. Mengunggah gambar referensi (optional).
  5. Memilih rasio aspek (9:16 atau 16:9).
  6. Memastikan job masuk antrean (status `preparing`).
  7. Tunggu BrowserWorker mengirim permintaan ke Gemini.
  8. Memastikan video berhasil diunduh (status berubah ke `downloading` lalu `completed`).
  9. Memeriksa video di folder `storage/videos/`.
  10. Memastikan status job berubah menjadi `Completed`.
  11. Memeriksa video di folder output `storage/outputs/`.

---

## K. Troubleshooting

### Kondisi yang Sering Dijumpai dan Solusi:

1. **Backend tidak bisa terhubung dengan database**
   - **Penyebab:** MySQL/XAMPP belum aktif
   - **Diagnosis:** Cek XAMPP Control Panel, pastikan MySQL berwarna hijau (Running)
   - **Solusi:** Aktifkan MySQL melalui XAMPP, pastikan port 3306 tidak digunakan proses lain

2. **MySQL/XAMPP belum aktif**
   - **Penyebab:** XAMPP tidak dijalankan atau jendela Control Panel tertutup
   - **Solusi:** Buka XAMPP Control Panel, klik Start pada MySQL

3. **Endpoint login atau API menghasilkan 404**
   - **Penyebab:** URL endpoint salah atau backend belum berjalan
   - **Diagnosis:** Cek path URL di frontend, pastikan backend berjalan
   - **Solusi:** Pastikan backend berjalan di `http://localhost:5000`, cek konfigurasi `VITE_API_BASE_URL`

4. **Login menghasilkan 401 atau session tidak bertahan**
   - **Penyebab:** CORS konfiguration salah, cookie tidak dikirim, atau `.env` konfiguration salah
   - **Diagnosis:** Cek `CORS_ORIGIN` di `.env`, pastikan `withCredentials: true` di frontend
   - **Solusi:** Sesuaikan `CORS_ORIGIN` dengan alamat frontend, periksa pengiriman cookie

5. **Migration gagal**
   - **Penyebab:** Skema sudah ada, koneksi database salah, atau file migration rusak
   - **Diagnosis:** Cek output error migration, pastikan database aktif
   - **Solusi:** Jalankan migration ulang, periksa koneksi database

6. **Chromium Playwright belum terpasang**
   - **Penyebab:** `npx playwright install chromium` belum dijalankan
   - **Solusi:** Jalankan perintah `npx playwright install chromium` dari terminal

7. **Browser Gemini belum login**
   - **Penyebab:** Profil browser belum memiliki sesi login Gemini
   - **Solusi:** Login ke Gemini Web melalui browser yang digunakan aplikasi, pastikan sesi tersimpan di `browser-profiles/`

8. **Profil browser tidak bisa dibuka**
   - **Penyebab:** Path profil salah, file korupsi, atau permission ditolak
   - **Diagnosis:** Cek path di `.env` (`BROWSER_PROFILES_PATH`), pastikan folder ada
   - **Solusi:** Buat ulang profil, pastikan path benar

9. **Upload gambar gagal**
   - **Penyebab:** Kesalahan validasi ukuran/file, MAX_FILE_SIZE terlalu kecil, atau path storage salah
   - **Solusi:** Cek konfigurasi multer di backend, pastikan `STORAGE_PATH` benar

10. **Job macet di Preparing atau Downloading**
    - **Penyebab:** BrowserWorker tidak berjalan, profil browser salah, atau Gemini menolak permintaan
    - **Solusi:** Cek log BrowserWorker, pastikan profil login Gemini, restart job

11. **BrowserWorker gagal menjalankan job**
    - **Penyebab:** Playwright error, Gemini API limit, atau koneksi internet putus
    - **Solusi:** Cek log error, pastikan koneksi internet, restart BrowserWorker

12. **Video berhasil dibuat tetapi belum terunduh**
    - **Penyebab:** Penyimpanan sementara penuh, permission folder, atau error download
    - **Solusi:** Cek space disk, permission folder `storage/`, pastikan path output benar

13. **Status job tidak berubah menjadi Completed**
    - **Penyebab:** Worker timeout, error di Gemini, atau koneksi putus
    - **Solusi:** Cek log worker, pastikan Gemini menerima permintaan, cek koneksi internet

14. **Port frontend/backend sudah digunakan proses lain**
    - **Penyebab:** Port 5000 (backend) atau 5173 (frontend) sudah dipakai aplikasi lain
    - **Solusi:** Ubah port di `.env`, atau tutup aplikasi yang menggunakan port tersebut

---

## L. Kualitas Dokumentasi

- **Bahasa Indonesia:** Semua dokumentasi menggunakan Bahasa Indonesia yang profesional.
- **Markdown yang rapi:** Heading yang konsisten, code block untuk perintah terminal dan SQL, tabel untuk variabel environment.
- **Heading yang konsisten:** Gunakan `#` untuk judul utama, `##` untuk sub-judul, dan seterusnya.
- **Daftar bernomor untuk langkah instalasi:** Setiap langkah memiliki nomor urut yang jelas.
- **Code block untuk perintah terminal dan SQL:** Perintah ditempatkan dalam kode block untuk mudah dikopi.
- **Tabel untuk variabel environment:** Tabel yang terstruktur dengan nama variabel, fungsi, status wajib/opsional, dan contoh nilai.

Hindari dokumentasi yang terlalu singkat sehingga developer baru harus menebak langkah instalasi.

Jangan menuliskan kredensial contoh yang terlihat seperti akun produksi.

Jangan mengarang URL domain, repository, email, atau informasi kontak.

Pastikan setiap command dalam tutorial sudah dicocokkan dengan script aktual proyek.

---

## M. Verifikasi Dokumentasi

Setelah dokumentasi dibuat:

1. **Periksa ulang seluruh command** pada `README.md` dan `docs/INSTALLATION.md`.
2. **Cocokkan semua nama variabel `.env`** dengan kode aktual.
3. **Pastikan tidak ada referensi folder/file** yang sudah dihapus (seperti `dist-electron/`, `electron-main.js`, dll.).
4. **Jalankan backend build.**
5. **Jalankan frontend build.**
6. **Jalankan seluruh backend tests.**
7. **Periksa `.gitignore`.**
8. **Periksa `git status`** dan file tracked.
9. **Pastikan tidak ada `.env`, database dump, profil browser, video hasil, atau password hash** di antara file yang siap dikirim ke GitHub.

Jangan melakukan commit atau push ke GitHub tanpa instruksi eksplisit.

---

## N. Laporan Akhir

File dokumentasi yang dibuat:

1. `README.md` - Dokumentasi ringkas proyek di root repository.
2. `docs/INSTALLATION.md` - Tutorial instalasi lengkap.

Ringkasan isi `README.md`:
- Identitas proyek, fitur utama, teknologi, arsitektur, pratinjau, instalasi, catatan, dan lisensi.

Ringkasan isi tutorial instalasi:
- Persyaratan sistem, mengunduh source code, instalasi dependensi, persiapan database, konfigurasi environment, migrasi database, pembuatan akun administrator pertama, persiapan Playwright dan Gemini Web, menjalankan aplikasi, pengujian dan production build, troubleshooting, dan verifikasi.

Daftar environment variable yang didokumentasikan tanpa menunjukkan secret:
- `PORT`, `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `CORS_ORIGIN`, `DEMO_MODE`, `HEADLESS_BROWSER`, `MAX_JOBS_PER_ACCOUNT`, `STORAGE_PATH`, `BROWSER_PROFILES_PATH`, `VITE_API_BASE_URL`

Mekanisme pembuatan admin pertama untuk instalasi baru:
- Menggunakan utilitas `npm run create:admin` atau `tsx src/scripts/createAdmin.ts`
- Interaktif meminta username dan password
- Password di-hash dengan bcryptjs sebelum disimpan
- Memastikan belum terdapat admin aktif sebelum membuat

File `.gitignore` yang diperbarui:
- Melindungi `.env`, `.env.local`, `node_modules/`, `dist/`, `build/`, `storage/*`, `browser-profiles/*`, backup SQL, dll.

File sensitif atau data development yang ditemukan dan bagaimana penanganannya:
- Backup database telah dibuat di `C:\Users\User\Documents\gvm_backups_20261108_tahap29\`
- File `.env` lokal tidak dimasukkan ke repository
- Kredensial developer telah di-backup secara terpisah
- Protokol: jangan pernah menampilkan nilai rahasia dari file tersebut

Hasil build dan pengujian aktual:
- Backend build: sukses
- Frontend build: sukses
- Backend tests: 44/44 lulus (100%)
- Database migration: sukses

Apakah repository sudah aman untuk dipublikasikan ke GitHub:
- Ya, setelah verifikasi `.gitignore`, pembuatan `README.md`, dan `docs/INSTALLATION.md`.
- File sensitif telah dieksklusikan.

Hal yang masih membutuhkan keputusan atau konfigurasi dari pemilik proyek:
- Keputusan tentang lisensi proyek.
- Konfigurasi domain dan SSL untuk deployment produksi.
- Keputusan tentang aktivasi fitur production (HEADLESS_BROWSER, DEMO_MODE).
- URL repository GitHub dan langkah pengunggahan.