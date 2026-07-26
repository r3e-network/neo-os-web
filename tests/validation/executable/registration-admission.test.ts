/**
 * Executable Registry Admission Tests
 * Priority: P0 - Critical for deployment
 *
 * Covers the admission rules that guard registration and account
 * materialization: engine existence, admin witness, appId and address
 * format, and AA-core configuration. Complements registry-core.test.ts
 * (happy path, duplicate rejection) and aa-account.test.ts (uniqueness,
 * idempotency).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockRegistry, testUtils, APP_ID_MAX_LENGTH } from '../../setup';

describe('Registry Admission Rules - Executable', () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    registry = createMockRegistry();
  });

  describe('Engine Existence', () => {
    it('should reject registration referencing an unknown engine', async () => {
      const appId = testUtils.generateAppId();
      const admin = testUtils.generateAddress();

      await expect(
        registry.registerApp(appId, admin, 'engine-that-was-never-deployed')
      ).rejects.toThrow(/unknown engineId/i);

      expect(registry.isRegistered(appId)).toBe(false);
    });

    it('should name the offending engine and the required action', async () => {
      const admin = testUtils.generateAddress();

      await expect(
        registry.registerApp(testUtils.generateAppId(), admin, 'typo-engine')
      ).rejects.toThrow(/'typo-engine'.*register the engine/is);
    });

    it('should accept every engine registered at deployment', async () => {
      const admin = testUtils.generateAddress();

      for (const engineId of ['game', 'reward', 'oracle']) {
        const appId = testUtils.generateAppId();
        const result = await registry.registerApp(appId, admin, engineId);

        expect(result.state).toBe('HALT');
        expect((await registry.getApp(appId))?.engineId).toBe(engineId);
      }
    });

    it('should reject a default engine when the deployment omits it', async () => {
      const restricted = createMockRegistry({ engineIds: ['game'] });
      const admin = testUtils.generateAddress();

      await expect(
        restricted.registerApp(testUtils.generateAppId(), admin, 'oracle')
      ).rejects.toThrow(/unknown engineId/i);
    });
  });

  describe('Admin Witness', () => {
    it('should reject registration signed by someone other than the admin', async () => {
      const appId = testUtils.generateAppId();
      const admin = testUtils.generateAddress();
      const attacker = testUtils.generateAddress();

      await expect(
        registry.registerApp(appId, admin, 'game', attacker)
      ).rejects.toThrow(/CheckWitness failed/i);

      expect(registry.isRegistered(appId)).toBe(false);
    });

    it('should accept registration signed by the admin', async () => {
      const appId = testUtils.generateAppId();
      const admin = testUtils.generateAddress();

      const result = await registry.registerApp(appId, admin, 'game', admin);

      expect(result.state).toBe('HALT');
      expect((await registry.getApp(appId))?.admin).toBe(admin);
    });

    it('should reject a malformed signer address', async () => {
      const admin = testUtils.generateAddress();

      await expect(
        registry.registerApp(testUtils.generateAppId(), admin, 'game', 'not-an-address')
      ).rejects.toThrow(/invalid signer address/i);
    });
  });

  describe('Identifier Admission', () => {
    const rejected: ReadonlyArray<[string, string, RegExp]> = [
      ['empty appId', '', /empty appId/i],
      ['whitespace-only appId', '   ', /empty appId/i],
      ['appId over the length limit', 'a'.repeat(APP_ID_MAX_LENGTH + 1), /too long/i],
      ['appId containing a path separator', 'my/app', /invalid characters/i],
      ['appId containing a space', 'my app', /invalid characters/i],
      ['appId containing a null byte', `my${String.fromCharCode(0)}app`, /invalid characters/i],
      ['appId containing a wildcard', 'my*app', /invalid characters/i],
      ['appId containing a unicode dash', 'my–app', /invalid characters/i],
    ];

    it.each(rejected)('should reject %s', async (_label, appId, expected) => {
      const admin = testUtils.generateAddress();

      await expect(registry.registerApp(appId, admin, 'game')).rejects.toThrow(expected);
      expect(registry.isRegistered(appId)).toBe(false);
    });

    it('should accept an appId at exactly the length limit', async () => {
      const appId = 'a'.repeat(APP_ID_MAX_LENGTH);
      const admin = testUtils.generateAddress();

      const result = await registry.registerApp(appId, admin, 'game');

      expect(result.state).toBe('HALT');
      expect(registry.isRegistered(appId)).toBe(true);
    });

    it('should reject a malformed admin address', async () => {
      await expect(
        registry.registerApp(testUtils.generateAppId(), '0xdeadbeef', 'game')
      ).rejects.toThrow(/invalid admin address/i);
    });

    it('should return null for an app that was never registered', async () => {
      expect(await registry.getApp('never-registered')).toBeNull();
      expect(registry.isRegistered('never-registered')).toBe(false);
    });

    it('should leave the registry unchanged after a rejected registration', async () => {
      const admin = testUtils.generateAddress();
      await registry.registerApp('surviving-app', admin, 'game');

      await expect(registry.registerApp('bad app', admin, 'game')).rejects.toThrow();
      await expect(registry.registerApp('other-app', admin, 'nope')).rejects.toThrow();

      expect(registry.listApps().map(app => app.appId)).toEqual(['surviving-app']);
    });
  });

  describe('AA Core Configuration', () => {
    it('should fail materialization when the AA core is not configured', async () => {
      const unconfigured = createMockRegistry({ aaCoreHash: null });
      const appId = testUtils.generateAppId();
      const admin = testUtils.generateAddress();

      await unconfigured.registerApp(appId, admin, 'game');

      await expect(unconfigured.materializeAccount(appId)).rejects.toThrow(
        /AA core not configured/i
      );
    });

    it('should name the required remedy when the AA core is missing', async () => {
      const unconfigured = createMockRegistry({ aaCoreHash: null });
      const appId = testUtils.generateAppId();

      await unconfigured.registerApp(appId, testUtils.generateAddress(), 'game');

      await expect(unconfigured.materializeAccount(appId)).rejects.toThrow(
        /UnifiedSmartWallet hash/i
      );
    });

    it('should still allow registration while the AA core is unconfigured', async () => {
      const unconfigured = createMockRegistry({ aaCoreHash: null });
      const appId = testUtils.generateAppId();

      const result = await unconfigured.registerApp(appId, testUtils.generateAddress(), 'game');

      expect(result.state).toBe('HALT');
      expect(unconfigured.isRegistered(appId)).toBe(true);
    });

    it('should reject materialization for an app that is not registered', async () => {
      await expect(registry.materializeAccount('unregistered-app')).rejects.toThrow(
        /not registered/i
      );
    });

    it('should record the account id on the app once materialized', async () => {
      const appId = testUtils.generateAppId();
      const admin = testUtils.generateAddress();
      await registry.registerApp(appId, admin, 'game');

      expect((await registry.getApp(appId))?.accountId).toBeNull();

      const materialized = await registry.materializeAccount(appId);

      expect((await registry.getApp(appId))?.accountId).toBe(materialized.accountId);
    });
  });
});
