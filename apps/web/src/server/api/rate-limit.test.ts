import { afterEach, describe, expect, it, vi } from "vitest";

import { assertRateLimit, checkRateLimit, resetRateLimitForTests } from "./rate-limit";

afterEach(() => {
  resetRateLimitForTests();
  vi.useRealTimers();
});

describe("rate limit hardening", () => {
  it("blocks requests after the configured limit", () => {
    const request = new Request("http://qims.local/api/auth/login", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    });

    expect(checkRateLimit(request, { namespace: "login", limit: 2, windowMs: 1000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit(request, { namespace: "login", limit: 2, windowMs: 1000 })).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit(request, { namespace: "login", limit: 2, windowMs: 1000 })).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("resets the bucket after the window", () => {
    vi.useFakeTimers();
    const request = new Request("http://qims.local/api/reports/export");

    assertRateLimit(request, {
      namespace: "reports.export",
      key: "qa-1",
      limit: 1,
      windowMs: 1000,
    });
    expect(() =>
      assertRateLimit(request, {
        namespace: "reports.export",
        key: "qa-1",
        limit: 1,
        windowMs: 1000,
      }),
    ).toThrow("Terlalu banyak request");

    vi.advanceTimersByTime(1001);
    expect(() =>
      assertRateLimit(request, {
        namespace: "reports.export",
        key: "qa-1",
        limit: 1,
        windowMs: 1000,
      }),
    ).not.toThrow();
  });
});
