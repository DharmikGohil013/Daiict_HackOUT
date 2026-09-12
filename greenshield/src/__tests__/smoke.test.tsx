import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Route every request through the sample data — same code path as VITE_MOCK_API=true.
vi.mock('@/services/api/client', async () => {
  const mock = await import('@/data/mock');
  const request = vi.fn(async (config: { method?: string; url?: string; data?: unknown; params?: Record<string, string> }) => {
    const body = config.data instanceof FormData ? Object.fromEntries(config.data.entries()) : config.data;
    return { success: true, ...(mock.route(config.method ?? 'get', config.url ?? '', body) as object) };
  });
  return { request, API_BASE: 'http://api.test', MOCK_API: true, TOKEN_KEY: 'greenshield.token', http: {}, readToken: () => null, writeToken: () => {}, fileUrl: (p: string) => `http://api.test${p}`, clean: (o: Record<string, unknown>) => o };
});

import { request } from '@/services/api/client';
import { AppRoutes } from '@/App';
import { ToastProvider } from '@/components/common/Toast';
import { useAuth } from '@/lib/auth';
import { sessions } from '@/data/mock';

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></ToastProvider></QueryClientProvider>,
  );
}
const requestMock = request as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => { requestMock.mockClear(); useAuth.getState().logout(); });

describe('Landing and login', () => {
  it('renders the landing page with the three portal logins and the flow', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: /AI-Powered Renewable Energy Verification/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Government Login/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Generator Login/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Institution Login/ })).toBeInTheDocument();
    expect(screen.getByText('Detect Fraud')).toBeInTheDocument();
    expect(screen.getByText('Tamper-Evident Audit Trail')).toBeInTheDocument();
  });

  it('demo government button calls /auth/demo/government and lands on the government dashboard', async () => {
    renderAt('/login');
    fireEvent.click(await screen.findByRole('button', { name: 'Demo Government' }));
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/auth/demo/government' })));
    expect(await screen.findByText('Verification dashboard')).toBeInTheDocument();
    expect(useAuth.getState().user?.role).toBe('government');
  });

  it('redirects unauthenticated portal access to login', async () => {
    renderAt('/government/claims');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('Portal shells', () => {
  it('government dashboard shows KPIs, alerts and high-risk claims', async () => {
    useAuth.getState().setSession(sessions.government);
    renderAt('/government/dashboard');
    expect(await screen.findByText('Verification dashboard')).toBeInTheDocument();
    expect(await screen.findByText('Registered plants')).toBeInTheDocument();
    expect(screen.getByText(/duplicate claim attempt blocked/)).toBeInTheDocument();
    expect(screen.getAllByText('CLM-0001').length).toBeGreaterThan(0);
    expect(screen.getByText('Fraud Network')).toBeInTheDocument();
  });

  it('government claim verification page shows the hero comparison, AI explanation and security chain', async () => {
    useAuth.getState().setSession(sessions.government);
    renderAt('/government/claims/CLM-0001');
    expect(await screen.findByText(/Claim Verification/)).toBeInTheDocument();
    expect(screen.getByText('Why was this claim flagged?')).toBeInTheDocument();
    expect(screen.getByText(/43\.5% above AI expected/)).toBeInTheDocument();
    expect(screen.getByText('REC Security Verification')).toBeInTheDocument();
    expect(screen.getByText('AUTHENTIC CERTIFICATE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('generator dashboard renders today vs expected for the linked plant', async () => {
    useAuth.getState().setSession(sessions.generator);
    renderAt('/generator/dashboard');
    expect(await screen.findByText('Kutch Solar Park A')).toBeInTheDocument();
    expect(screen.getByText("Today's generation")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Forecast' })).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ url: '/dashboard/generator/GEN-001' }));
  });

  it('institution dashboard renders KPIs and claims for the linked institution', async () => {
    useAuth.getState().setSession(sessions.institution);
    renderAt('/institution/dashboard');
    expect(await screen.findByText('Acme Steel Ltd')).toBeInTheDocument();
    expect(screen.getByText('Duplicate attempts')).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ url: '/dashboard/institution/INST-045' }));
  });

  it('a generator cannot open the government portal', async () => {
    useAuth.getState().setSession(sessions.generator);
    renderAt('/government/dashboard');
    expect(await screen.findByText('Kutch Solar Park A')).toBeInTheDocument();
    expect(screen.queryByText('Verification dashboard')).not.toBeInTheDocument();
  });

  it('public verifier renders without a session', async () => {
    renderAt('/verifier');
    expect(await screen.findByText('Verify a certificate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify certificate' })).toBeDisabled();
  });
});
