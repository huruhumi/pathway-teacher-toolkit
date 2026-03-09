/**
 * Centralized Logger
 *
 * Provides structured logging with severity levels.
 * All console output is funneled through here so it can be
 * extended to remote services (e.g. Sentry, LogRocket) later.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: string;
    data?: unknown;
    timestamp: string;
}

const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

function createEntry(level: LogLevel, message: string, context?: string, data?: unknown): LogEntry {
    return {
        level,
        message,
        context,
        data,
        timestamp: new Date().toISOString(),
    };
}

function push(entry: LogEntry) {
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
}

/**
 * Unified logger used across all Pathway Academy apps.
 *
 * Usage:
 *   logger.info('User logged in', 'AuthProvider');
 *   logger.error('Failed to fetch', 'useLessonHistory', error);
 */
export const logger = {
    debug(message: string, context?: string, data?: unknown) {
        const entry = createEntry('debug', message, context, data);
        push(entry);
        if (import.meta.env.DEV) {
            console.debug(`[${context || 'app'}]`, message, data ?? '');
        }
    },

    info(message: string, context?: string, data?: unknown) {
        const entry = createEntry('info', message, context, data);
        push(entry);
        console.info(`[${context || 'app'}]`, message, data ?? '');
    },

    warn(message: string, context?: string, data?: unknown) {
        const entry = createEntry('warn', message, context, data);
        push(entry);
        console.warn(`[${context || 'app'}]`, message, data ?? '');
    },

    error(message: string, context?: string, data?: unknown) {
        const entry = createEntry('error', message, context, data);
        push(entry);
        console.error(`[${context || 'app'}]`, message, data ?? '');

        // Future: send to remote error tracking service here
        // e.g. Sentry.captureException(data instanceof Error ? data : new Error(message));
    },

    /** Get the in-memory log buffer (useful for crash reports) */
    getBuffer(): ReadonlyArray<LogEntry> {
        return logBuffer;
    },
};

/**
 * Safely extract a human-readable message from an unknown error.
 * Use in catch blocks: `const msg = getErrorMessage(e, 'Something went wrong');`
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return fallback;
}

/**
 * Log an error and return its message string.
 * Combines getErrorMessage + logger.error in one call.
 *
 * Usage: `setErrorMsg(handleError(e, 'Failed to generate', 'LessonPlanTab'));`
 */
export function handleError(error: unknown, fallback: string, context?: string): string {
    const message = getErrorMessage(error, fallback);
    logger.error(message, context, error);
    return message;
}

/**
 * Global error handlers.
 * Call `installGlobalErrorHandlers()` once at app startup to catch
 * unhandled errors and promise rejections.
 */
export function installGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
        logger.error(
            event.message || 'Uncaught error',
            'window.onerror',
            { filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error },
        );
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error(
            event.reason?.message || 'Unhandled promise rejection',
            'unhandledrejection',
            event.reason,
        );
    });
}
