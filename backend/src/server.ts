import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

const start = async (): Promise<void> => {
  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`MSM backend running on ${env.host}:${env.port}`);
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
};

void start();