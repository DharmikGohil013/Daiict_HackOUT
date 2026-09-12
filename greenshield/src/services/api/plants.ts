import { clean, request } from './client';
import type { Plant, PlantProfile, PlantWithStats } from '@/types';

export const plantsApi = {
  list: (filters: { energy_type?: string; state?: string; search?: string } = {}) => request<{ plants: PlantWithStats[]; count: number }>({ method: 'get', url: '/plants', params: clean(filters) }),
  get: (id: string, days = 60) => request<PlantProfile>({ method: 'get', url: `/plants/${encodeURIComponent(id)}`, params: { days } }),
  create: (plant: Partial<Plant>) => request<{ plant: Plant }>({ method: 'post', url: '/plants', data: plant }),
  setStatus: (id: string, status: Plant['status']) => request<{ plant: Plant }>({ method: 'post', url: `/plants/${encodeURIComponent(id)}/status`, data: { status } }),
};
