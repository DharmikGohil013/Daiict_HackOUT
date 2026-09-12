/** REC issuer module — hashing, signing, embedding and ledger registration happen server-side. */
import { request } from '@/services/api/client';
import type { IssueResult } from '@/types';

export interface IssueRecInput { certificate_id?: string; generator_id: string; energy_kwh: number; generation_date: string; generation_period?: string; energy_type: string; format?: 'png' | 'pdf'; }

export const issuerApi = {
  issue: (input: IssueRecInput) => request<IssueResult>({ method: 'post', url: '/rec/issue', data: input }),
  revoke: (certId: string, reason?: string) => request<{ cert_id: string; status: string }>({ method: 'post', url: `/rec/revoke/${encodeURIComponent(certId)}`, data: { reason } }),
};
