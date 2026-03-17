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

        return mergeConfig(baseConfig, {
            base: app.scanPath,
            envDir: workspaceRoot,
            server: {
                port: app.devPort,
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
