import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/common/AppShell';
import { ToastProvider } from '@/components/common/Toast';
import { RequireAuth, RequireRole } from '@/components/common/ProtectedRoute';
import { LoadingState } from '@/components/common/States';
import { TopLoader } from '@/components/common/TopLoader';
import { DotField } from '@/components/common/DotField';
import { GEN_NAV, GOV_NAV, INST_NAV, ISSUER_NAV } from '@/lib/nav';
import { ROUTES } from '@/lib/routes';
import './styles/globals.css';

const LandingPage = lazy(() => import('@/app/landing/LandingPage'));
const LoginPage = lazy(() => import('@/app/login/LoginPage'));
const GovDashboard = lazy(() => import('@/app/government/DashboardPage'));
const GovClaims = lazy(() => import('@/app/government/ClaimsPage'));
const GovClaimDetail = lazy(() => import('@/app/government/ClaimDetailPage'));
const GovInvestigations = lazy(() => import('@/app/government/InvestigationsPage'));
const GovInvestigationDetail = lazy(() => import('@/app/government/InvestigationDetailPage'));
const GovPlants = lazy(() => import('@/app/government/PlantsPage'));
const GovPlantProfile = lazy(() => import('@/app/government/PlantProfilePage'));
const GovInstitutions = lazy(() => import('@/app/government/InstitutionsPage'));
const GovInstitutionDetail = lazy(() => import('@/app/government/InstitutionDetailPage'));
const GovFraudNetwork = lazy(() => import('@/app/government/FraudNetworkPage'));
const GovCertificates = lazy(() => import('@/app/government/CertificatesPage'));
const GovAudit = lazy(() => import('@/app/government/AuditPage'));
const GovAnalytics = lazy(() => import('@/app/government/AnalyticsPage'));
const GovSettings = lazy(() => import('@/app/government/SettingsPage'));
const GenDashboard = lazy(() => import('@/app/generator/DashboardPage'));
const GenGeneration = lazy(() => import('@/app/generator/GenerationPage'));
const GenForecast = lazy(() => import('@/app/generator/ForecastPage'));
const GenSubmit = lazy(() => import('@/app/generator/SubmitDataPage'));
const GenClaims = lazy(() => import('@/app/generator/ClaimsPage'));
const GenProfile = lazy(() => import('@/app/generator/PlantProfilePage'));
const InstDashboard = lazy(() => import('@/app/institution/DashboardPage'));
const InstSubmitClaim = lazy(() => import('@/app/institution/SubmitClaimPage'));
const InstClaims = lazy(() => import('@/app/institution/ClaimsPage'));
const InstClaimStatus = lazy(() => import('@/app/institution/ClaimStatusPage'));
const InstCertificates = lazy(() => import('@/app/institution/CertificatesPage'));
const InstTransactions = lazy(() => import('@/app/institution/TransactionsPage'));
const InstProfile = lazy(() => import('@/app/institution/ProfilePage'));
const IssuerCreateRec = lazy(() => import('@/app/issuer/CreateRecPage'));
const VerifierPage = lazy(() => import('@/app/verifier/VerifierPage'));

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false } } });

/** Route table without providers/router so tests can mount it inside a MemoryRouter. */
export function AppRoutes() {
  return (
    <div className="relative min-h-screen">
      {/* Full space interactive dotted background across all pages */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ width: '100vw', height: '100vh', opacity: 0.6 }}
        aria-hidden="true"
      >
        <DotField
          dotRadius={1.5}
          dotSpacing={16}
          bulgeStrength={67}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={500}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#A855F7"
          gradientTo="#B497CF"
          glowColor="#120F17"
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <TopLoader />
        <Suspense fallback={<div className="p-8"><LoadingState label="Loading GreenShield…" /></div>}>
          <Routes>
        <Route path={ROUTES.landing} element={<LandingPage />} />
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.verifier} element={<AppShell nav={ISSUER_NAV} portal="verifier"><VerifierPage /></AppShell>} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireRole roles={['government', 'regulator', 'auditor', 'admin']} />}>
            <Route path="/government" element={<AppShell nav={GOV_NAV} portal="government" />}>
              <Route index element={<Navigate to={ROUTES.government.dashboard} replace />} />
              <Route path="dashboard" element={<GovDashboard />} />
              <Route path="claims" element={<GovClaims />} />
              <Route path="claims/:id" element={<GovClaimDetail />} />
              <Route path="investigations" element={<GovInvestigations />} />
              <Route path="investigations/:id" element={<GovInvestigationDetail />} />
              <Route path="plants" element={<GovPlants />} />
              <Route path="plants/:id" element={<GovPlantProfile />} />
              <Route path="institutions" element={<GovInstitutions />} />
              <Route path="institutions/:id" element={<GovInstitutionDetail />} />
              <Route path="fraud-network" element={<GovFraudNetwork />} />
              <Route path="certificates" element={<GovCertificates />} />
              <Route path="certificates/:id" element={<GovCertificates />} />
              <Route path="audit" element={<GovAudit />} />
              <Route path="analytics" element={<GovAnalytics />} />
              <Route path="settings" element={<GovSettings />} />
            </Route>
          </Route>
          <Route element={<RequireRole roles={['generator', 'admin']} />}>
            <Route path="/generator" element={<AppShell nav={GEN_NAV} portal="generator" />}>
              <Route index element={<Navigate to={ROUTES.generator.dashboard} replace />} />
              <Route path="dashboard" element={<GenDashboard />} />
              <Route path="generation" element={<GenGeneration />} />
              <Route path="forecast" element={<GenForecast />} />
              <Route path="submit" element={<GenSubmit />} />
              <Route path="claims" element={<GenClaims />} />
              <Route path="profile" element={<GenProfile />} />
            </Route>
          </Route>
          <Route element={<RequireRole roles={['institution', 'buyer', 'admin']} />}>
            <Route path="/institution" element={<AppShell nav={INST_NAV} portal="institution" />}>
              <Route index element={<Navigate to={ROUTES.institution.dashboard} replace />} />
              <Route path="dashboard" element={<InstDashboard />} />
              <Route path="claims/new" element={<InstSubmitClaim />} />
              <Route path="claims" element={<InstClaims />} />
              <Route path="claims/:id" element={<InstClaimStatus />} />
              <Route path="certificates" element={<InstCertificates />} />
              <Route path="transactions" element={<InstTransactions />} />
              <Route path="profile" element={<InstProfile />} />
            </Route>
          </Route>
          <Route element={<RequireRole roles={['issuer', 'government', 'regulator', 'admin']} />}>
            <Route path="/issuer" element={<AppShell nav={ISSUER_NAV} portal="issuer" />}>
              <Route index element={<Navigate to={ROUTES.issuer.createRec} replace />} />
              <Route path="create-rec" element={<IssuerCreateRec />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
        </Routes>
      </Suspense>
    </div>
  </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
