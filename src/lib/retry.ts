export async function withRetry<T>(
    fn: () => Promise<T>,
    options = { maxRetries: 3, backoff: 1000 }
): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= options.maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (i < options.maxRetries) {
                await new Promise(resolve =>
                    setTimeout(resolve, options.backoff * Math.pow(2, i))
                );
            }
        }
    }

    throw lastError!;
}
