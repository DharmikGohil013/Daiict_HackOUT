import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/api/client', async () => {
  const mock = await import('@/data/mock');
  const request = vi.fn(async (config: { method?: string; url?: string; data?: unknown }) => ({ success: true, ...(mock.route(config.method ?? 'get', config.url ?? '', config.data) as object) }));
  return { request, API_BASE: 'http://api.test', MOCK_API: true, TOKEN_KEY: 'greenshield.token', http: {}, readToken: () => null, writeToken: () => {}, fileUrl: (p: string) => `http://api.test${p}`, clean: (o: Record<string, unknown>) => o };
});

import { request } from '@/services/api/client';
import { AppRoutes } from '@/App';
import { ToastProvider } from '@/components/common/Toast';
import { useAuth } from '@/lib/auth';
import { sessions } from '@/data/mock';

const requestMock = request as unknown as ReturnType<typeof vi.fn>;
function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ToastProvider><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></ToastProvider></QueryClientProvider>);
}
beforeEach(() => { requestMock.mockClear(); useAuth.getState().logout(); useAuth.getState().setSession(sessions.government); });

describe('Risk settings editor (phase 6)', () => {
  it('loads the current configuration, validates weights and saves', async () => {
    renderAt('/government/settings');
    const form = await screen.findByTestId('risk-settings-form');
    expect(form).toBeInTheDocument();
    expect(screen.getByLabelText('MEDIUM')).toHaveValue(60);
    expect(screen.getByText('100 / 100')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Generation deviation/), { target: { value: '50' } });
    expect(screen.getByText('110 / 100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save configuration/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Weather inconsistency/), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: /Save configuration/ })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('HIGH'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: /Save configuration/ }));
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'put', url: '/settings/risk', data: expect.objectContaining({ thresholds: { LOW: 30, MEDIUM: 60, HIGH: 85 }, weights: expect.objectContaining({ generation: 50, weather: 10 }) }) })));
  });
});
