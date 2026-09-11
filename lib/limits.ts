const windows = new Map<string, number[]>();

function take(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((time) => now - time < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  windows.set(key, hits);
  return true;
}

export function rateLimitOrThrow(
  key: string,
  limit: number,
  windowMs: number,
  message: string,
) {
  if (!take(key, limit, windowMs)) {
    throw Object.assign(new Error(message), { status: 429 });
  }
}

export function enforceProbeLimit(ip: string) {
  rateLimitOrThrow(`probe:${ip}`, 30, 60_000, "Too many unpaid probes");
}

export function enforcePaidCreateLimit(payer: string) {
  rateLimitOrThrow(
    `create:${payer}`,
    10,
    60 * 60 * 1000,
    "Per-wallet create rate limit reached",
  );
}

export function enforcePaymentMethodLimit(method: string) {
  rateLimitOrThrow(
    `method:${method}`,
    40,
    60 * 60 * 1000,
    "Per-payment-method rate limit reached",
  );
}

export function enforceDownloadLimit(payer: string) {
  rateLimitOrThrow(
    `download:${payer}`,
    60,
    60_000,
    "Per-wallet download rate limit reached",
  );
}
