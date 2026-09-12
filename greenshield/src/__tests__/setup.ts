import '@testing-library/jest-dom/vitest';

class ResizeObserverShim { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverShim;
window.scrollTo = () => {};

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
}
let hasStorage = false;
try { hasStorage = typeof globalThis.localStorage?.getItem === 'function'; } catch { hasStorage = false; }
if (!hasStorage) {
  const s = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
  Object.defineProperty(window, 'localStorage', { value: s, configurable: true, writable: true });
}
