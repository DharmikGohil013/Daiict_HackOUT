import { request } from './client';
import type { Alert, EntityProfile, FraudNetwork, FraudScore, Plant } from '@/types';

export const fraudApi = {
  network: () => request<FraudNetwork>({ method: 'get', url: '/fraud/network' }),
  entity: (kind: 'plant' | 'institution', id: string) => request<EntityProfile>({ method: 'get', url: `/fraud/network/${kind}/${encodeURIComponent(id)}` }),
  alerts: (limit = 10) => request<{ alerts: Alert[] }>({ method: 'get', url: '/fraud/alerts', params: { limit } }),
  analyze: (input: { plant_id: string; period_start: string; period_end: string; claimed_kwh: number; certificate_status?: string }) =>
    request<{ plant: Plant; ai: Record<string, unknown>; actual_kwh: number | null; risk: FraudScore & { total_score: number; risk_level: string } }>({ method: 'post', url: '/fraud/analyze', data: input }),
};
