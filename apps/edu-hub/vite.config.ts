import path from 'path';
import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { getBaseConfig } from '../../packages/config/vite.config.base';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  const baseConfig = getBaseConfig(env);
  
  return mergeConfig(baseConfig, {
    base: '/edu-hub/',
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: 3006,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../../packages/shared'),
      },
    },
  });
});
