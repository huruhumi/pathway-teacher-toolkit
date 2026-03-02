import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  return {
    base: '/essay-lab/',
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 3002,
      strictPort: true,
      warmup: {
        clientFiles: ['./**/*.tsx'],
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../../packages/shared'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react'],
    },
  };
});

