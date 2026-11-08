import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => config,
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as any;
          const message = data?.error || data?.message || error.message;

          switch (status) {
            case 400:
              throw new Error(`Validasi gagal: ${message}`);
            case 401:
              throw new Error('Tidak terautentikasi');
            case 403:
              throw new Error('Akses ditolak');
            case 404:
              throw new Error('Data tidak ditemukan');
            case 409:
              throw new Error(`Konflik: ${message}`);
            case 500:
              throw new Error('Kesalahan server internal');
            case 503:
              throw new Error('Layanan tidak tersedia. Periksa koneksi database.');
            default:
              throw new Error(`Kesalahan (${status}): ${message}`);
          }
        } else if (error.request) {
          throw new Error('Tidak dapat terhubung ke server backend. Pastikan server berjalan di http://localhost:5000');
        } else {
          throw new Error(`Kesalahan: ${error.message}`);
        }
      }
    );
  }

  get<T>(url: string, params?: Record<string, any>) {
    return this.client.get<T>(url, { params });
  }

  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  patch<T>(url: string, data?: any) {
    return this.client.patch<T>(url, data);
  }

  delete<T>(url: string) {
    return this.client.delete<T>(url);
  }

  getClient() {
    return this.client;
  }
}

export const api = new ApiClient();
export default api;