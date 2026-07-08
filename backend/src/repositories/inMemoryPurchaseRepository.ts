import type { PurchaseRecord } from '../types/purchase.js';
import type { PurchaseRepository } from './interfaces.js';
import type { PurchaseListQuery } from '../types/purchase.js';

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
    return this.list({ states: [state], limit, offset: 0 });
  }

  async list(query: PurchaseListQuery): Promise<PurchaseRecord[]> {
    return Array.from(this.store.values())
      .filter((record) => {
        if (query.customerId && record.customerId !== query.customerId) {
          return false;
        }

        if (query.states && query.states.length > 0 && !query.states.includes(record.state)) {
          return false;
        }

        if (query.fromCreatedAt && record.createdAt < query.fromCreatedAt) {
          return false;
        }

        if (query.toCreatedAt && record.createdAt > query.toCreatedAt) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(query.offset, query.offset + query.limit)
      .map((record) => cloneRecord(record));
  }
}
