import type { Pool } from 'pg';

import type { CustomerMeterLink } from '../data/customerMeterMap.js';
import type { CustomerMeterRepository } from './interfaces.js';

interface CustomerMeterRow {
  customer_id: string;
  meter_id: string;
  meter_serial: string;
  label: string;
}

export class PgCustomerMeterRepository implements CustomerMeterRepository {
  constructor(private readonly pool: Pool) {}

  async findByCustomerId(customerId: string): Promise<CustomerMeterLink[]> {
    const result = await this.pool.query<CustomerMeterRow>(
      `
      SELECT customer_id, meter_id, meter_serial, label
      FROM customer_meter_map
      WHERE customer_id = $1
      ORDER BY meter_id ASC
      `,
      [customerId]
    );

    return result.rows.map((row) => ({
      customerId: row.customer_id,
      meterId: row.meter_id,
      meterSerial: row.meter_serial,
      label: row.label
    }));
  }
}
