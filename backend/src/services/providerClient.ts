import { randomUUID } from 'node:crypto';

export interface ProviderCreditRequest {
  customerId: string;
  amount: number;
  idempotencyKey: string;
}

export interface ProviderCreditResult {
  providerReference: string;
  status: 'success' | 'failed';
  reason?: string;
}

export interface CreditProvider {
  postCustomerCredit: (request: ProviderCreditRequest) => Promise<ProviderCreditResult>;
}

export class ProviderClient {
  private readonly resultByKey = new Map<string, ProviderCreditResult>();

  async postCustomerCredit(request: ProviderCreditRequest): Promise<ProviderCreditResult> {
    const existing = this.resultByKey.get(request.idempotencyKey);
    if (existing) {
      return existing;
    }

    if (request.amount <= 0) {
      const failed: ProviderCreditResult = {
        providerReference: `prov-${randomUUID()}`,
        status: 'failed',
        reason: 'invalid_amount'
      };
      this.resultByKey.set(request.idempotencyKey, failed);
      return failed;
    }

    const success: ProviderCreditResult = {
      providerReference: `prov-${randomUUID()}`,
      status: 'success'
    };
    this.resultByKey.set(request.idempotencyKey, success);
    return success;
  }
}

export interface SteamaProviderClientOptions {
  baseUrl: string;
  tokenPath: string;
  username: string;
  password: string;
  timeoutMs: number;
  requestsPerSecond: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

class ProviderRequestThrottle {
  private readonly intervalMs: number;
  private queue = Promise.resolve();
  private nextAllowedAt = 0;

  constructor(requestsPerSecond: number) {
    this.intervalMs = Math.max(1, Math.ceil(1000 / Math.max(1, requestsPerSecond)));
  }

  async waitTurn(): Promise<void> {
    const run = async (): Promise<void> => {
      const now = Date.now();
      const delayMs = Math.max(0, this.nextAllowedAt - now);
      if (delayMs > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }

      this.nextAllowedAt = Math.max(this.nextAllowedAt, Date.now()) + this.intervalMs;
    };

    this.queue = this.queue.then(run, run);
    await this.queue;
  }
}

export class SteamaProviderClient implements CreditProvider {
  private cachedToken: CachedToken | null = null;
  private readonly throttle: ProviderRequestThrottle;

  constructor(private readonly options: SteamaProviderClientOptions) {
    this.throttle = new ProviderRequestThrottle(options.requestsPerSecond);
  }

  async postCustomerCredit(request: ProviderCreditRequest): Promise<ProviderCreditResult> {
    if (request.amount <= 0) {
      return {
        providerReference: `prov-${randomUUID()}`,
        status: 'failed',
        reason: 'invalid_amount'
      };
    }

    try {
      const token = await this.getAccessToken();
      await this.throttle.waitTurn();
      const endpoint = `${this.normalizeBaseUrl()}/customers/${encodeURIComponent(request.customerId)}/transactions/`;
      const body = {
        amount: request.amount.toFixed(2),
        payment_method: 'mobile_money',
        description: 'Unit purchase via MSM backend'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': request.idempotencyKey
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.options.timeoutMs)
      });

      const payload = await this.readJson(response);

      if (!response.ok) {
        return {
          providerReference: `prov-${randomUUID()}`,
          status: 'failed',
          reason: `http_${response.status}:${this.extractMessage(payload)}`
        };
      }

      const providerReference = this.extractReference(payload) ?? `prov-${randomUUID()}`;
      return {
        providerReference,
        status: 'success'
      };
    } catch (error) {
      return {
        providerReference: `prov-${randomUUID()}`,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'provider_unreachable'
      };
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.token;
    }

    const endpoint = `${this.normalizeBaseUrl()}${this.normalizePath(this.options.tokenPath)}`;
    await this.throttle.waitTurn();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: this.options.username,
        password: this.options.password
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs)
    });

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new Error(`token_request_failed_${response.status}`);
    }

    const token = this.extractToken(payload);
    if (!token) {
      throw new Error('token_missing_in_response');
    }

    const ttlSeconds = this.extractTtlSeconds(payload) ?? 50 * 60;
    this.cachedToken = {
      token,
      expiresAt: Date.now() + ttlSeconds * 1000
    };

    return token;
  }

  private normalizeBaseUrl(): string {
    return this.options.baseUrl.replace(/\/+$/, '');
  }

  private normalizePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    return `/${path}`;
  }

  private extractToken(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const value = payload as Record<string, unknown>;
    const token = value.token ?? value.auth_token ?? value.key;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  private extractTtlSeconds(payload: unknown): number | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const value = payload as Record<string, unknown>;
    const expiresIn = value.expires_in ?? value.expires;
    if (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) {
      return expiresIn;
    }
    return null;
  }

  private extractReference(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const value = payload as Record<string, unknown>;
    const reference = value.id ?? value.reference ?? value.transaction_id ?? value.uuid;
    if (typeof reference === 'number') {
      return String(reference);
    }
    if (typeof reference === 'string' && reference.length > 0) {
      return reference;
    }
    return null;
  }

  private extractMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return 'unknown_error';
    }

    const value = payload as Record<string, unknown>;
    const message = value.message ?? value.detail ?? value.error;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    return 'unknown_error';
  }

  private async readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text };
    }
  }
}
