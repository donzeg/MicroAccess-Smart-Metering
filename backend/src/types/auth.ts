export type AuthRole = 'management' | 'customer';

export interface AuthUser {
  sub: string;
  role: AuthRole;
  customerId?: string;
}
