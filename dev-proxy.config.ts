import { defineConfig } from 'vite';

export default defineConfig({
    // Empty root — proxy only, no source files to scan
    root: './scripts',
    server: {
        port: 5180,
        proxy: {
            '/planner': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                ws: true,
            },
            '/essay-lab': {
                target: 'http://localhost:3002',
                changeOrigin: true,
                ws: true,
            },
            '/nature-compass': {
                target: 'http://localhost:3003',
                changeOrigin: true,
                ws: true,
            },
            '/academy-ops': {
                target: 'http://localhost:3005',
                changeOrigin: true,
                ws: true,
            },
        },
    },
    // Don't scan any files for optimization
    optimizeDeps: {
        noDiscovery: true,
        include: [],
    },
});
