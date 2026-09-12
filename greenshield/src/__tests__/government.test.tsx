import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

beforeEach(() => { requestMock.mockClear(); useAuth.getState().logout(); useAuth.getState().setSession(sessions.government); });

describe('Government dashboard (phase 4)', () => {
  it('shows the investigation queue and audit health widgets', async () => {
    renderAt('/government/dashboard');
    expect(await screen.findByText('Verification dashboard')).toBeInTheDocument();
    const queue = await screen.findByTestId('investigation-queue');
    expect(within(queue).getByText('INV-0001')).toBeInTheDocument();
    expect(within(queue).getAllByText(/Inflated generation|Tampered certificate|Certificate ID tampering/).length).toBeGreaterThan(0);
    const health = screen.getByTestId('audit-health');
    expect(within(health).getByText('Intact')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open case/ })).toHaveAttribute('href', '/government/investigations');
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ url: '/investigations' }));
  });
});

describe('Claim verification hero screen (phase 4)', () => {
  it('answers the three questions, recommends an action and shows generation + weather evidence', async () => {
    renderAt('/government/claims/CLM-0001');
    expect(await screen.findByText(/Claim Verification/)).toBeInTheDocument();
    const strip = screen.getByTestId('three-questions');
    expect(within(strip).getByText('Did the plant actually generate this much energy?')).toBeInTheDocument();
    expect(within(strip).getByText('No — far above expectation')).toBeInTheDocument();
    expect(within(strip).getByText('Yes — authentic')).toBeInTheDocument();
    expect(within(strip).getByText('No — first claim')).toBeInTheDocument();
    const rec = screen.getByTestId('recommendation');
    expect(within(rec).getByText('Request evidence or reject')).toBeInTheDocument();
    expect(screen.getByText('Generation vs AI prediction')).toBeInTheDocument();
    expect(screen.getByText('Weather evidence')).toBeInTheDocument();
    expect(screen.getByText('Period average weather')).toBeInTheDocument();
    expect(screen.getByText('Why was this claim flagged?')).toBeInTheDocument();
    expect(screen.getByText('Tamper-evident audit trail')).toBeInTheDocument();
  });

  it('rejecting through the confirm dialog posts the decision with the note', async () => {
    renderAt('/government/claims/CLM-0001');
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Meter data contradicts claim' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject claim' }));
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/claims/CLM-0001/decision', data: { decision: 'reject', note: 'Meter data contradicts claim' } })));
  });

  it('a duplicate claim shows the blocked verdict and no approve action', async () => {
    renderAt('/government/claims/CLM-0004');
    expect(await screen.findByText(/Claim Verification/)).toBeInTheDocument();
    expect(within(screen.getByTestId('three-questions')).getByText('Yes — duplicate')).toBeInTheDocument();
    expect(within(screen.getByTestId('recommendation')).getByText('Blocked automatically')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});

describe('Government lists (phase 4)', () => {
  it('claims table has filters, search and per-row actions', async () => {
    renderAt('/government/claims');
    expect(await screen.findByRole('heading', { name: 'Claims' })).toBeInTheDocument();
    expect((await screen.findAllByRole('link', { name: 'Verify' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Case' })[0]).toHaveAttribute('href', '/government/investigations/INV-0001');
    fireEvent.change(screen.getByLabelText('Risk'), { target: { value: 'CRITICAL' } });
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ url: '/claims', params: expect.objectContaining({ risk_level: 'CRITICAL' }) })));
  });

  it('investigation center lists cases with KPI cards and opens a case with evidence and decisions', async () => {
    renderAt('/government/investigations');
    expect(await screen.findByText('Investigation center')).toBeInTheDocument();
    expect(screen.getByText('Open investigations')).toBeInTheDocument();
    expect(await screen.findByText('INV-0002')).toBeInTheDocument();
    renderAt('/government/investigations/INV-0001');
    expect(await screen.findByText('Generation evidence')).toBeInTheDocument();
    expect(screen.getByText('Certificate evidence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request More Data' })).toBeInTheDocument();
  });

  it('certificate lookup shows checks, final status and claims on the certificate', async () => {
    renderAt('/government/certificates/REC-1022');
    expect(await screen.findByText('Certificate verification')).toBeInTheDocument();
    expect(await screen.findByText('REC Security Verification')).toBeInTheDocument();
    expect(screen.getByText('Claims on this certificate')).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ url: '/certificates/REC-1022' }));
  });

  it('plants, fraud network, audit and analytics pages load their data', async () => {
    renderAt('/government/plants');
    expect(await screen.findByText('Plant registry')).toBeInTheDocument();
    expect(await screen.findByText('Kutch Solar Park A')).toBeInTheDocument();
    renderAt('/government/fraud-network');
    expect((await screen.findAllByText('Fraud network')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Potentially suspicious relationships')).toBeInTheDocument();
    renderAt('/government/audit');
    expect(await screen.findByText('Tamper-evident audit trail')).toBeInTheDocument();
    expect(await screen.findByText(/Chain intact/)).toBeInTheDocument();
    renderAt('/government/analytics');
    expect(await screen.findByText('Fraud detection rate')).toBeInTheDocument();
    expect(await screen.findByText('Top suspicious generators')).toBeInTheDocument();
  });
});
