import appRegistry from './app-registry.json';

export type RegistryAppId = 'planner' | 'essay' | 'nature' | 'ops' | 'edu' | 'student';

export interface AppRegistryEntry {
    id: RegistryAppId;
    name: string;
    workspace: string;
    distSource: string;
    distTarget: string;
    devPort: number;
    scanPath: string;
    devCmd: string;
}

export const APP_REGISTRY = appRegistry as AppRegistryEntry[];

export function getAppRegistryEntry(appId: RegistryAppId): AppRegistryEntry {
    const app = APP_REGISTRY.find((item) => item.id === appId);
    if (!app) {
        throw new Error(`Unknown app id "${appId}" in app-registry.json`);
    }
    return app;
}
