import type { PurchaseRecord } from '../types/purchase.js';
import type { PurchaseRepository } from './interfaces.js';

const cloneRecord = (record: PurchaseRecord): PurchaseRecord => ({
  ...record,
  transitions: record.transitions.map((transition) => ({ ...transition }))
});

export class InMemoryPurchaseRepository implements PurchaseRepository {
  private readonly store = new Map<string, PurchaseRecord>();

  async create(record: PurchaseRecord): Promise<void> {
    this.store.set(record.id, cloneRecord(record));
  }

  async update(record: PurchaseRecord): Promise<void> {
    this.store.set(record.id, cloneRecord(record));
  }

  async getById(purchaseId: string): Promise<PurchaseRecord | null> {
    const record = this.store.get(purchaseId);
    if (!record) {
      return null;
    }

    return cloneRecord(record);
  }
}
