const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, '../apps');
const apps = fs.readdirSync(appsDir);

apps.forEach(app => {
    const appPath = path.join(appsDir, app);
    if (!fs.statSync(appPath).isDirectory()) return;

    // 1. Refactor tsconfig.json
    const tsconfigPath = path.join(appPath, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

        // Create new tsconfig
        const newTsconfig = {
            extends: '../../packages/config/tsconfig.base.json',
            compilerOptions: {
                paths: tsconfig.compilerOptions?.paths || {
                    "@/*": ["./*"],
                    "@shared/*": ["../../packages/shared/*"]
                }
            }
        };
        if (tsconfig.compilerOptions?.types) {
            newTsconfig.compilerOptions.types = tsconfig.compilerOptions.types;
        }

        fs.writeFileSync(tsconfigPath, JSON.stringify(newTsconfig, null, 2));
        console.log(`Updated ${app}/tsconfig.json`);
    }

    // 2. Refactor CSS files
    const cssFiles = [
        'index.css',
        'src/index.css',
        'App.css',
        'app.css',
        'global.css',
        'src/global.css'
    ].map(f => path.join(appPath, f));

    cssFiles.forEach(cssPath => {
        if (fs.existsSync(cssPath)) {
            let css = fs.readFileSync(cssPath, 'utf8');
            css = css.replace(/@import\s+['"]tailwindcss['"];\n?/g, '');
            css = css.replace(/@import\s+['"].*?tokens\.css['"];\n?/g, '');
            css = css.replace(/@source\s+['"].*?['"];\n?/g, '');
            css = css.replace(/@custom-variant\s+dark.*?;\n?/g, '');

            css = '@import "../../packages/shared/styles/tailwind.css";\n\n' + css.trim();
            fs.writeFileSync(cssPath, css);
            console.log(`Updated ${cssPath}`);
        }
    });

    // 3. Refactor vite.config.ts
    const vitePath = path.join(appPath, 'vite.config.ts');
    if (fs.existsSync(vitePath)) {
        let vite = fs.readFileSync(vitePath, 'utf8');

        // We will parse out base and port simply, or just rewrite it
        const portMatch = vite.match(/port:\s*(\d+)/);
        const port = portMatch ? portMatch[1] : '3000';

        const baseMatch = vite.match(/base:\s*['"]([^'"]+)['"]/);
        const base = baseMatch ? baseMatch[1] : '/';

        const newVite = `import path from 'path';
import { defineConfig, loadEnv, mergeConfig } from 'vite';
import { getBaseConfig } from '../../packages/config/vite.config.base';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  const baseConfig = getBaseConfig(env);
  
  return mergeConfig(baseConfig, {
    base: '${base}',
    envDir: path.resolve(__dirname, '../..'),
    server: {
      port: ${port},
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@shared': path.resolve(__dirname, '../../packages/shared'),
      },
    },
  });
});
`;
        fs.writeFileSync(vitePath, newVite);
        console.log(`Updated ${app}/vite.config.ts`);
    }
});
