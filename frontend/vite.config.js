import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In dev, proxy /api calls to the local Express backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        // Ensure cookies are forwarded correctly
        cookieDomainRewrite: 'localhost',
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
