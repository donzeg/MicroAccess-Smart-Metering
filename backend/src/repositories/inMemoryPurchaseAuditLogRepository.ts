import type { PurchaseAuditLog } from '../types/purchase.js';
import type { PurchaseAuditLogRepository } from './interfaces.js';

const cloneEntry = (entry: PurchaseAuditLog): PurchaseAuditLog => ({
  ...entry,
  metadata: { ...entry.metadata }
});

export class InMemoryPurchaseAuditLogRepository implements PurchaseAuditLogRepository {
  private readonly store: PurchaseAuditLog[] = [];

  async append(entry: PurchaseAuditLog): Promise<void> {
    this.store.push(cloneEntry(entry));
  }

  async listByPurchaseId(purchaseId: string, limit: number): Promise<PurchaseAuditLog[]> {
    return this.store
      .filter((entry) => entry.purchaseId === purchaseId)
      .slice(-limit)
      .map((entry) => cloneEntry(entry));
  }
}
