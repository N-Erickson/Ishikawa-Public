import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simplified public version without Section9 AI integration
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
