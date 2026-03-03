import { retryWithBackoff } from '../retryWithBackoff';

const MAX_RETRIES = 5;
const BASE_DELAY = 3000;

/**
 * Standardized retry utility for all AI API calls (Gemini).
 * Utilizes exponential backoff with a base delay of 3 seconds, up to 5 retries.
 * 
 * @param operation The async operation to execute and retry on failure
 * @param signal Optional AbortSignal to cancel the operation and prevent further retries
 * @returns The result of the operation
 */
export const retryAICall = <T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> =>
    retryWithBackoff(operation, { maxRetries: MAX_RETRIES, baseDelay: BASE_DELAY, signal });
