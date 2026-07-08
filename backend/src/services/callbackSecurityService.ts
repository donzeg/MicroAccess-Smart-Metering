import { createHmac, timingSafeEqual } from 'node:crypto';

import { canonicalStringify } from '../utils/canonicalJson.js';

interface CallbackHeaders {
  callbackId: string;
  timestamp: string;
  signature: string;
}

export interface CallbackSecurityOptions {
  secret: string;
  toleranceSeconds: number;
}

export interface VerificationResult {
  ok: boolean;
  reason?: string;
}

export class CallbackSecurityService {
  private readonly seenCallbackIds = new Map<string, number>();

  constructor(private readonly options: CallbackSecurityOptions) {}

  verify(requestHeaders: Record<string, unknown>, payload: unknown): VerificationResult {
    if (!this.options.secret) {
      return { ok: false, reason: 'callback_secret_not_configured' };
    }

    const headers = this.extractHeaders(requestHeaders);
    if (!headers) {
      return { ok: false, reason: 'missing_callback_headers' };
    }

    const timestampMs = Number(headers.timestamp) * 1000;
    if (!Number.isFinite(timestampMs)) {
      return { ok: false, reason: 'invalid_callback_timestamp' };
    }

    const now = Date.now();
    const toleranceMs = this.options.toleranceSeconds * 1000;
    if (Math.abs(now - timestampMs) > toleranceMs) {
      return { ok: false, reason: 'callback_timestamp_outside_tolerance' };
    }

    this.sweepExpired(now);

    if (this.seenCallbackIds.has(headers.callbackId)) {
      return { ok: false, reason: 'replayed_callback_id' };
    }

    const expectedSignature = this.sign(headers.timestamp, headers.callbackId, payload);
    if (!this.safeCompare(expectedSignature, headers.signature)) {
      return { ok: false, reason: 'invalid_callback_signature' };
    }

    this.seenCallbackIds.set(headers.callbackId, now + toleranceMs);
    return { ok: true };
  }

  private sign(timestamp: string, callbackId: string, payload: unknown): string {
    const canonicalPayload = canonicalStringify(payload);
    const content = `${timestamp}.${callbackId}.${canonicalPayload}`;
    return createHmac('sha256', this.options.secret).update(content).digest('hex');
  }

  private extractHeaders(headers: Record<string, unknown>): CallbackHeaders | null {
    const callbackId = headers['x-callback-id'];
    const timestamp = headers['x-callback-timestamp'];
    const signature = headers['x-callback-signature'];

    if (typeof callbackId !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string') {
      return null;
    }

    if (callbackId.length === 0 || timestamp.length === 0 || signature.length === 0) {
      return null;
    }

    return { callbackId, timestamp, signature };
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private sweepExpired(now: number): void {
    for (const [callbackId, expiresAt] of this.seenCallbackIds.entries()) {
      if (expiresAt <= now) {
        this.seenCallbackIds.delete(callbackId);
      }
    }
  }
}
