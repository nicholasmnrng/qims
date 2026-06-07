import { HttpError } from "./http-error";
import { getClientIp } from "./request";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  namespace: string;
  key?: string | null;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();

function bucketKey(request: Request, options: RateLimitOptions) {
  const clientKey = options.key ?? getClientIp(request) ?? "anonymous";
  return `${options.namespace}:${clientKey}`;
}

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const key = bucketKey(request, options);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + options.windowMs };
    buckets.set(key, next);
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: next.resetAt,
    };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: options.limit - current.count,
    resetAt: current.resetAt,
  };
}

export function assertRateLimit(request: Request, options: RateLimitOptions) {
  const result = checkRateLimit(request, options);

  if (!result.allowed) {
    throw new HttpError(429, "RATE_LIMITED", "Terlalu banyak request. Coba lagi nanti.", {
      resetAt: new Date(result.resetAt).toISOString(),
    });
  }

  return result;
}

export function resetRateLimitForTests() {
  buckets.clear();
}
