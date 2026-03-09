/**
 * Run async tasks with a sliding-window concurrency limit.
 * Tasks start as soon as a slot opens, giving better throughput than chunk-based approaches.
 */
export async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    handler: (item: T, index: number) => Promise<void>,
    shouldCancel?: () => boolean,
): Promise<void> {
    const inFlight = new Set<Promise<void>>();

    for (let i = 0; i < items.length; i++) {
        if (shouldCancel?.()) break;

        const p = handler(items[i], i).finally(() => inFlight.delete(p));
        inFlight.add(p);

        if (inFlight.size >= concurrency) {
            await Promise.race(inFlight);
        }
    }

    // Wait for remaining in-flight tasks
    if (inFlight.size > 0) {
        await Promise.allSettled(inFlight);
    }
}
