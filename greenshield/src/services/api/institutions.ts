import { clean, request } from './client';
import type { Institution, InstitutionDashboard } from '@/types';

export const institutionsApi = {
  list: (search?: string) => request<{ institutions: Institution[]; count: number }>({ method: 'get', url: '/institutions', params: clean({ search }) }),
  get: (id: string) => request<InstitutionDashboard>({ method: 'get', url: `/institutions/${encodeURIComponent(id)}` }),
};
