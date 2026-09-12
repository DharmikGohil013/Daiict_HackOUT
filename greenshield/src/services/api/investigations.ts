import { clean, request } from './client';
import type { Claim, Decision, Investigation, InvestigationDetail, InvestigationStats } from '@/types';

export const investigationsApi = {
  list: (status?: string) => request<{ cases: Investigation[]; stats: InvestigationStats }>({ method: 'get', url: '/investigations', params: clean({ status }) }),
  get: (id: string) => request<{ case: InvestigationDetail }>({ method: 'get', url: `/investigations/${encodeURIComponent(id)}` }),
  decide: (id: string, decision: Decision, note?: string) => request<{ claim: Claim; case: InvestigationDetail }>({ method: 'post', url: `/investigations/${encodeURIComponent(id)}/decision`, data: { decision, note } }),
};
