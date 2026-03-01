import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  return {
    base: './',
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 3002,
      strictPort: true,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../../packages/shared'),
      }
    }
  };
});
