/**
 * Axios client: base URL, JWT bearer injection, error normalisation, optional mock mode.
 * Every service module goes through `request()` so the mock adapter and real backend are
 * interchangeable (VITE_MOCK_API=true), and so a future ML/FastAPI split only touches this file.
 */
import axios, { type AxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const MOCK_API = import.meta.env.VITE_MOCK_API === 'true';
export const TOKEN_KEY = 'greenshield.token';

export const http = axios.create({ baseURL: `${API_BASE}/api`, timeout: 120_000 });

http.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data as { error?: string; message?: string; details?: string[] } | undefined;
    const e: ApiError = new Error(data?.error || data?.message || err.message || 'Request failed');
    e.status = err.response?.status;
    e.details = data?.details;
    return Promise.reject(e);
  },
);

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session stays in memory */
  }
}

async function mockRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const { route } = await import('@/data/mock');
  await new Promise((r) => setTimeout(r, 180));
  const body = config.data instanceof FormData ? Object.fromEntries(config.data.entries()) : config.data;
  const url = (config.url || '') + (config.params ? `?${new URLSearchParams(config.params as Record<string, string>).toString()}` : '');
  return { success: true, ...(route(config.method || 'get', url, body) as object) } as T;
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  if (MOCK_API) return mockRequest<T>(config);
  const res = await http.request<T>(config);
  return res.data;
}

/** Absolute URL for backend-served files such as /api/certificate/<file>/preview. */
export function fileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

/** Strip undefined/empty params so the backend sees only real filters. */
export function clean<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}
