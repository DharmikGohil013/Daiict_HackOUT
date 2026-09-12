import { request } from './client';
import type { GeneratorDashboard, GovernmentDashboard, InstitutionDashboard } from '@/types';

export const dashboardsApi = {
  government: () => request<GovernmentDashboard>({ method: 'get', url: '/dashboard/government' }),
  generator: (plantId: string) => request<GeneratorDashboard>({ method: 'get', url: `/dashboard/generator/${encodeURIComponent(plantId)}` }),
  institution: (institutionId: string) => request<InstitutionDashboard>({ method: 'get', url: `/dashboard/institution/${encodeURIComponent(institutionId)}` }),
};
