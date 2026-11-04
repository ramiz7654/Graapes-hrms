import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The browser talks to /api on the same origin; Vite forwards it to the Express API.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
});
