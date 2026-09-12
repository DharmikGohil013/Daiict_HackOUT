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
const lastCall = (url: string) => [...requestMock.mock.calls].reverse().find((c) => (c[0] as { url: string }).url === url)?.[0] as { method: string; url: string; data: unknown } | undefined;

beforeEach(() => { requestMock.mockClear(); useAuth.getState().logout(); });

describe('Generator portal (phase 5)', () => {
  beforeEach(() => useAuth.getState().setSession(sessions.generator));

  it('dashboard shows today vs expected, range toggle, forecast, weather and claims on my generation', async () => {
    renderAt('/generator/dashboard');
    expect(await screen.findByText('Kutch Solar Park A')).toBeInTheDocument();
    expect(screen.getByText("Today's generation")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Last 30 days' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    expect(screen.getByRole('heading', { name: 'Last 7 days' })).toBeInTheDocument();
    expect(within(screen.getByTestId('range-summary')).getByText('7 day(s)')).toBeInTheDocument();
    expect(screen.getByText('Next 24 hours')).toBeInTheDocument();
    expect(screen.getByText('Solar irradiance')).toBeInTheDocument();
    expect(screen.getByTestId('my-claims')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload Generation Data' })).toHaveAttribute('href', '/generator/submit');
  });

  it('forecast page shows 24/48/72 h KPIs with ranges', async () => {
    renderAt('/generator/forecast');
    expect(await screen.findByText('Next 24 hours')).toBeInTheDocument();
    expect(screen.getByText('Next 48 hours')).toBeInTheDocument();
    expect(screen.getByText('Next 72 hours')).toBeInTheDocument();
    expect(screen.getAllByText(/Expected range/).length).toBe(3);
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ url: '/prediction/forecast/GEN-001' }));
  });

  it('generation data page lists rows with AI predictions and links to upload', async () => {
    renderAt('/generator/generation');
    expect(await screen.findByText('Generation data')).toBeInTheDocument();
    expect((await screen.findAllByText('Daily total')).length).toBeGreaterThan(0);
    expect(screen.getByText('AI predicted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CSV template' })).toHaveAttribute('href', 'http://api.test/api/generation/GEN-001/template.csv');
  });

  it('manual entry posts a generation row; CSV upload posts multipart', async () => {
    renderAt('/generator/submit');
    expect(await screen.findByText('Submit generation data')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-11' } });
    fireEvent.change(screen.getByLabelText('Generation (kWh)'), { target: { value: '18400' } });
    fireEvent.change(screen.getByLabelText('Meter reading (kWh)'), { target: { value: '1284400' } });
    fireEvent.change(screen.getByLabelText('Operating hours'), { target: { value: '11.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save reading' }));
    await waitFor(() => expect(lastCall('/generation')).toBeTruthy());
    expect(lastCall('/generation')!.data).toEqual({ plant_id: 'GEN-001', rows: [{ date: '2026-09-11', hour: null, generation_kwh: 18400, meter_reading_kwh: 1284400, operating_hours: 11.5 }] });

    renderAt('/generator/submit');
    const file = new File(['Date,Time,Generation\n2026-09-11,,18400\n'], 'gen.csv', { type: 'text/csv' });
    const inputs = await screen.findAllByLabelText('CSV file');
    fireEvent.change(inputs[inputs.length - 1], { target: { files: [file] } });
    const buttons = screen.getAllByRole('button', { name: 'Upload Generation Data' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(lastCall('/generation/upload')).toBeTruthy());
    const form = lastCall('/generation/upload')!.data as FormData;
    expect(form.get('plant_id')).toBe('GEN-001');
    expect(form.get('file')).toBe(file);
  });
});

describe('Institution portal (phase 5)', () => {
  beforeEach(() => useAuth.getState().setSession(sessions.institution));

  it('submit claim converts MWh to kWh, sends the certificate file and lands on the claim status timeline', async () => {
    renderAt('/institution/claims/new');
    expect(await screen.findByText('Submit claim')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline')).toHaveTextContent('Ledger lookup');
    await screen.findByText('GEN-001 — Kutch Solar Park A');
    fireEvent.change(screen.getByLabelText('Generator plant ID'), { target: { value: 'GEN-001' } });
    fireEvent.change(screen.getByLabelText('Certificate ID'), { target: { value: 'rec-1022' } });
    fireEvent.change(screen.getByLabelText('Transaction ID'), { target: { value: 'TXN-2026-0001' } });
    fireEvent.change(screen.getByLabelText('Claimed renewable energy (MWh)'), { target: { value: '890' } });
    fireEvent.change(screen.getByLabelText('Generation period — start'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Generation period — end'), { target: { value: '2026-08-31' } });
    const cert = new File([new Uint8Array([137, 80, 78, 71])], 'REC-1022.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Certificate upload (PNG or PDF)'), { target: { files: [cert] } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for Verification' }));
    await waitFor(() => expect(lastCall('/claims')).toBeTruthy());
    const form = lastCall('/claims')!.data as FormData;
    expect(form.get('claimed_kwh')).toBe('890000');
    expect(form.get('cert_id')).toBe('REC-1022');
    expect(form.get('file')).toBe(cert);
    expect(await screen.findByText('Verification timeline')).toBeInTheDocument();
    expect(screen.getByText('Claim Submitted')).toBeInTheDocument();
    expect(screen.getByText('Final Decision')).toBeInTheDocument();
  });

  it('claim status page shows the security chain and comparison for a flagged claim', async () => {
    renderAt('/institution/claims/CLM-0001');
    expect(await screen.findByText('Verification timeline')).toBeInTheDocument();
    expect(screen.getByText('REC Security Verification')).toBeInTheDocument();
    expect(screen.getByText('Claimed vs AI Expected vs Actual')).toBeInTheDocument();
  });

  it('certificates and transactions pages render their tables', async () => {
    renderAt('/institution/certificates');
    expect(await screen.findByRole('heading', { name: 'Certificates' })).toBeInTheDocument();
    expect(await screen.findByText('Final')).toBeInTheDocument();
    renderAt('/institution/transactions');
    expect((await screen.findAllByText('Transactions')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Seller plant')).toBeInTheDocument();
  });
});

describe('Issuer and verifier modules (phase 5)', () => {
  it('issuer form posts /rec/issue and shows the pipeline, result, preview and verify link', async () => {
    useAuth.getState().setSession(sessions.issuer ?? sessions.government);
    renderAt('/issuer/create-rec');
    expect(await screen.findByRole('heading', { name: 'Issue REC' })).toBeInTheDocument();
    await screen.findByText('GEN-001 — Kutch Solar Park A');
    fireEvent.change(screen.getByLabelText('Certificate ID'), { target: { value: 'REC-001' } });
    fireEvent.change(screen.getByLabelText('Generator ID'), { target: { value: 'GEN-001' } });
    fireEvent.change(screen.getByLabelText('Energy (kWh)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Generation date'), { target: { value: '2026-08-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue REC' }));
    await waitFor(() => expect(lastCall('/rec/issue')).toBeTruthy());
    expect(lastCall('/rec/issue')!.data).toMatchObject({ certificate_id: 'REC-001', generator_id: 'GEN-001', energy_kwh: 100, generation_date: '2026-08-10', energy_type: 'Solar' });
    expect(await screen.findByText(/Successfully Issued/)).toBeInTheDocument();
    expect(screen.getByText('Ledger Registration')).toBeInTheDocument();
    expect(screen.getByTestId('cert-preview')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verify it now/ })).toHaveAttribute('href', '/verifier');
  });

  it('verifier uploads a file, posts /rec/verify and shows the four steps and verdict', async () => {
    renderAt('/verifier');
    expect(await screen.findByText('Verify a certificate')).toBeInTheDocument();
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'suspect.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Certificate file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify certificate' }));
    await waitFor(() => expect(lastCall('/rec/verify')).toBeTruthy());
    expect((lastCall('/rec/verify')!.data as FormData).get('file')).toBe(file);
    expect(await screen.findByText('✓ VALID REC')).toBeInTheDocument();
    expect(screen.getByText(/STEP 4 · Generation Reconciliation/)).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });
});
