// frontend/src/lib/logMessage.ts
export const logMessageMap: Record<string, { title: string; description: string }> = {
  job_created: {
    title: 'Pekerjaan dibuat',
    description: 'Pekerjaan baru telah diciptakan dalam antrean.'
  },
  job_preparing: {
    title: 'Sedang menyiapkan',
    description: 'Pekerjaan sedang dipersiapkan untuk eksekusi.'
  },
  job_running: {
    title: 'Berjalan',
    description: 'Proses pembuatan sedang berjalan.'
  },
  prompt_entered: {
    title: 'Prompt masuk',
    description: 'Prompt dan gambar telah dimasukkan ke Gemini.'
  },
  prompt_submitted: {
    title: 'Prompt terkirim',
    description: 'Prompt berhasil dikirim ke Gemini.'
  },
  awaiting_user_completion: {
    title: 'Menunggu Anda',
    description: 'Gemini menunggu Anda melakukan tindakan di halaman Gemini.'
  },
  video_downloaded: {
    title: 'Video berhasil diunduh',
    description: 'Video berhasil diunduh ke komputer Anda.'
  },
  video_uploaded: {
    title: 'Video disimpan',
    description: 'Video telah disimpan di server.'
  },
  job_completed: {
    title: 'Pekerjaan selesai',
    description: 'Pekerjaan telah selesai dan video tersedia.'
  },
  job_failed: {
    title: 'Pekerjaan gagal',
    description: 'Pekerjaan gagal dilakukan. Periksa log untuk detailnya.'
  },
  job_cancelled: {
    title: 'Pekerjaan dibatalkan',
    description: 'Pekerjaan telah dibatalkan oleh pengguna atau sistem.'
  },
  download_started: {
    title: 'Sedang mengunduh',
    description: 'Download video dimulai.'
  },
  download_failed: {
    title: 'Gagal diunduh',
    description: 'Gagal mengunduh video. Periksa koneksi atau coba lagi.'
  },
  nav_back_to_videos: {
    title: 'Kembali ke halaman pembuat video',
    description: 'Halaman kembali ke /videos setelah upload gambar.'
  },
  composer_not_found: {
    title: 'Tidak dapat menemukan kotak prompt',
    description: 'Gagal menemukan kotak prompt secara otomatis. Mohon masukkan prompt secara manual.'
  },
  image_attach_manual: {
    title: 'Gagal mengunggah gambar',
    description: 'Gagal mengunggah gambar secara otomatis. Mohon coba lagi atau lakukan secara manual.'
  },
  prompt_submitted_enter: {
    title: 'Prompt terkirim via Enter',
    description: 'Prompt terkirim menggunakan tombol Enter pada kotak prompt.'
  },
  job_running_generation: {
    title: 'Pembuatan video dimulai',
    description: 'Proses pembuatan video telah dimulai secara otomatis.'
  },
  awaiting_user_action: {
    title: 'Menunggu tindakan manual',
    description: 'Gagal menemukan tombol submit otomatis. Mohon lakukan tindakan manual di Gemini.'
  },
  gemini_rejected: {
    title: 'Gemini menolak',
    description: 'Gemini menolak pembuatan video karena tidak mendukung atau tidak dapat memproses permintaan.'
  }
};

export type LogEntry = {
  event: string;
  title: string;
  description: string;
  icon: string;
};

export const logMessage = (event: string): LogEntry => {
  if (logMessageMap[event]) {
    const entry = logMessageMap[event];
    return {
        event: event,
        title: entry.title,
        description: entry.description,
        icon: 'Info'
    };
  }
  
  // Default fallback for unknown events
  return {
    event: event,
    title: 'Pembaruan proses',
    description: 'Proses sedang berjalan. Lihat detail teknis untuk informasi lebih lanjut.',
    icon: 'Info'
  };
};