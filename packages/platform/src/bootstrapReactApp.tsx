import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppQueryProvider } from '../../shared/providers/QueryProvider';
import { installGlobalErrorHandlers } from '../../shared/services/logger';

interface BootstrapReactAppOptions {
    rootId?: string;
    strictMode?: boolean;
    withQueryProvider?: boolean;
    installErrorHandlers?: boolean;
}

export function bootstrapReactApp(
    app: ReactNode,
    options: BootstrapReactAppOptions = {},
): void {
    const {
        rootId = 'root',
        strictMode = true,
        withQueryProvider = true,
        installErrorHandlers = true,
    } = options;

    if (installErrorHandlers) {
        installGlobalErrorHandlers();
    }

    const rootElement = document.getElementById(rootId);
    if (!rootElement) {
        throw new Error(`Could not find root element "${rootId}" to mount app`);
    }

    let tree: ReactNode = app;
    if (withQueryProvider) {
        tree = <AppQueryProvider>{tree}</AppQueryProvider>;
    }
    if (strictMode) {
        tree = <StrictMode>{tree}</StrictMode>;
    }

    createRoot(rootElement).render(tree);
}

export type { BootstrapReactAppOptions };
