import { describe, expect, it } from 'vitest';

import {
  RuntimeConfigurationError,
  type RuntimeConfiguration,
  validateRuntimeConfiguration
} from '../../src/config/runtimeValidation.js';

const validConfiguration = (overrides: Partial<RuntimeConfiguration> = {}): RuntimeConfiguration => ({
  nodeEnv: 'production',
  operationMode: 'phase1_read_only',
  storageMode: 'postgres',
  databaseUrl: 'postgresql://msm:secret@database.example/msm',
  jwtSecret: 'j'.repeat(48),
  appUser: 'msm-operations',
  appPassword: 'p'.repeat(24),
  callbackSecret: 'c'.repeat(48),
  steamaEnabled: true,
  steamaBaseUrl: 'https://api.steama.co',
  steamaUsername: 'service-user',
  steamaPassword: 'service-password',
  ...overrides
});

describe('validateRuntimeConfiguration', () => {
  it('accepts a production-safe read-only configuration', () => {
    expect(() => validateRuntimeConfiguration(validConfiguration())).not.toThrow();
  });

  it('rejects production prototype mode, in-memory storage, placeholders and insecure provider URL', () => {
    try {
      validateRuntimeConfiguration(
        validConfiguration({
          operationMode: 'legacy_prototype',
          storageMode: 'in_memory',
          databaseUrl: '',
          jwtSecret: 'change-me-in-production',
          appUser: 'admin',
          appPassword: 'change-me',
          callbackSecret: 'change-me-callback-secret',
          steamaBaseUrl: 'http://api.steama.co'
        })
      );
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeConfigurationError);
      const issues = (error as RuntimeConfigurationError).issues;
      expect(issues).toEqual(
        expect.arrayContaining([
          'PRODUCTION_REQUIRES_PHASE1_READ_ONLY',
          'PRODUCTION_DATABASE',
          'JWT_SECRET',
          'APP_USER',
          'APP_PASSWORD',
          'CALLBACK_SECRET',
          'STEAMA_BASE_URL_HTTPS'
        ])
      );
    }
  });

  it('requires durable storage for Phase 1 outside automated tests', () => {
    expect(() =>
      validateRuntimeConfiguration(
        validConfiguration({
          nodeEnv: 'development',
          storageMode: 'in_memory',
          databaseUrl: '',
          steamaEnabled: false
        })
      )
    ).toThrow(/PHASE1_REQUIRES_POSTGRES/);
  });

  it('rejects placeholder credentials in a Phase 1 development runtime', () => {
    expect(() =>
      validateRuntimeConfiguration(
        validConfiguration({
          nodeEnv: 'development',
          jwtSecret: 'change-me-in-production',
          appUser: 'admin',
          appPassword: 'change-me',
          callbackSecret: 'change-me-callback-secret',
          steamaEnabled: false
        })
      )
    ).toThrow(/JWT_SECRET/);
  });

  it('reserves the legacy prototype for automated tests', () => {
    expect(() =>
      validateRuntimeConfiguration(
        validConfiguration({
          nodeEnv: 'development',
          operationMode: 'legacy_prototype'
        })
      )
    ).toThrow(/LEGACY_PROTOTYPE_TEST_ONLY/);
  });

  it('allows isolated legacy fixtures only in automated tests', () => {
    expect(() =>
      validateRuntimeConfiguration(
        validConfiguration({
          nodeEnv: 'test',
          operationMode: 'legacy_prototype',
          storageMode: 'in_memory',
          databaseUrl: '',
          jwtSecret: 'change-me-in-production',
          appUser: 'admin',
          appPassword: 'change-me',
          callbackSecret: 'change-me-callback-secret',
          steamaEnabled: false,
          steamaUsername: '',
          steamaPassword: ''
        })
      )
    ).not.toThrow();
  });
});
