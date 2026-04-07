/**
 * Wraps a promise with a 15-second timeout.
 * Rejects with a user-friendly error if the request hangs.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 15_000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Request timed out after 15 seconds. Please try again.')),
      ms
    )
  );
  return Promise.race([promise, timeout]);
}
