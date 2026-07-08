import { describe, expect, it, vi } from 'vitest';

import { HttpRateLimiterService } from '../../src/services/httpRateLimiterService.js';

describe('HttpRateLimiterService', () => {
  it('allows requests within fixed window limit and rejects excess', () => {
    const service = new HttpRateLimiterService();

    const first = service.consume('k', 2, 60000);
    const second = service.consume('k', 2, 60000);
    const third = service.consume('k', 2, 60000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets counter after window elapsed', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const service = new HttpRateLimiterService();
    service.consume('k', 1, 1000);

    nowSpy.mockReturnValue(2100);
    const nextWindow = service.consume('k', 1, 1000);

    expect(nextWindow.allowed).toBe(true);

    nowSpy.mockRestore();
  });
});
