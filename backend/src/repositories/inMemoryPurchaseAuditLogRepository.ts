import type { PurchaseAuditLog } from '../types/purchase.js';
import type { PurchaseAuditLogRepository } from './interfaces.js';
import type { PurchaseAuditLogQuery } from '../types/purchase.js';

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
    return this.list({ purchaseId, limit, offset: 0 });
  }

  async list(query: PurchaseAuditLogQuery): Promise<PurchaseAuditLog[]> {
    const filtered = this.store.filter((entry) => {
      if (query.purchaseId && entry.purchaseId !== query.purchaseId) {
        return false;
      }

      if (query.action && entry.action !== query.action) {
        return false;
      }

      if (query.correlationId && entry.correlationId !== query.correlationId) {
        return false;
      }

      if (query.fromCreatedAt && entry.createdAt < query.fromCreatedAt) {
        return false;
      }

      if (query.toCreatedAt && entry.createdAt > query.toCreatedAt) {
        return false;
      }

      return true;
    });

    return [...filtered]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(query.offset, query.offset + query.limit)
      .map((entry) => cloneEntry(entry));
  }
}
