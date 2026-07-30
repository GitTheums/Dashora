export type BackoffOptions = {
  attempt: number;
  baseMs?: number;
  maxMs?: number;
  jitterRatio?: number;
  random?: () => number;
};

/**
 * Exponential backoff delay with full jitter.
 * attempt is 0-based (first retry = attempt 0 → ~baseMs).
 */
export function computeBackoffMs(options: BackoffOptions): number {
  const baseMs = options.baseMs ?? 250;
  const maxMs = options.maxMs ?? 8_000;
  const jitterRatio = options.jitterRatio ?? 1;
  const random = options.random ?? Math.random;
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, options.attempt));
  const jitter = exp * jitterRatio * random();
  return Math.min(maxMs, Math.floor(exp - jitter + jitter * random()));
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("aborted");
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
