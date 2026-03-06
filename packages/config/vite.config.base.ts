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
        },
        plugins: [react(), tailwindcss()],
        resolve: {
            dedupe: ['react', 'react-dom'],
        },
        optimizeDeps: {
            include: ['react', 'react-dom', 'lucide-react'],
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom'],
                        icons: ['lucide-react'],
                        state: ['zustand'],
                    },
                },
            },
        },
    };
}
