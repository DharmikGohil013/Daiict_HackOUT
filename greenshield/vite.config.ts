import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const target = process.env.VITE_PROXY_TARGET || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5174,
    proxy: { '/api': { target, changeOrigin: true } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
          'vendor-charts': ['recharts', 'd3-force'],
          'vendor-ui': ['lucide-react', 'axios'],
        },
      },
    },
  },
});
