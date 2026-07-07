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
