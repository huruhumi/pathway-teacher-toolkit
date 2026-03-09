import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { UserConfig } from 'vite';

export function getBaseConfig(env: Record<string, string>): UserConfig {
    return {
        server: {
            proxy: {
                '/supabase-proxy': {
                    target: env.VITE_SUPABASE_URL || 'https://mjvxaicypucfrrvollwm.supabase.co',
                    changeOrigin: true,
                    rewrite: (path: string) => path.replace(/^\/supabase-proxy/, ''),
                    secure: true,
                },
            },
            // Reduce file-watcher memory footprint
            watch: {
                ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
            },
            warmup: {
                clientFiles: [],  // disable warmup to avoid memory spike at startup
            },
        },
        plugins: [react(), tailwindcss()],
        resolve: {
            dedupe: ['react', 'react-dom'],
        },
        optimizeDeps: {
            include: ['react', 'react-dom', 'lucide-react'],
            holdUntilCrawlEnd: true,  // wait for full crawl before optimizing — less memory churn
        },
        build: {
            sourcemap: false,
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom'],
                        icons: ['lucide-react'],
                        state: ['zustand'],
                        genai: ['@google/genai'],
                        pdf: ['jspdf'],
                        animation: ['motion'],
                        dnd: ['@hello-pangea/dnd'],
                        supabase: ['@supabase/supabase-js'],
                    },
                },
            },
        },
    };
}
