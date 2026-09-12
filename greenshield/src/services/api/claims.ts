import { clean, request } from './client';
import type { Claim, ClaimDetailResponse, ClaimList, Decision, AuditEvent } from '@/types';

export interface ClaimFilters {
  status?: string; risk_level?: string; plant_id?: string; institution_id?: string; energy_type?: string; certificate_status?: string;
  search?: string; date_from?: string; date_to?: string; min_risk?: number; limit?: number; offset?: number; order?: string;
}

export interface SubmitClaimInput {
  plant_id: string; cert_id: string; transaction_id?: string; period_start: string; period_end: string; claimed_kwh: number; institution_id?: string; file?: File | null;
}

export const claimsApi = {
  list: (filters: ClaimFilters = {}) => request<ClaimList>({ method: 'get', url: '/claims', params: clean(filters as Record<string, unknown>) }),
  get: (id: string) => request<ClaimDetailResponse>({ method: 'get', url: `/claims/${encodeURIComponent(id)}` }),
  audit: (id: string) => request<{ events: AuditEvent[] }>({ method: 'get', url: `/claims/${encodeURIComponent(id)}/audit` }),
  decide: (id: string, decision: Decision, note?: string) => request<{ claim: Claim }>({ method: 'post', url: `/claims/${encodeURIComponent(id)}/decision`, data: { decision, note } }),
  submit: (input: SubmitClaimInput) => {
    const form = new FormData();
    Object.entries(input).forEach(([k, v]) => {
      if (k === 'file') { if (v) form.append('file', v as File); }
      else if (v !== undefined && v !== null && v !== '') form.append(k, String(v));
    });
    return request<{ claim: Claim }>({ method: 'post', url: '/claims', data: form, headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
