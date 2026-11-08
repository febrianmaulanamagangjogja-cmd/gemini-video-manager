import api from './api';
import type { GeminiAccount, VideoJob, HealthStatus } from '../types';

export const healthApi = {
  getHealth: async () => {
    const res = await api.get<HealthStatus>('/health');
    return res.data;
  },
};

export const accountsApi = {
  getAll: async () => {
    const res = await api.get<GeminiAccount[]>('/accounts');
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<GeminiAccount>(`/accounts/${id}`);
    return res.data;
  },
  create: async (data: { name: string; profile_path: string; status?: string }) => {
    const res = await api.post<GeminiAccount>('/accounts', data);
    return res.data;
  },
  update: async (id: number, data: Partial<GeminiAccount>) => {
    const res = await api.patch<GeminiAccount>(`/accounts/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/accounts/${id}`);
  },
  launch: async (id: number) => {
    const res = await api.post<{ success: boolean; message?: string }>(`/accounts/${id}/launch`);
    return res.data;
  },
  close: async (id: number, force?: boolean) => {
    const res = await api.post<{ success: boolean; message?: string; activeJobId?: number | null }>(`/accounts/${id}/close`, { force });
    return res.data;
  },
  checkLogin: async (id: number) => {
    const res = await api.post<{ status: string; message?: string; success?: boolean; accountId?: number; checkedAt?: string; diagnosticReason?: string }>(`/accounts/${id}/check-login`);
    return res.data;
  },
};

export const jobsApi = {
  getAll: async (params?: { status?: string; account_id?: number; limit?: number; offset?: number }) => {
    const res = await api.get<VideoJob[]>('/jobs', params);
    return res.data;
  },
  getById: async (id: number) => {
    const res = await api.get<VideoJob>(`/jobs/${id}`);
    return res.data;
  },
  create: async (data: { prompt: string; reference_image_path?: string | null; aspect_ratio: '9:16' | '16:9'; account_id?: number | null }) => {
    const res = await api.post<VideoJob>('/jobs', data);
    return res.data;
  },
  update: async (id: number, data: Partial<VideoJob>) => {
    const res = await api.patch<VideoJob>(`/jobs/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/jobs/${id}`);
  },
  cancel: async (id: number) => {
    const res = await api.post<{ success: boolean; message?: string }>(`/jobs/${id}/cancel`);
    return res.data;
  },
  getStats: async () => {
    const res = await api.get<{
      awaiting_user: number;
      failed: number;
      running: number;
      queued: number;
      total: number;
    }>('/jobs/stats/notifications');
    return res.data;
  },
  uploadReferenceImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; file_path: string; filename: string }>('/upload', formData);
    return res.data;
  },
  uploadVideo: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('video', file);
    const res = await api.post<{ success: boolean; message: string; path: string; assetId: number }>(`/jobs/${id}/upload`, formData);
    return res.data;
  },
  downloadVideo: async (id: number) => {
    const res = await api.get<Blob>(`/jobs/${id}/download`, {
      responseType: 'blob',
    });
    const blob = res.data;
    if (!(blob instanceof Blob)) {
      throw new Error('Data yang diterima bukan file video yang valid');
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-${id}-output.mp4`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  },
  getReferenceImageUrl: (id: number) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    return `${baseUrl}/images/${id}/reference-image`;
  },
  openFolder: async (id: number) => {
    const res = await api.post<{ success: boolean; message: string }>(`/jobs/${id}/open-folder`);
    return res.data;
  },
};
