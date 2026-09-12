import { clean, request } from './client';
import type { AuditChain, AuditEvent } from '@/types';

export const auditApi = {
  list: (filters: { claim_id?: string; cert_id?: string; transaction_id?: string; limit?: number } = {}) => request<{ events: AuditEvent[]; count: number; chain: AuditChain }>({ method: 'get', url: '/audit', params: clean(filters) }),
  byReference: (ref: string) => request<{ reference: string; events: AuditEvent[] }>({ method: 'get', url: `/audit/${encodeURIComponent(ref)}` }),
  verify: () => request<AuditChain>({ method: 'get', url: '/audit/verify' }),
};
