export type RuntimeOperationMode = 'phase1_read_only' | 'legacy_prototype';
export type RuntimeStorageMode = 'postgres' | 'in_memory';

export interface RuntimeConfiguration {
  nodeEnv: string;
  operationMode: string;
  storageMode: string;
  databaseUrl: string;
  jwtSecret: string;
  appUser: string;
  appPassword: string;
  callbackSecret: string;
  steamaEnabled: boolean;
  steamaBaseUrl: string;
  steamaUsername: string;
  steamaPassword: string;
}

const PLACEHOLDER_VALUES = new Set([
  '',
  'admin',
  'change-me',
  'change-me-in-production',
  'change-me-callback-secret',
  'replace-with-service-username',
  'replace-with-service-password'
]);

const isPlaceholder = (value: string): boolean => {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
};

const isStrongSecret = (value: string, minimumLength: number): boolean => {
  return value.length >= minimumLength && !isPlaceholder(value);
};

export class RuntimeConfigurationError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid_runtime_configuration:${issues.join(',')}`);
    this.name = 'RuntimeConfigurationError';
  }
}

export const validateRuntimeConfiguration = (config: RuntimeConfiguration): void => {
  const issues: string[] = [];
  const isTest = config.nodeEnv === 'test';
  const isProduction = config.nodeEnv === 'production';

  if (!['phase1_read_only', 'legacy_prototype'].includes(config.operationMode)) {
    issues.push('MSM_OPERATION_MODE');
  }

  if (!['postgres', 'in_memory'].includes(config.storageMode)) {
    issues.push('STORAGE_MODE');
  }

  if (!isTest && config.operationMode === 'legacy_prototype') {
    issues.push('LEGACY_PROTOTYPE_TEST_ONLY');
  }

  if (!isTest && config.operationMode === 'phase1_read_only') {
    if (config.storageMode !== 'postgres') {
      issues.push('PHASE1_REQUIRES_POSTGRES');
    }
    if (config.databaseUrl.trim().length === 0) {
      issues.push('DATABASE_URL');
    }
    if (!isStrongSecret(config.jwtSecret, 32)) {
      issues.push('JWT_SECRET');
    }
    if (isPlaceholder(config.appUser)) {
      issues.push('APP_USER');
    }
    if (!isStrongSecret(config.appPassword, 16)) {
      issues.push('APP_PASSWORD');
    }
    if (!isStrongSecret(config.callbackSecret, 32)) {
      issues.push('CALLBACK_SECRET');
    }
  }

  if (isProduction) {
    if (config.operationMode !== 'phase1_read_only') {
      issues.push('PRODUCTION_REQUIRES_PHASE1_READ_ONLY');
    }
    if (config.storageMode !== 'postgres' || config.databaseUrl.trim().length === 0) {
      issues.push('PRODUCTION_DATABASE');
    }
    if (!isStrongSecret(config.jwtSecret, 32)) {
      issues.push('JWT_SECRET');
    }
    if (isPlaceholder(config.appUser)) {
      issues.push('APP_USER');
    }
    if (!isStrongSecret(config.appPassword, 16)) {
      issues.push('APP_PASSWORD');
    }
    if (!isStrongSecret(config.callbackSecret, 32)) {
      issues.push('CALLBACK_SECRET');
    }
  }

  if (config.steamaEnabled) {
    if (isPlaceholder(config.steamaUsername)) {
      issues.push('STEAMA_SERVICE_USERNAME');
    }
    if (isPlaceholder(config.steamaPassword)) {
      issues.push('STEAMA_SERVICE_PASSWORD');
    }

    try {
      const baseUrl = new URL(config.steamaBaseUrl);
      if (isProduction && baseUrl.protocol !== 'https:') {
        issues.push('STEAMA_BASE_URL_HTTPS');
      }
    } catch {
      issues.push('STEAMA_BASE_URL');
    }
  }

  if (issues.length > 0) {
    throw new RuntimeConfigurationError(Array.from(new Set(issues)));
  }
};
