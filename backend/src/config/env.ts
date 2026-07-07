import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: toNumber(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  appUser: process.env.APP_USER ?? 'admin',
  appPassword: process.env.APP_PASSWORD ?? 'change-me'
};