import type { CustomerMeterLink } from '../data/customerMeterMap.js';
import type { PurchaseAuditLog, PurchaseAuditLogQuery, PurchaseRecord, PurchaseState } from '../types/purchase.js';

export interface PurchaseRepository {
  create: (record: PurchaseRecord) => Promise<void>;
  update: (record: PurchaseRecord) => Promise<void>;
  getById: (purchaseId: string) => Promise<PurchaseRecord | null>;
  listByState: (state: PurchaseState, limit: number) => Promise<PurchaseRecord[]>;
}

export interface CustomerMeterRepository {
  findByCustomerId: (customerId: string) => Promise<CustomerMeterLink[]>;
}

export interface PurchaseAuditLogRepository {
  append: (entry: PurchaseAuditLog) => Promise<void>;
  listByPurchaseId: (purchaseId: string, limit: number) => Promise<PurchaseAuditLog[]>;
  list: (query: PurchaseAuditLogQuery) => Promise<PurchaseAuditLog[]>;
}
