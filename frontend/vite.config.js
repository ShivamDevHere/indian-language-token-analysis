import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config. The Flask backend is NOT connected yet, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
});
