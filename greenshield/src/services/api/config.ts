import { request } from './client';

export interface Enums {
  energy_types: string[];
  output_formats: string[];
  risk_levels: string[];
  claim_statuses: string[];
  certificate_statuses: string[];
  ledger_statuses: string[];
  plant_statuses: string[];
  investigation_statuses: string[];
  fraud_types: string[];
  roles: string[];
}

export const configApi = {
  enums: () => request<Enums>({ method: 'get', url: '/config/enums' }),
};
