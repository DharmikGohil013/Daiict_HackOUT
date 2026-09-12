import { clean, request } from './client';
import type { GenerationRow } from '@/types';

export interface GenerationInputRow { date: string; hour?: number | null; generation_kwh: number; meter_reading_kwh?: number | null; operating_hours?: number | null; }
export interface GenerationIngestResult { plant_id: string; rows: number; first_date: string; last_date: string; stats: Record<string, unknown>; }

export const generationApi = {
  history: (plantId: string, filters: { start?: string; end?: string; limit?: number } = {}) =>
    request<{ plant_id: string; rows: GenerationRow[]; count: number; stats: Record<string, unknown>; monthly: Array<{ month: string; kwh: number }> }>({ method: 'get', url: `/generation/${encodeURIComponent(plantId)}`, params: clean(filters) }),
  submit: (plantId: string, rows: GenerationInputRow[]) => request<GenerationIngestResult>({ method: 'post', url: '/generation', data: { plant_id: plantId, rows } }),
  upload: (plantId: string, file: File) => {
    const form = new FormData();
    form.append('plant_id', plantId);
    form.append('file', file);
    return request<GenerationIngestResult>({ method: 'post', url: '/generation/upload', data: form, headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
