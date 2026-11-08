import { api } from './api';

export interface SystemSettings {
  autoRetry: boolean;
  maxRetries: number;
  downloadTimeout: number;
  cacheCleanInterval: number;
  validateVideoIntegrity: boolean;
  websiteName: string;
  websiteIcon: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  userCount: number;
  adminCount: number;
  jobStats: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  recentActivities: Array<{
    id: number;
    actor_id: number;
    action: string;
    target_id: number | null;
    details: string;
    created_at: string;
  }>;
}

export interface AdminUser {
  id: number;
  username: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
}

export const adminApi = {
  getDashboardStats: async () => {
    const res = await api.get<{ success: boolean; data: AdminDashboardStats }>('/admin/dashboard');
    return res.data.data;
  },

  getUsers: async (query?: string, role?: string) => {
    const params: any = {};
    if (query) params.query = query;
    if (role && role !== 'all') params.role = role;
    const res = await api.get<{ success: boolean; data: AdminUser[] }>('/admin/users', { params });
    return res.data.data;
  },

  createUser: async (data: { username: string; password: string; role: 'user' | 'admin' }) => {
    const res = await api.post<{ success: boolean; data: AdminUser; message: string }>('/admin/users', data);
    return res.data;
  },

  updateUser: async (id: number, data: { username?: string; password?: string; role?: 'user' | 'admin'; is_active?: boolean }) => {
    const res = await api.put<{ success: boolean; message: string }>(`/admin/users/${id}`, data);
    return res.data;
  },

  deactivateUser: async (id: number) => {
    const res = await api.put<{ success: boolean; message: string }>(`/admin/users/${id}`, { is_active: false });
    return res.data;
  },

  deleteUser: async (id: number) => {
    const res = await api.delete<{ success: boolean; message: string }>(`/admin/users/${id}`);
    return res.data;
  },

  resetPassword: async (id: number) => {
    const res = await api.post<{ success: boolean; message: string }>(`/admin/users/${id}/reset-password`);
    return res.data;
  },

  getSystemSettings: async () => {
    const res = await api.get<{ success: boolean; data: any }>('/admin/settings');
    return res.data.data;
  },

  getAuditLogs: async () => {
    const res = await api.get<{ success: boolean; data: any[] }>('/admin/audit-logs');
    return res.data.data;
  },

  updateSystemSettings: async (settings: any) => {
    const res = await api.put<{ success: boolean; data: any }>('/admin/settings', settings);
    return res.data;
  },
};
