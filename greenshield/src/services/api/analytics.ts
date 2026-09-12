import { clean, request } from './client';
import type { Analytics } from '@/types';

export interface AnalyticsFilters { date_from?: string; date_to?: string; energy_type?: string; state?: string; }

export const analyticsApi = {
  government: (filters: AnalyticsFilters = {}) => request<Analytics>({ method: 'get', url: '/analytics/government', params: clean(filters) }),
};
