import { customerMeterLinks, type CustomerMeterLink } from '../data/customerMeterMap.js';
import type { CustomerMeterRepository } from './interfaces.js';

export class InMemoryCustomerMeterRepository implements CustomerMeterRepository {
  private readonly links: CustomerMeterLink[];

  constructor(seedData: CustomerMeterLink[] = customerMeterLinks) {
    this.links = seedData.map((entry) => ({ ...entry }));
  }

  async findByCustomerId(customerId: string): Promise<CustomerMeterLink[]> {
    return this.links.filter((entry) => entry.customerId === customerId).map((entry) => ({ ...entry }));
  }
}
