/**
 * Executable AA Account Materialization Tests
 * Priority: P0 - Critical for AA integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockRegistry, testUtils } from '../../setup';

describe('AA Account Materialization - Executable', () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    registry = createMockRegistry();
  });

  describe('Account Creation', () => {
    it('should create unique AA account for each app', async () => {
      // Arrange
      const appId1 = 'app-one';
      const appId2 = 'app-two';
      const admin = testUtils.generateAddress();

      // Act - Register both apps
      await registry.registerApp(appId1, admin, 'game');
      await registry.registerApp(appId2, admin, 'game');

      // Act - Materialize accounts
      const account1 = await registry.materializeAccount(appId1);
      const account2 = await registry.materializeAccount(appId2);

      // Assert - Accounts are unique
      expect(account1).toBeDefined();
      expect(account2).toBeDefined();
      expect(account1).not.toEqual(account2);
    });

    it('should be idempotent - repeated calls return same account', async () => {
      // Arrange
      const appId = 'idempotent-test';
      const admin = testUtils.generateAddress();
      await registry.registerApp(appId, admin, 'game');

      // Act - Call materialize multiple times
      const account1 = await registry.materializeAccount(appId);
      const account2 = await registry.materializeAccount(appId);
      const account3 = await registry.materializeAccount(appId);

      // Assert - All calls return same account
      expect(account1).toEqual(account2);
      expect(account2).toEqual(account3);
    });
  });
});

export { };
