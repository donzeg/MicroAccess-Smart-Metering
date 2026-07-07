export interface CustomerMeterLink {
  customerId: string;
  meterId: string;
  meterSerial: string;
  label: string;
}

export const customerMeterLinks: CustomerMeterLink[] = [
  {
    customerId: '1622913',
    meterId: 'meter-abuja-001',
    meterSerial: 'ABJ-001-0001',
    label: 'Shop A'
  },
  {
    customerId: '1622913',
    meterId: 'meter-abuja-002',
    meterSerial: 'ABJ-001-0002',
    label: 'Shop B'
  },
  {
    customerId: '1622914',
    meterId: 'meter-abuja-003',
    meterSerial: 'ABJ-001-0003',
    label: 'Shop C'
  }
];