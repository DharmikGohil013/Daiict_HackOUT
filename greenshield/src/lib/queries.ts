/** React Query hooks — one per backend resource. Keys are stable arrays for targeted invalidation. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyticsApi, auditApi, certificatesApi, claimsApi, dashboardsApi, fraudApi, generationApi, institutionsApi, investigationsApi, issuerApi,
  plantsApi, predictionApi, settingsApi, verifierApi,
} from '@/services';
import type { ClaimFilters, SubmitClaimInput } from '@/services/api/claims';
import type { AnalyticsFilters } from '@/services/api/analytics';
import type { GenerationInputRow } from '@/services/api/generation';
import type { IssueRecInput } from '@/services/certificate/issuer';
import type { Decision } from '@/types';
import type { RiskSettings } from '@/services/api/settings';

export const keys = {
  govDashboard: ['dashboard', 'government'] as const,
  genDashboard: (id: string) => ['dashboard', 'generator', id] as const,
  instDashboard: (id: string) => ['dashboard', 'institution', id] as const,
  claims: (f: ClaimFilters) => ['claims', f] as const,
  claim: (id: string) => ['claim', id] as const,
  investigations: (status?: string) => ['investigations', status ?? 'all'] as const,
  investigation: (id: string) => ['investigation', id] as const,
  plants: (f: object) => ['plants', f] as const,
  plant: (id: string) => ['plant', id] as const,
  institutions: (search?: string) => ['institutions', search ?? ''] as const,
  institution: (id: string) => ['institution', id] as const,
  network: ['fraud', 'network'] as const,
  entity: (kind: string, id: string) => ['fraud', 'entity', kind, id] as const,
  alerts: ['fraud', 'alerts'] as const,
  certificates: (f: object) => ['certificates', f] as const,
  certificate: (id: string) => ['certificate', id] as const,
  audit: (f: object) => ['audit', f] as const,
  analytics: (f: AnalyticsFilters) => ['analytics', f] as const,
  generation: (id: string, f: object) => ['generation', id, f] as const,
  forecast: (id: string) => ['forecast', id] as const,
  model: ['ml', 'model'] as const,
  riskSettings: ['settings', 'risk'] as const,
};

export const useGovernmentDashboard = () => useQuery({ queryKey: keys.govDashboard, queryFn: dashboardsApi.government, refetchInterval: 60_000 });
export const useGeneratorDashboard = (plantId: string | null | undefined) => useQuery({ queryKey: keys.genDashboard(plantId ?? ''), queryFn: () => dashboardsApi.generator(plantId!), enabled: !!plantId });
export const useInstitutionDashboard = (id: string | null | undefined) => useQuery({ queryKey: keys.instDashboard(id ?? ''), queryFn: () => dashboardsApi.institution(id!), enabled: !!id });
export const useClaims = (filters: ClaimFilters = {}) => useQuery({ queryKey: keys.claims(filters), queryFn: () => claimsApi.list(filters), placeholderData: (prev) => prev });
export const useClaim = (id: string | undefined) => useQuery({ queryKey: keys.claim(id ?? ''), queryFn: () => claimsApi.get(id!), enabled: !!id });
export const useInvestigations = (status?: string) => useQuery({ queryKey: keys.investigations(status), queryFn: () => investigationsApi.list(status) });
export const useInvestigation = (id: string | undefined) => useQuery({ queryKey: keys.investigation(id ?? ''), queryFn: () => investigationsApi.get(id!), enabled: !!id, select: (d) => d.case });
export const usePlants = (filters: { energy_type?: string; state?: string; search?: string } = {}) => useQuery({ queryKey: keys.plants(filters), queryFn: () => plantsApi.list(filters), placeholderData: (prev) => prev });
export const usePlant = (id: string | undefined, days = 60) => useQuery({ queryKey: keys.plant(`${id}:${days}`), queryFn: () => plantsApi.get(id!, days), enabled: !!id });
export const useInstitutions = (search?: string) => useQuery({ queryKey: keys.institutions(search), queryFn: () => institutionsApi.list(search), placeholderData: (prev) => prev });
export const useInstitution = (id: string | undefined) => useQuery({ queryKey: keys.institution(id ?? ''), queryFn: () => institutionsApi.get(id!), enabled: !!id });
export const useFraudNetwork = () => useQuery({ queryKey: keys.network, queryFn: fraudApi.network });
export const useEntityProfile = (kind: 'plant' | 'institution' | null, id: string | null) => useQuery({ queryKey: keys.entity(kind ?? '', id ?? ''), queryFn: () => fraudApi.entity(kind!, id!), enabled: !!kind && !!id });
export const useAlerts = (limit = 10) => useQuery({ queryKey: [...keys.alerts, limit], queryFn: () => fraudApi.alerts(limit) });
export const useCertificates = (filters: { search?: string; status?: string; limit?: number } = {}) => useQuery({ queryKey: keys.certificates(filters), queryFn: () => certificatesApi.list(filters), placeholderData: (prev) => prev });
export const useCertificate = (id: string | undefined) => useQuery({ queryKey: keys.certificate(id ?? ''), queryFn: () => certificatesApi.get(id!), enabled: !!id, retry: false });
export const useAudit = (filters: { claim_id?: string; cert_id?: string; transaction_id?: string; limit?: number } = {}) => useQuery({ queryKey: keys.audit(filters), queryFn: () => auditApi.list(filters), placeholderData: (prev) => prev });
export const useAnalytics = (filters: AnalyticsFilters = {}) => useQuery({ queryKey: keys.analytics(filters), queryFn: () => analyticsApi.government(filters), placeholderData: (prev) => prev });
export const useGeneration = (plantId: string | null | undefined, filters: { start?: string; end?: string; limit?: number } = {}) => useQuery({ queryKey: keys.generation(plantId ?? '', filters), queryFn: () => generationApi.history(plantId!, filters), enabled: !!plantId });
export const useForecast = (plantId: string | null | undefined) => useQuery({ queryKey: keys.forecast(plantId ?? ''), queryFn: () => predictionApi.forecast(plantId!), enabled: !!plantId });
export const useModelInfo = () => useQuery({ queryKey: keys.model, queryFn: predictionApi.modelInfo, staleTime: 5 * 60_000 });

export function useDecideClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: Decision; note?: string }) => claimsApi.decide(id, decision, note),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: keys.claim(v.id) });
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['investigations'] });
      qc.invalidateQueries({ queryKey: ['investigation'] });
      qc.invalidateQueries({ queryKey: keys.govDashboard });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useDecideInvestigation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: Decision; note?: string }) => investigationsApi.decide(id, decision, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investigation'] });
      qc.invalidateQueries({ queryKey: ['investigations'] });
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['claim'] });
      qc.invalidateQueries({ queryKey: keys.govDashboard });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: SubmitClaimInput) => claimsApi.submit(input), onSuccess: () => { qc.invalidateQueries({ queryKey: ['claims'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); } });
}

export function useSubmitGeneration() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ plantId, rows }: { plantId: string; rows: GenerationInputRow[] }) => generationApi.submit(plantId, rows), onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['generation', v.plantId] }); qc.invalidateQueries({ queryKey: keys.genDashboard(v.plantId) }); } });
}

export function useUploadGeneration() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ plantId, file }: { plantId: string; file: File }) => generationApi.upload(plantId, file), onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['generation', v.plantId] }); qc.invalidateQueries({ queryKey: keys.genDashboard(v.plantId) }); } });
}

export const useIssueRec = () => useMutation({ mutationFn: (input: IssueRecInput) => issuerApi.issue(input) });
export const useVerifyRec = () => useMutation({ mutationFn: (file: File) => verifierApi.verifyFile(file) });

export const useRiskSettings = () => useQuery({ queryKey: keys.riskSettings, queryFn: settingsApi.get });
export function useUpdateRiskSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<RiskSettings, 'thresholds' | 'weights' | 'auto_verify_max_level'>) => settingsApi.update(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.riskSettings }); qc.invalidateQueries({ queryKey: ['audit'] }); },
  });
}
export function useResetRiskSettings() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => settingsApi.reset(), onSuccess: () => qc.invalidateQueries({ queryKey: keys.riskSettings }) });
}
