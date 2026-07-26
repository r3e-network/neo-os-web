/**
 * Executable Registry Business Logic Tests
 * Priority: P0 - Critical for deployment
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockRegistry, testUtils } from '../../setup';

describe('Registry Core Operations - Executable', () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    registry = createMockRegistry();
  });

  describe('App Registration Flow', () => {
    it('should successfully register a new app', async () => {
      // Arrange
      const appId = testUtils.generateAppId();
      const admin = testUtils.generateAddress();
      const engineId = 'game';

      // Act
      const result = await registry.registerApp(appId, admin, engineId);

      // Assert
      expect(result.state).toBe('HALT');
      expect(result.gasconsumed).toBeDefined();

      // Verify app exists
      const app = await registry.getApp(appId);
      expect(app).toBeDefined();
    });

    it('should reject duplicate appId registration', async () => {
      // Arrange
      const appId = 'duplicate-test';
      const admin = testUtils.generateAddress();
      const engineId = 'game';

      // Act - Register first time
      await registry.registerApp(appId, admin, engineId);

      // Act - Try to register again
      const duplicateAttempt = async () => {
        await registry.registerApp(appId, admin, engineId);
      };

      // Assert
      await expect(duplicateAttempt()).rejects.toThrow(/already registered/i);
    });
  });
});

export { };
