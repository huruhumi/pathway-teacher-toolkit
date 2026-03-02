import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  return {
    base: '/academy-ops/',
    envDir: path.resolve(__dirname, '../..'),
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../../packages/shared'),
      },
    },
    server: {
      port: 3005,
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      warmup: {
        clientFiles: ['./src/**/*.tsx'],
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'motion', 'react-markdown'],
    },
  };
});

