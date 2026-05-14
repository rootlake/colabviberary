import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Demo mode: redirect all firebase imports to the in-memory mock layer.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      'firebase/app': path.resolve(__dirname, 'src/mock/app.js'),
      'firebase/auth': path.resolve(__dirname, 'src/mock/auth.js'),
      'firebase/firestore': path.resolve(__dirname, 'src/mock/firestore.js')
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
