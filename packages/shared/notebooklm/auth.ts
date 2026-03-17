/**
 * NotebookLM authentication utilities.
 * 
 * Handles cookie-based auth for the unofficial NotebookLM API.
 * Cookies are read from the NOTEBOOKLM_COOKIES environment variable
 * and NEVER exposed to the frontend.
 */

export interface NLMAuthConfig {
    cookies: string;
    isValid: boolean;
    expiresAt?: Date;
}

/**
 * Load NotebookLM auth cookies from environment.
 * Falls back to checking for the notebooklm-py cached config.
 */
export function loadAuthConfig(): NLMAuthConfig {
    const cookies = process.env.NOTEBOOKLM_COOKIES || '';

    if (!cookies) {
        return { cookies: '', isValid: false };
    }

    // Try to detect expiry from cookie string (rough heuristic)
    const expiresMatch = cookies.match(/expires=([^;]+)/i);
    const expiresAt = expiresMatch ? new Date(expiresMatch[1]) : undefined;
    const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;

    return {
        cookies,
        isValid: !isExpired && cookies.length > 0,
        expiresAt,
    };
}

/**
 * Check if auth is still valid, throw a descriptive error if not.
 */
export function requireAuth(): string {
    const config = loadAuthConfig();
    if (!config.isValid) {
        throw new Error(
            'NotebookLM auth expired or missing. ' +
            'Run `notebooklm-mcp-auth` to re-authenticate, then set NOTEBOOKLM_COOKIES env var.'
        );
    }
    return config.cookies;
}
