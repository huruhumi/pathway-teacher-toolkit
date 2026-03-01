/**
 * Shared retry-with-exponential-backoff utility for Gemini API calls.
 * Handles 429 (rate limit), 503 (overloaded), and 500 (server error).
 * Supports AbortSignal for cancellable operations.
 */

export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    signal?: AbortSignal;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY = 3000;

export async function retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = DEFAULT_MAX_RETRIES,
        baseDelay = DEFAULT_BASE_DELAY,
        signal,
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (signal?.aborted) {
            throw new Error("Operation aborted");
        }

        try {
            return await operation();
        } catch (error: any) {
            if (signal?.aborted) {
                throw new Error("Operation aborted");
            }
            lastError = error;

            const errorMessage = error?.message || JSON.stringify(error);
            const errorCode = error?.status || error?.code;
            const nestedCode = error?.error?.code || error?.error?.status;
            const nestedMessage = error?.error?.message;

            const isOverloaded =
                errorCode === 503 || nestedCode === 503 ||
                errorMessage.includes('503') ||
                errorMessage.includes('overloaded') ||
                (nestedMessage && nestedMessage.includes('overloaded'));

            const isRateLimited =
                errorCode === 429 || nestedCode === 429 ||
                errorMessage.includes('429') ||
                errorMessage.toLowerCase().includes('quota') ||
                errorMessage.toLowerCase().includes('resource_exhausted');

            const isServerError =
                errorCode === 500 || nestedCode === 500 ||
                errorMessage.toLowerCase().includes('no image generated');

            const isAuthError =
                errorCode === 401 || errorCode === 403 ||
                errorMessage.includes('401') ||
                errorMessage.includes('403') ||
                errorMessage.includes('API key');

            const isRetryable = (isOverloaded || isRateLimited || isServerError) && attempt < maxRetries - 1;

            if (isRetryable) {
                const delay = baseDelay * Math.pow(2, attempt);
                const waitTime = isRateLimited ? delay * 2 : delay; // extra backoff for rate limits
                console.warn(
                    `API error (${errorCode || nestedCode || 'unknown'}). ` +
                    `Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxRetries})`
                );

                // Abortable delay
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        signal?.removeEventListener('abort', onAbort);
                        resolve();
                    }, waitTime);

                    const onAbort = () => {
                        clearTimeout(timeout);
                        reject(new Error("Operation aborted"));
                    };

                    signal?.addEventListener('abort', onAbort);
                });

                continue;
            }

            // Non-retryable or out of retries — throw descriptive error
            if (isAuthError) {
                throw new Error("Invalid API Key or authentication failed. Please check your .env file.");
            }
            if (isRateLimited) {
                throw new Error("Rate limit exceeded. Please wait a moment and try again.");
            }
            if (isOverloaded) {
                throw new Error("Gemini API is currently overloaded. Please try again in a few seconds.");
            }

            throw new Error(nestedMessage || errorMessage || "An unexpected error occurred during AI generation.");
        }
    }
    throw lastError;
}
