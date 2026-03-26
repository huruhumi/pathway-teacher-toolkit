import path from 'path';
import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { getBaseConfig } from './vite.config.base';
import { getAppRegistryEntry, type RegistryAppId } from './appRegistry';

export function createAppViteConfig(appId: RegistryAppId, appDir: string) {
    return defineConfig(({ mode }) => {
        const workspaceRoot = path.resolve(appDir, '../..');
        const env = loadEnv(mode, workspaceRoot, '');
        const baseConfig = getBaseConfig(env);
        const app = getAppRegistryEntry(appId);
        const scanPathNoTrailingSlash = app.scanPath.endsWith('/')
            ? app.scanPath.slice(0, -1)
            : app.scanPath;

        return mergeConfig(baseConfig, {
            base: app.scanPath,
            plugins: [
                {
                    name: 'pathway-base-trailing-slash-redirect',
                    configureServer(server) {
                        if (!scanPathNoTrailingSlash || scanPathNoTrailingSlash === '/') return;
                        server.middlewares.use((req, res, next) => {
                            if (req.url === scanPathNoTrailingSlash) {
                                res.statusCode = 302;
                                res.setHeader('Location', `${scanPathNoTrailingSlash}/`);
                                res.end();
                                return;
                            }
                            next();
                        });
                    },
                },
            ],
            envDir: workspaceRoot,
            server: {
                port: app.devPort,
                strictPort: true,
            },
            resolve: {
                alias: {
                    '@': path.resolve(appDir, '.'),
                    '@shared': path.resolve(appDir, '../../packages/shared'),
                },
            },
        });
    });
}
