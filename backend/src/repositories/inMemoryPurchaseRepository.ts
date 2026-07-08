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

  async listByState(state: PurchaseRecord['state'], limit: number): Promise<PurchaseRecord[]> {
    const values = Array.from(this.store.values())
      .filter((record) => record.state === state)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit)
      .map((record) => cloneRecord(record));

    return values;
  }
}
