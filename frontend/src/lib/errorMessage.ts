const exactTranslations: Record<string, string> = {
  'Browser profile missing.': 'Profil browser tidak tersedia.',
  'Browser profile page missing.': 'Halaman profil browser tidak tersedia.',
  'Timeout waiting for download button': 'Batas waktu menunggu tombol unduh video telah habis.',
  'Job cancelled due to browser window closure': 'Pekerjaan dibatalkan karena jendela browser ditutup.',
  'Job cancelled due to browser closing': 'Pekerjaan dibatalkan karena jendela browser ditutup.',
  'Job cancelled due to forced profile reset': 'Pekerjaan dibatalkan karena profil browser diatur ulang.',
  'Validation failed': 'Data yang dimasukkan tidak valid.',
  'Job not found': 'Pekerjaan tidak ditemukan.',
  'Account not found': 'Akun tidak ditemukan.',
  'Invalid ID': 'ID tidak valid.',
};

/** Mengubah pesan backend/Playwright berbahasa Inggris menjadi pesan aman untuk pengguna. */
export function translateErrorMessage(message?: string | null): string {
  if (!message) return 'Terjadi kesalahan pada pekerjaan ini.';

  const normalized = message.trim();
  if (exactTranslations[normalized]) return exactTranslations[normalized];

  const patterns: Array<[RegExp, string]> = [
    [/^Browser profile unavailable:/i, 'Profil browser tidak dapat digunakan.'],
    [/^Failed to acquire browser profile:/i, 'Profil browser tidak dapat digunakan.'],
    [/^Login (status|issue):/i, 'Sesi login Gemini bermasalah. Silakan periksa akun browser.'],
    [/^Auto-download failed:/i, 'Pengunduhan video otomatis gagal. Silakan unduh video secara manual dari browser.'],
    [/^Prompt entered in Gemini Web\./i, 'Prompt telah dimasukkan ke Gemini. Silakan lanjutkan proses dari browser.'],
    [/^Prompt submitted successfully\./i, 'Prompt berhasil dikirim dan pembuatan video sedang berlangsung.'],
    [/^Video generation complete\./i, 'Video telah selesai dibuat dan sedang disiapkan untuk diunduh.'],
    [/^No available account found/i, 'Tidak ada akun browser yang tersedia untuk memproses pekerjaan ini.'],
    [/^Assigned account .* is disabled/i, 'Akun browser yang dipilih sedang dinonaktifkan.'],
    [/^File gambar tidak ditemukan/i, 'File gambar referensi tidak ditemukan.'],
    [/^Download rejected/i, 'Hasil unduhan ditolak karena percakapan Gemini telah berubah.'],
    [/^Pengunduhan otomatis gagal:/i, normalized],
  ];

  for (const [pattern, translation] of patterns) {
    if (pattern.test(normalized)) return translation;
  }

  // Pesan yang sudah berbahasa Indonesia dapat ditampilkan apa adanya.
  if (/[à-ÿ]|\b(gagal|tidak|silakan|pekerjaan|video|akun|browser|unduh|kesalahan)\b/i.test(normalized)) {
    return normalized;
  }

  return 'Terjadi kesalahan pada proses pekerjaan. Buka detail teknis untuk informasi lebih lanjut.';
}
