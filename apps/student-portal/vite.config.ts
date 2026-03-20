import path from 'path';
import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { getBaseConfig } from '../../packages/config/vite.config.base';
import { getAppRegistryEntry } from '../../packages/config/appRegistry';

export default defineConfig(({ mode }) => {
    const appDir = __dirname;
    const workspaceRoot = path.resolve(appDir, '../..');
    const env = loadEnv(mode, workspaceRoot, '');
    const baseConfig = getBaseConfig(env);
    const app = getAppRegistryEntry('student');

    const isStandalone = process.env.STANDALONE === 'true' || env.STANDALONE === 'true';

    return mergeConfig(baseConfig, {
        base: isStandalone ? '/' : app.scanPath,
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
