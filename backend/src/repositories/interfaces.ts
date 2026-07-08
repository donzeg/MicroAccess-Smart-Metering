import type { CustomerMeterLink } from '../data/customerMeterMap.js';
import type { PurchaseRecord } from '../types/purchase.js';

export interface PurchaseRepository {
  create: (record: PurchaseRecord) => Promise<void>;
  update: (record: PurchaseRecord) => Promise<void>;
  getById: (purchaseId: string) => Promise<PurchaseRecord | null>;
}

export interface CustomerMeterRepository {
  findByCustomerId: (customerId: string) => Promise<CustomerMeterLink[]>;
}
