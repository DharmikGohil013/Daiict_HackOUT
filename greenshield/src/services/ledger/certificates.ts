/** Shared REC ledger views. */
import { clean, request } from '@/services/api/client';
import type { CertificateDetail, CertificateListRow, CertificateStatus, SecurityChecks } from '@/types';

export const certificatesApi = {
  list: (filters: { search?: string; status?: string; limit?: number } = {}) => request<{ certificates: CertificateListRow[]; count: number }>({ method: 'get', url: '/certificates', params: clean(filters) }),
  get: (certId: string) => request<CertificateDetail>({ method: 'get', url: `/certificates/${encodeURIComponent(certId)}` }),
  verify: (certId: string, file?: File | null) => {
    const form = new FormData();
    if (file) form.append('file', file);
    return request<{ cert_id: string; status: CertificateStatus; reason: string; checks: SecurityChecks; final_status: string }>({ method: 'post', url: `/certificates/${encodeURIComponent(certId)}/verify`, data: form, headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
