export interface GeminiAccount {
  id: number;
  name: string;
  profile_path: string;
  status: 'unconfigured' | 'available' | 'busy' | 'limited' | 'cooldown' | 'error' | 'disabled';
  completed_job_count: number;
  total_job_count: number;
  last_used_at: string | null;
  cooldown_until: string | null;
  last_error: string | null;
  is_running?: boolean;
  is_busy?: boolean;
  active_job_id?: number | null;
  active_job_status?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoAsset {
  id: number;
  job_id: number;
  asset_type: 'reference_image' | 'output_video' | 'thumbnail';
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface JobLog {
  id: number;
  job_id: number;
  account_id: number | null;
  level: 'info' | 'warning' | 'error' | 'debug';
  event: string;
  message: string;
  created_at: string;
}

export interface VideoJob {
  id: number;
  prompt: string;
  reference_image_path: string | null;
  aspect_ratio: '9:16' | '16:9';
  account_id: number | null;
  status: 'queued' | 'preparing' | 'running' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled' | 'awaiting_user';
  progress: number;
  attempt_count: number;
  output_video_path: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  assets?: VideoAsset[];
  logs?: JobLog[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    server: string;
    database: string;
  };
}
