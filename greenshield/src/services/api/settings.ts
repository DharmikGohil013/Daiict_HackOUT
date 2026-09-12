import { request } from './client';

export interface RiskSettings {
  thresholds: { LOW: number; MEDIUM: number; HIGH: number };
  weights: { generation: number; historical: number; weather: number; certificate: number; capacity: number };
  auto_verify_max_level: 'LOW' | 'MEDIUM' | 'HIGH';
  updated_at?: string | null;
  updated_by?: string | null;
  model?: { version: string; trained_at: string | null; metrics: Record<string, unknown> };
}

export const settingsApi = {
  get: () => request<RiskSettings>({ method: 'get', url: '/settings/risk' }),
  update: (body: Pick<RiskSettings, 'thresholds' | 'weights' | 'auto_verify_max_level'>) => request<RiskSettings>({ method: 'put', url: '/settings/risk', data: body }),
  reset: () => request<RiskSettings>({ method: 'post', url: '/settings/risk/reset' }),
};
