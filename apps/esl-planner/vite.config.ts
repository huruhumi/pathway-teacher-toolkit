import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  return {
    base: '/planner/',
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 3001,
      warmup: {
        clientFiles: ['./**/*.tsx'],
      },
      proxy: {
        '/supabase-proxy': {
          target: env.VITE_SUPABASE_URL || 'https://mjvxaicypucfrrvollwm.supabase.co',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/supabase-proxy/, ''),
          secure: true,
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../../packages/shared'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'react-markdown'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            icons: ['lucide-react'],
            state: ['zustand'],
            markdown: ['react-markdown'],
          },
        },
      },
    },
  };
});

