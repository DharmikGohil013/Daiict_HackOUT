// Axios adapter that answers from mockData instead of the network.
// Enabled with VITE_MOCK_API=true — lets the UI run with no backend.
import { route } from './mockData';

const LATENCY_MS = 300;

export function mockAdapter(config) {
  const method = (config.method || 'get').toUpperCase();
  const base = config.baseURL || '';
  const path = String(config.url || '').replace(base, '').split('?')[0];
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const data = route(method, path, config);
        resolve({ data, status: 200, statusText: 'OK', headers: {}, config, request: {} });
      } catch (e) {
        const err = new Error(e.message);
        err.config = config;
        err.response = { status: 404, data: { success: false, error: `Mock API: ${e.message}` } };
        reject(err);
      }
    }, LATENCY_MS);
  });
}

/** In mock mode every certificate file resolves to the bundled sample PNG. */
export function mockFileUrl(path) {
  return path && path.includes('/api/certificate/') ? '/mock/valid_cert.png' : path;
}
