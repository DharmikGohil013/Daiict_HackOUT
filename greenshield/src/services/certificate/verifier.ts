/** REC verifier module — real SHA-256 / RSA / steganography / ledger checks run server-side. */
import { request } from '@/services/api/client';
import type { VerifyResult } from '@/types';

export const verifierApi = {
  verifyFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<VerifyResult>({ method: 'post', url: '/rec/verify', data: form, headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
