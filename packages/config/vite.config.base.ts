import path from 'path';
import { fileURLToPath } from 'url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { UserConfig } from 'vite';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(configDir, '..');

const CHUNK_RULES: Array<{ chunk: string; matchers: string[] }> = [
    { chunk: 'vendor', matchers: ['react-dom'] },
    { chunk: 'vendor', matchers: ['react'] },
    { chunk: 'icons', matchers: ['lucide-react'] },
    { chunk: 'state', matchers: ['zustand'] },
    { chunk: 'genai', matchers: ['@google/genai', '@google+genai'] },
    { chunk: 'pdf', matchers: ['jspdf'] },
    { chunk: 'animation', matchers: ['motion'] },
    { chunk: 'dnd', matchers: ['@hello-pangea/dnd', '@hello-pangea+dnd'] },
    { chunk: 'supabase', matchers: ['@supabase/supabase-js', '@supabase+supabase-js'] },
];

function resolveChunkName(id: string): string | undefined {
    if (!id.includes('node_modules')) return undefined;

    for (const rule of CHUNK_RULES) {
        if (rule.matchers.some((matcher) => id.includes(matcher))) {
            return rule.chunk;
        }
    }

    return undefined;
}

export function getBaseConfig(env: Record<string, string>): UserConfig {
    const disableEsbuild = env.VITE_DISABLE_ESBUILD === '1' || env.VITE_DISABLE_ESBUILD === 'true';
    const optimizeDeps = disableEsbuild
        ? { disabled: true }
        : {
              include: ['react', 'react-dom', 'lucide-react'],
              holdUntilCrawlEnd: true,  // wait for full crawl before optimizing éˆ?less memory churn
          };

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
                ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.agents/**', '**/.gemini/**', '**/scripts/**'],
            },
            warmup: {
                clientFiles: [],  // disable warmup to avoid memory spike at startup
            },
        },
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@pathway/ai': path.resolve(packagesDir, 'ai', 'src'),
                '@pathway/i18n': path.resolve(packagesDir, 'i18n', 'src'),
                '@pathway/notebooklm': path.resolve(packagesDir, 'notebooklm', 'src'),
                '@pathway/ui': path.resolve(packagesDir, 'ui', 'src'),
                '@pathway/platform': path.resolve(packagesDir, 'platform', 'src'),
                '@pathway/education': path.resolve(packagesDir, 'education', 'src'),
            },
            dedupe: ['react', 'react-dom'],
        },
        optimizeDeps,
        esbuild: disableEsbuild ? false : undefined,
        css: {
            devSourcemap: false,  // reduce memory in dev mode
        },
        build: {
            sourcemap: false,
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    manualChunks: resolveChunkName,
                },
            },
        },
    };
}

