# Panduan Deployment Gemini Video Manager ke VPS Linux (Production HTTPS)

Dokumen ini berisi panduan lengkap untuk melakukan deployment aplikasi **Gemini Video Manager** ke server VPS Linux (Ubuntu/Debian) dengan Nginx, HTTPS (Let's Encrypt), Node.js, MySQL/MariaDB, dan Playwright BrowserWorker.

---

## 1. Spesifikasi Minimum VPS yang Disarankan
- **OS:** Ubuntu 22.04 LTS atau Debian 12
- **RAM:** Minimal 2 GB (disarankan 4 GB karena Playwright / Chromium membutuhkan memori lebih saat menjalankan browser automation).
- **Storage:** Minimal 20 GB SSD (bertambah seiring jumlah video dan profil browser yang disimpan).
- **CPU:** 2 vCPU atau lebih.

---

## 2. Persiapan Awal Server Linux
Login ke VPS Anda via SSH, lalu perbarui sistem dan instal dependensi dasar:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git build-essential nginx certbot python3-certbot-nginx -y
```

---

## 3. Instalasi Node.js (Versi 20.x atau 22.x)
Gunakan NodeSource untuk menginstal Node.js LTS terbaru:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # Pastikan v20+ atau v22+
npm -v
```

---

## 4. Instalasi & Konfigurasi MySQL / MariaDB
Instal MariaDB Server:

```bash
sudo apt install mariadb-server -y
sudo mysql_secure_installation
```
*(Ikuti instruksi interaktif untuk mengamankan root password, menghapus anonymous users, dan menolak remote root login).*

Buat database dan user khusus aplikasi:

```sql
sudo mysql -u root -p
```
Di dalam prompt MySQL, jalankan perintah berikut (ubah `my_secure_password` dengan password yang aman):

```sql
CREATE DATABASE gemini_video_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gvm_user'@'localhost' IDENTIFIED BY 'my_secure_password';
GRANT ALL PRIVILEGES ON gemini_video_manager.* TO 'gvm_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 5. Clone Repository dan Build Aplikasi

Kloning repositori ke direktori `/var/www/gemini-video-manager` (atau direktori pilihan Anda):

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <repository-url> gemini-video-manager
cd gemini-video-manager
```

### Setup Backend:
```bash
cd backend
npm install
npm run build
```

### Setup Frontend:
```bash
cd ../frontend
npm install
npm run build
```

---

## 6. Konfigurasi Environment Variable (`.env`)

Buat file `.env` di direktori `backend/.env` (jangan commit file ini ke git):

```env
PORT=5000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=gvm_user
DB_PASSWORD=my_secure_password
DB_NAME=gemini_video_manager
CORS_ORIGIN=https://yourdomain.com
SESSION_SECRET=GantiDenganSecretKeyYangSangatPanjangDanAcak
MAX_JOBS_PER_ACCOUNT=3
STORAGE_PATH=../storage
BROWSER_PROFILES_PATH=../browser-profiles
```

Jalankan migrasi database:
```bash
cd /var/www/gemini-video-manager/backend
npm run db:migrate
```

---

## 7. Instalasi Playwright dan Dependensi Sistem Linux untuk Chromium

Playwright membutuhkan pustaka sistem agar Chromium dapat berjalan di lingkungan headless Linux (VPS tanpa GUI):

```bash
npx playwright install-deps chromium
npx playwright install chromium
```

---

## 8. Menjalankan Backend secara Persisten menggunakan Systemd

Buat file systemd service untuk backend agar berjalan otomatis dan otomatis restart jika server reboot / crash.

```bash
sudo nano /etc/systemd/system/gvm-backend.service
```

Isi dengan konfigurasi berikut (sesuaikan path user dan direktori):

```ini
[Unit]
Description=Gemini Video Manager Backend Service
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/gemini-video-manager/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/var/www/gemini-video-manager/backend/.env

[Install]
WantedBy=multi-user.target
```

Ubah kepemilikan direktori agar dapat diakses oleh user `www-data`:
```bash
sudo chown -R www-data:www-data /var/www/gemini-video-manager
```

Aktifkan dan jalankan service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gvm-backend
sudo systemctl start gvm-backend
sudo systemctl status gvm-backend
```

---

## 9. Konfigurasi Nginx dan HTTPS (Let's Encrypt)

Buat file konfigurasi Nginx untuk domain Anda:

```bash
sudo nano /etc/nginx/sites-available/gemini-video-manager
```

Isi dengan konfigurasi berikut (ganti `yourdomain.com` dengan domain Anda):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    # Serve Frontend static files built by Vite
    root /var/www/gemini-video-manager/frontend/dist;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Express backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Proxy protected storage files (videos & downloads)
    location /storage/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan situs dan uji konfigurasi Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/gemini-video-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Amankan dengan HTTPS (Certbot Let's Encrypt):
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot akan secara otomatis mengonfigurasi SSL/TLS sertifikat dan mengaktifkan redirect HTTP ke HTTPS.

---

## 10. Inisialisasi Akun Admin Pertama di Production

Jalankan perintah berikut untuk membuat akun administrator pertama di server production:

```bash
cd /var/www/gemini-video-manager/backend
npm run create:admin
```
Ikuti prompt untuk memasukkan username dan password admin.

---

## 11. Prosedur Backup & Rollback Database

### Backup Database:
```bash
mysqldump -u gvm_user -p gemini_video_manager > gvm_backup_$(date +%F).sql
```

### Restore Database:
```bash
mysql -u gvm_user -p gemini_video_manager < gvm_backup_YYYY-MM-DD.sql
```

### Rollback Aplikasi (Jika Deploy Gagal):
```bash
cd /var/www/gemini-video-manager
git log -n 5  # Cari commit hash sebelumnya
git reset --hard <commit-hash>
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
sudo systemctl restart gvm-backend
```

---

## 12. Catatan Keamanan Penting untuk Multi-User Publik
1. Pastikan `SESSION_SECRET` menggunakan string acak yang kuat.
2. Jangan pernah membuka port database MySQL (`3306`) ke publik (tetap di `127.0.0.1`).
3. Pastikan firewall (UFW) diaktifkan:
   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```
