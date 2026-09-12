/**
 * ML service interface. Today these hit the Flask backend's /prediction and /ml routes; when the
 * model moves to its own FastAPI service only this module's base path changes.
 */
import { request } from '@/services/api/client';
import type { Forecast, Prediction } from '@/types';

export const predictionApi = {
  period: (plant_id: string, period_start: string, period_end: string) => request<{ prediction: Prediction }>({ method: 'post', url: '/prediction/generation', data: { plant_id, period_start, period_end } }),
  day: (plant_id: string, date: string) => request<{ prediction: { predicted_kwh: number; lower_bound_kwh: number; upper_bound_kwh: number; weather: Record<string, number> } }>({ method: 'post', url: '/prediction/generation', data: { plant_id, date } }),
  forecast: (plant_id: string, horizons: number[] = [24, 48, 72]) => request<{ plant_id: string; forecast: Forecast[] }>({ method: 'get', url: `/prediction/forecast/${encodeURIComponent(plant_id)}`, params: { horizons: horizons.join(',') } }),
  modelInfo: () => request<{ model: { version: string; algorithm: string; metrics: Record<string, unknown>; trained_at?: string } }>({ method: 'get', url: '/ml/model' }),
};
