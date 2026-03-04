import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendHost = process.env.BACKEND_HOST ?? 'localhost';
const backendPort = process.env.BACKEND_PORT ?? '3001';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://${backendHost}:${backendPort}`,
        ws: true,
      },
    },
  },
});
