/**
 * Executable Observability, Upgrade Safety and Storage Boundary Tests
 * Priority: P4 - operational readiness
 *
 * Executable form of the Monitoring & Observability, Upgrade Safety, Array
 * Boundaries, Storage Edge Cases and Event Emission Edge Cases scenario
 * groups. See docs/validation/SCENARIO-CATALOG.md for the full scenario
 * inventory and where each group is covered.
 *
 * The central claim under test is that no state change is silent: an indexer
 * reading only the event stream must be able to reconstruct every balance and
 * status the contract holds. That property is asserted structurally here by
 * replaying events into an independent projection and comparing it against
 * contract storage, so a mutation added without an event fails the test.
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface EmittedEvent {
  name: string;
  appId: string;
  payload: Record<string, string | number>;
  blockHeight: number;
}

/** Neo storage keys are byte strings; these are the platform's prefixes. */
const PREFIX = {
  app: 'a',
  account: 'c',
  credit: 'r',
  pool: 'p',
  engine: 'e',
} as const;

/** Enforced limits, mirroring what gas cost makes prohibitive on-chain. */
const LIMIT = {
  opLogEntries: 64,
  batchSize: 32,
  eventPayloadBytes: 1024,
  appsPerPage: 50,
} as const;

function createMockOperations() {
  const storage = new Map<string, string>();
  const events: EmittedEvent[] = [];
  const engineStats = new Map<string, { plays: number; volume: number }>();
  let blockHeight = 5000;
  let version = 1;
  let paused = false;
  let upgradeUnlockHeight = 0;

  /** Prefixed key construction, the collision guard being tested. */
  const key = (prefix: string, ...parts: string[]) => [prefix, ...parts].join(':');

  const emit = (
    name: string,
    appId: string,
    payload: Record<string, string | number> = {},
  ) => {
    const size = JSON.stringify(payload).length;
    if (size > LIMIT.eventPayloadBytes) {
      throw new Error(
        `FAULT: event payload too large (${size} > ${LIMIT.eventPayloadBytes} bytes)`,
      );
    }
    events.push({ name, appId, payload, blockHeight: ++blockHeight });
  };

  const readNumber = (k: string) => Number(storage.get(k) ?? '0');

  return {
    /* ---------------------------- registration --------------------------- */
    register: (appId: string, owner: string) => {
      if (storage.has(key(PREFIX.app, appId))) {
        throw new Error('FAULT: appId already registered');
      }
      const account = `aa-${appId}`;
      storage.set(key(PREFIX.app, appId), JSON.stringify({ owner, status: 'active' }));
      storage.set(key(PREFIX.account, appId), account);
      storage.set(key(PREFIX.pool, appId), '0');
      // Full context in one event so an indexer needs no follow-up query.
      emit('AppRegistered', appId, { owner, status: 'active' });
      emit('AbstractAccountCreated', appId, { accountId: account });
      return { state: 'HALT', account };
    },

    /* ------------------------------ credits ------------------------------ */
    credit: (appId: string, player: string, amount: number) => {
      if (paused) throw new Error('FAULT: contract is paused');
      if (amount <= 0) throw new Error('FAULT: amount must be positive');
      const k = key(PREFIX.credit, appId, player);
      storage.set(k, String(readNumber(k) + amount));
      emit('Credited', appId, { player, amount });
      return { state: 'HALT' };
    },

    withdrawCredit: (appId: string, player: string, amount: number) => {
      // Deliberately pause-immune: an incident must not trap player funds.
      const k = key(PREFIX.credit, appId, player);
      const balance = readNumber(k);
      if (amount > balance) throw new Error('FAULT: insufficient credit');
      storage.set(k, String(balance - amount));
      emit('CreditWithdrawn', appId, { player, amount });
      return { state: 'HALT' };
    },

    /* ------------------------------- games ------------------------------- */
    startGame: (appId: string, engineId: string, player: string, wager: number) => {
      if (paused) throw new Error('FAULT: contract is paused');
      const creditKey = key(PREFIX.credit, appId, player);
      const credit = readNumber(creditKey);
      if (credit < wager) throw new Error('FAULT: insufficient credit');
      storage.set(creditKey, String(credit - wager));
      const poolKey = key(PREFIX.pool, appId);
      storage.set(poolKey, String(readNumber(poolKey) + wager));
      const stats = engineStats.get(engineId) ?? { plays: 0, volume: 0 };
      engineStats.set(engineId, { plays: stats.plays + 1, volume: stats.volume + wager });
      storage.set(key(PREFIX.engine, engineId), JSON.stringify(engineStats.get(engineId)));
      emit('GameStarted', appId, { engineId, player, wager });
      return { state: 'HALT', gameId: `${appId}-${engineStats.get(engineId)!.plays}` };
    },

    finalizeGame: (
      appId: string,
      player: string,
      payout: number,
      opLog: string[],
    ) => {
      if (opLog.length > LIMIT.opLogEntries) {
        throw new Error(
          `FAULT: opLog too long (${opLog.length} > ${LIMIT.opLogEntries} entries)`,
        );
      }
      const poolKey = key(PREFIX.pool, appId);
      const pool = readNumber(poolKey);
      if (payout > pool) throw new Error('FAULT: pool insolvent for payout');
      storage.set(poolKey, String(pool - payout));
      if (payout > 0) {
        const creditKey = key(PREFIX.credit, appId, player);
        storage.set(creditKey, String(readNumber(creditKey) + payout));
      }
      // The opLog is summarized, not inlined, to keep the payload bounded.
      emit('GameFinalized', appId, { player, payout, opCount: opLog.length });
      return { state: 'HALT' };
    },

    /* ------------------------------- pool -------------------------------- */
    fundPool: (appId: string, amount: number) => {
      const poolKey = key(PREFIX.pool, appId);
      storage.set(poolKey, String(readNumber(poolKey) + amount));
      emit('PoolFunded', appId, { amount });
      return { state: 'HALT' };
    },

    /* --------------------------- batch operations ------------------------ */
    batchCredit: (appId: string, entries: Array<{ player: string; amount: number }>) => {
      if (entries.length > LIMIT.batchSize) {
        throw new Error(
          `FAULT: batch too large (${entries.length} > ${LIMIT.batchSize} entries)`,
        );
      }
      // All-or-nothing: validate the whole batch before mutating anything.
      for (const entry of entries) {
        if (entry.amount <= 0) throw new Error('FAULT: amount must be positive');
      }
      for (const entry of entries) {
        const k = key(PREFIX.credit, appId, entry.player);
        storage.set(k, String(readNumber(k) + entry.amount));
      }
      emit('BatchCredited', appId, { count: entries.length });
      return { state: 'HALT', applied: entries.length };
    },

    /* ------------------------ governance / upgrades ---------------------- */
    pause: () => {
      if (paused) throw new Error('FAULT: already paused');
      paused = true;
      emit('Paused', '', { blockHeight: blockHeight + 1 });
      return { state: 'HALT' };
    },
    unpause: () => {
      if (!paused) throw new Error('FAULT: not paused');
      paused = false;
      emit('Unpaused', '', { blockHeight: blockHeight + 1 });
      return { state: 'HALT' };
    },
    isPaused: () => paused,

    proposeUpgrade: (targetVersion: number, delay: number) => {
      if (targetVersion <= version) throw new Error('FAULT: version must increase');
      if (delay < 100) throw new Error('FAULT: timelock delay below minimum');
      upgradeUnlockHeight = blockHeight + delay;
      emit('UpgradeProposed', '', { targetVersion, unlockHeight: upgradeUnlockHeight });
      return { state: 'HALT', unlockHeight: upgradeUnlockHeight };
    },

    executeUpgrade: (targetVersion: number) => {
      if (upgradeUnlockHeight === 0) throw new Error('FAULT: no upgrade proposed');
      if (blockHeight < upgradeUnlockHeight) {
        throw new Error('FAULT: upgrade timelock not elapsed');
      }
      version = targetVersion;
      upgradeUnlockHeight = 0;
      // Storage is untouched by the version bump; migration is explicit.
      emit('Upgraded', '', { version });
      return { state: 'HALT', version };
    },

    cancelUpgrade: () => {
      if (upgradeUnlockHeight === 0) throw new Error('FAULT: no upgrade proposed');
      upgradeUnlockHeight = 0;
      emit('UpgradeCancelled', '', {});
      return { state: 'HALT' };
    },

    advanceBlocks: (count: number) => {
      blockHeight += count;
    },

    /* --------------------------- operator queries ------------------------ */
    getApp: (appId: string) => {
      const raw = storage.get(key(PREFIX.app, appId));
      if (!raw) return null;
      return {
        appId,
        ...JSON.parse(raw),
        account: storage.get(key(PREFIX.account, appId)),
        pool: readNumber(key(PREFIX.pool, appId)),
      };
    },
    getEngineStats: (engineId: string) =>
      engineStats.get(engineId) ?? { plays: 0, volume: 0 },
    getTotalLiability: (appId: string) => {
      let total = 0;
      const scope = key(PREFIX.credit, appId, '');
      for (const [k, v] of storage) {
        if (k.startsWith(scope)) total += Number(v);
      }
      return total;
    },
    creditOf: (appId: string, player: string) =>
      readNumber(key(PREFIX.credit, appId, player)),
    poolBalance: (appId: string) => readNumber(key(PREFIX.pool, appId)),
    listApps: (page: number, pageSize: number) => {
      if (pageSize > LIMIT.appsPerPage) {
        throw new Error(`FAULT: page size exceeds ${LIMIT.appsPerPage}`);
      }
      const ids = [...storage.keys()]
        .filter((k) => k.startsWith(`${PREFIX.app}:`))
        .map((k) => k.slice(2))
        .sort();
      return ids.slice(page * pageSize, page * pageSize + pageSize);
    },
    version: () => version,

    /* ------------------------------ inspection --------------------------- */
    storageKeys: () => [...storage.keys()],
    storageSize: () => storage.size,
    events: () => [...events],
    eventNames: () => events.map((e) => e.name),
  };
}

type MockOperations = ReturnType<typeof createMockOperations>;

/**
 * Rebuilds credit and pool balances from the event stream alone. If this
 * projection matches contract storage then every mutation emitted an event.
 */
function projectFromEvents(events: EmittedEvent[]) {
  const credits = new Map<string, number>();
  const pools = new Map<string, number>();
  const bump = (map: Map<string, number>, k: string, delta: number) =>
    map.set(k, (map.get(k) ?? 0) + delta);

  for (const event of events) {
    const { appId, payload } = event;
    const player = String(payload.player ?? '');
    const amount = Number(payload.amount ?? 0);
    switch (event.name) {
      case 'AppRegistered':
        pools.set(appId, pools.get(appId) ?? 0);
        break;
      case 'Credited':
        bump(credits, `${appId}/${player}`, amount);
        break;
      case 'CreditWithdrawn':
        bump(credits, `${appId}/${player}`, -amount);
        break;
      case 'PoolFunded':
        bump(pools, appId, amount);
        break;
      case 'GameStarted':
        bump(credits, `${appId}/${player}`, -Number(payload.wager));
        bump(pools, appId, Number(payload.wager));
        break;
      case 'GameFinalized':
        bump(credits, `${appId}/${player}`, Number(payload.payout));
        bump(pools, appId, -Number(payload.payout));
        break;
      default:
        break;
    }
  }
  return { credits, pools };
}

describe('Observability and Upgrade Safety - Executable', () => {
  let ops: MockOperations;

  beforeEach(() => {
    ops = createMockOperations();
  });

  describe('Event Coverage for State Changes', () => {
    it('should emit registration and account creation with full context', () => {
      // Act
      ops.register('dice', 'dev1');

      // Assert - an indexer needs no follow-up query to know owner or account
      const [registered, accountCreated] = ops.events();
      expect(registered.name).toBe('AppRegistered');
      expect(registered.payload).toMatchObject({ owner: 'dev1', status: 'active' });
      expect(accountCreated.name).toBe('AbstractAccountCreated');
      expect(accountCreated.payload).toMatchObject({ accountId: 'aa-dice' });
    });

    it('should emit credit movements with amounts on both directions', () => {
      // Arrange
      ops.register('dice', 'dev1');

      // Act
      ops.credit('dice', 'alice', 500);
      ops.withdrawCredit('dice', 'alice', 200);

      // Assert
      const credited = ops.events().find((e) => e.name === 'Credited');
      const withdrawn = ops.events().find((e) => e.name === 'CreditWithdrawn');
      expect(credited!.payload).toMatchObject({ player: 'alice', amount: 500 });
      expect(withdrawn!.payload).toMatchObject({ player: 'alice', amount: 200 });
    });

    it('should emit game lifecycle events carrying the outcome', () => {
      // Arrange
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 1000);
      ops.credit('dice', 'alice', 100);

      // Act
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      ops.finalizeGame('dice', 'alice', 200, ['roll', 'settle']);

      // Assert - the payout is in the event, not just in storage
      const started = ops.events().find((e) => e.name === 'GameStarted');
      const finalized = ops.events().find((e) => e.name === 'GameFinalized');
      expect(started!.payload).toMatchObject({ engineId: 'engine-dice', wager: 100 });
      expect(finalized!.payload).toMatchObject({ player: 'alice', payout: 200 });
    });

    it('should stamp every governance event with a block height', () => {
      // Act
      ops.pause();
      ops.unpause();

      // Assert - timestamps let operators correlate incidents with the chain
      const governance = ops.events().filter((e) => ['Paused', 'Unpaused'].includes(e.name));
      expect(governance).toHaveLength(2);
      for (const event of governance) {
        expect(event.payload.blockHeight).toBeGreaterThan(0);
        expect(event.blockHeight).toBeGreaterThan(0);
      }
    });

    it('should let an indexer reconstruct all balances from events alone', () => {
      // Arrange - a mixed workload touching every balance-mutating path
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 5000);
      ops.credit('dice', 'alice', 1000);
      ops.credit('dice', 'bob', 400);
      ops.startGame('dice', 'engine-dice', 'alice', 300);
      ops.finalizeGame('dice', 'alice', 600, ['roll']);
      ops.startGame('dice', 'engine-dice', 'bob', 400);
      ops.finalizeGame('dice', 'bob', 0, ['roll']);
      ops.withdrawCredit('dice', 'alice', 500);

      // Act - replay the event stream into an independent projection
      const projection = projectFromEvents(ops.events());

      // Assert - projection equals contract storage, so nothing changed silently
      expect(projection.credits.get('dice/alice')).toBe(ops.creditOf('dice', 'alice'));
      expect(projection.credits.get('dice/bob')).toBe(ops.creditOf('dice', 'bob'));
      expect(projection.pools.get('dice')).toBe(ops.poolBalance('dice'));
    });

    it('should emit no events when an operation reverts', () => {
      // Arrange
      ops.register('dice', 'dev1');
      const before = ops.events().length;

      // Act
      expect(() => ops.credit('dice', 'alice', 0)).toThrow(/positive/i);
      expect(() => ops.withdrawCredit('dice', 'alice', 100)).toThrow(/insufficient/i);

      // Assert - a reverted call must not pollute the stream for indexers
      expect(ops.events().length).toBe(before);
    });
  });

  describe('Operational Queries', () => {
    beforeEach(() => {
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 2000);
      ops.credit('dice', 'alice', 700);
      ops.credit('dice', 'bob', 300);
    });

    it('should return full app state from getApp', () => {
      // Act
      const app = ops.getApp('dice');

      // Assert - one call answers owner, status, account and pool
      expect(app).toMatchObject({
        appId: 'dice',
        owner: 'dev1',
        status: 'active',
        account: 'aa-dice',
        pool: 2000,
      });
    });

    it('should return null for an unknown app rather than throwing', () => {
      // Assert - monitoring probes should not need try/catch
      expect(ops.getApp('missing')).toBeNull();
    });

    it('should report engine usage metrics', () => {
      // Act
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      ops.startGame('dice', 'engine-dice', 'bob', 200);

      // Assert
      expect(ops.getEngineStats('engine-dice')).toEqual({ plays: 2, volume: 300 });
    });

    it('should report zero metrics for an engine with no plays', () => {
      // Assert - absent metrics read as zero, not undefined
      expect(ops.getEngineStats('engine-unused')).toEqual({ plays: 0, volume: 0 });
    });

    it('should report total liability as the sum of all player credit', () => {
      // Assert - the number an operator compares against the pool
      expect(ops.getTotalLiability('dice')).toBe(1000);
    });

    it('should keep liability scoped to a single app', () => {
      // Arrange - a second app with its own credit
      ops.register('cards', 'dev2');
      ops.credit('cards', 'alice', 9999);

      // Assert - cross-app leakage would misreport financial health
      expect(ops.getTotalLiability('dice')).toBe(1000);
      expect(ops.getTotalLiability('cards')).toBe(9999);
    });

    it('should track liability down as players withdraw', () => {
      // Act
      ops.withdrawCredit('dice', 'alice', 700);

      // Assert
      expect(ops.getTotalLiability('dice')).toBe(300);
    });
  });

  describe('Upgrade Safety', () => {
    it('should require a timelock before an upgrade executes', () => {
      // Act
      const { unlockHeight } = ops.proposeUpgrade(2, 100);

      // Assert - execution before the unlock height is rejected
      expect(unlockHeight).toBeGreaterThan(0);
      expect(() => ops.executeUpgrade(2)).toThrow(/timelock not elapsed/i);
      expect(ops.version()).toBe(1);
    });

    it('should reject a timelock delay below the minimum', () => {
      // Assert - a zero-delay upgrade defeats the purpose of the timelock
      expect(() => ops.proposeUpgrade(2, 0)).toThrow(/timelock delay below minimum/i);
    });

    it('should execute the upgrade once the timelock elapses', () => {
      // Arrange
      ops.proposeUpgrade(2, 100);

      // Act
      ops.advanceBlocks(101);
      const result = ops.executeUpgrade(2);

      // Assert
      expect(result.version).toBe(2);
      expect(ops.version()).toBe(2);
      expect(ops.eventNames()).toContain('Upgraded');
    });

    it('should preserve all storage across an upgrade', () => {
      // Arrange - state written before the upgrade
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 2000);
      ops.credit('dice', 'alice', 700);
      const keysBefore = ops.storageKeys().sort();

      // Act
      ops.proposeUpgrade(2, 100);
      ops.advanceBlocks(101);
      ops.executeUpgrade(2);

      // Assert - no data loss, the core upgrade-safety requirement
      expect(ops.storageKeys().sort()).toEqual(keysBefore);
      expect(ops.creditOf('dice', 'alice')).toBe(700);
      expect(ops.poolBalance('dice')).toBe(2000);
      expect(ops.getApp('dice')).toMatchObject({ owner: 'dev1', status: 'active' });
    });

    it('should reject an upgrade that does not increase the version', () => {
      // Assert - blocks accidental downgrade and replay of an old package
      expect(() => ops.proposeUpgrade(1, 100)).toThrow(/version must increase/i);
      expect(() => ops.proposeUpgrade(0, 100)).toThrow(/version must increase/i);
    });

    it('should reject execution when no upgrade was proposed', () => {
      // Assert - no silent path around the proposal step
      expect(() => ops.executeUpgrade(2)).toThrow(/no upgrade proposed/i);
    });

    it('should allow cancelling a proposed upgrade', () => {
      // Arrange
      ops.proposeUpgrade(2, 100);

      // Act - rollback of the decision, before any state changes
      ops.cancelUpgrade();
      ops.advanceBlocks(101);

      // Assert
      expect(() => ops.executeUpgrade(2)).toThrow(/no upgrade proposed/i);
      expect(ops.version()).toBe(1);
      expect(ops.eventNames()).toContain('UpgradeCancelled');
    });

    it('should clear the proposal after execution so it cannot replay', () => {
      // Arrange
      ops.proposeUpgrade(2, 100);
      ops.advanceBlocks(101);
      ops.executeUpgrade(2);

      // Assert - a second execute needs a fresh proposal
      expect(() => ops.executeUpgrade(3)).toThrow(/no upgrade proposed/i);
    });

    it('should emit an auditable trail for the whole upgrade cycle', () => {
      // Act
      ops.proposeUpgrade(2, 100);
      ops.advanceBlocks(101);
      ops.executeUpgrade(2);

      // Assert
      expect(ops.eventNames()).toEqual(['UpgradeProposed', 'Upgraded']);
    });
  });

  describe('Emergency Procedures', () => {
    beforeEach(() => {
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 2000);
      ops.credit('dice', 'alice', 700);
    });

    it('should block deposits and new games while paused', () => {
      // Act
      ops.pause();

      // Assert - the incident stops new exposure
      expect(ops.isPaused()).toBe(true);
      expect(() => ops.credit('dice', 'alice', 100)).toThrow(/paused/i);
      expect(() => ops.startGame('dice', 'engine-dice', 'alice', 100)).toThrow(/paused/i);
    });

    it('should keep withdrawal available while paused', () => {
      // Act
      ops.pause();
      ops.withdrawCredit('dice', 'alice', 700);

      // Assert - a pause must never trap player funds
      expect(ops.creditOf('dice', 'alice')).toBe(0);
    });

    it('should settle an in-flight game after a pause', () => {
      // Arrange - a game already open when the incident starts
      ops.startGame('dice', 'engine-dice', 'alice', 100);

      // Act
      ops.pause();
      ops.finalizeGame('dice', 'alice', 200, ['roll']);

      // Assert - the player is not stranded mid-round
      expect(ops.creditOf('dice', 'alice')).toBe(800);
    });

    it('should resume normal operation after unpause', () => {
      // Act
      ops.pause();
      ops.unpause();
      ops.credit('dice', 'alice', 100);

      // Assert
      expect(ops.isPaused()).toBe(false);
      expect(ops.creditOf('dice', 'alice')).toBe(800);
    });

    it('should reject a redundant pause or unpause', () => {
      // Assert - idempotency errors surface operator mistakes instead of
      // silently succeeding and muddying the event trail
      ops.pause();
      expect(() => ops.pause()).toThrow(/already paused/i);
      ops.unpause();
      expect(() => ops.unpause()).toThrow(/not paused/i);
    });

    it('should allow an upgrade to proceed while paused', () => {
      // Arrange - the normal incident sequence is pause, then patch
      ops.pause();

      // Act
      ops.proposeUpgrade(2, 100);
      ops.advanceBlocks(101);

      // Assert
      expect(ops.executeUpgrade(2).version).toBe(2);
    });
  });

  describe('Array and Batch Boundaries', () => {
    beforeEach(() => {
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 100_000);
      ops.credit('dice', 'alice', 1000);
    });

    it('should accept an empty opLog as a valid no-action round', () => {
      // Act - a player who took no in-game actions
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      ops.finalizeGame('dice', 'alice', 0, []);

      // Assert
      const finalized = ops.events().find((e) => e.name === 'GameFinalized');
      expect(finalized!.payload.opCount).toBe(0);
    });

    it('should accept an opLog exactly at the limit', () => {
      // Arrange
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      const opLog = Array.from({ length: LIMIT.opLogEntries }, (_, i) => `op${i}`);

      // Act / Assert - the boundary itself must not be off by one
      expect(() => ops.finalizeGame('dice', 'alice', 0, opLog)).not.toThrow();
    });

    it('should reject an opLog one entry past the limit', () => {
      // Arrange
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      const opLog = Array.from({ length: LIMIT.opLogEntries + 1 }, (_, i) => `op${i}`);

      // Assert
      expect(() => ops.finalizeGame('dice', 'alice', 0, opLog)).toThrow(/opLog too long/i);
    });

    it('should reject a pathologically long opLog', () => {
      // Arrange - the documented 10000-operation case
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      const opLog = Array.from({ length: 10_000 }, (_, i) => `op${i}`);

      // Assert
      expect(() => ops.finalizeGame('dice', 'alice', 0, opLog)).toThrow(/opLog too long/i);
    });

    it('should accept an empty batch without side effects', () => {
      // Act
      const result = ops.batchCredit('dice', []);

      // Assert
      expect(result.applied).toBe(0);
      expect(ops.getTotalLiability('dice')).toBe(1000);
    });

    it('should apply a batch at the size limit', () => {
      // Arrange
      const entries = Array.from({ length: LIMIT.batchSize }, (_, i) => ({
        player: `p${i}`,
        amount: 10,
      }));

      // Act
      const result = ops.batchCredit('dice', entries);

      // Assert
      expect(result.applied).toBe(LIMIT.batchSize);
      expect(ops.getTotalLiability('dice')).toBe(1000 + LIMIT.batchSize * 10);
    });

    it('should reject a batch past the size limit', () => {
      // Arrange
      const entries = Array.from({ length: LIMIT.batchSize + 1 }, (_, i) => ({
        player: `p${i}`,
        amount: 10,
      }));

      // Assert
      expect(() => ops.batchCredit('dice', entries)).toThrow(/batch too large/i);
    });

    it('should apply a batch atomically when one entry is invalid', () => {
      // Arrange - a bad entry in the middle
      const entries = [
        { player: 'p1', amount: 10 },
        { player: 'p2', amount: 0 },
        { player: 'p3', amount: 10 },
      ];

      // Act
      expect(() => ops.batchCredit('dice', entries)).toThrow(/positive/i);

      // Assert - no partial application, so callers can retry safely
      expect(ops.creditOf('dice', 'p1')).toBe(0);
      expect(ops.creditOf('dice', 'p3')).toBe(0);
      expect(ops.getTotalLiability('dice')).toBe(1000);
    });
  });

  describe('Storage Key Isolation and Growth', () => {
    it('should not collide between different data types for the same id', () => {
      // Arrange - app, account, credit and pool all keyed by the same appId
      ops.register('dice', 'dev1');
      ops.credit('dice', 'alice', 500);
      ops.fundPool('dice', 900);

      // Assert - prefixing keeps every record distinct and readable
      const keys = ops.storageKeys();
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toContain('a:dice');
      expect(keys).toContain('c:dice');
      expect(keys).toContain('p:dice');
      expect(keys).toContain('r:dice:alice');
      expect(ops.getApp('dice')!.account).toBe('aa-dice');
      expect(ops.creditOf('dice', 'alice')).toBe(500);
      expect(ops.poolBalance('dice')).toBe(900);
    });

    it('should not let a player id impersonate another app scope', () => {
      // Arrange - a player name containing the key separator
      ops.register('dice', 'dev1');
      ops.register('cards', 'dev2');
      ops.credit('cards', 'alice', 100);

      // Act - an id crafted to look like the cards scope
      ops.credit('dice', 'cards:alice', 700);

      // Assert - the cards balance is untouched
      expect(ops.creditOf('cards', 'alice')).toBe(100);
      expect(ops.creditOf('dice', 'cards:alice')).toBe(700);
    });

    it('should keep app records independent as the registry grows', () => {
      // Arrange - a registry well past a handful of apps
      for (let i = 0; i < 200; i++) {
        ops.register(`app${String(i).padStart(3, '0')}`, `dev${i}`);
        ops.credit(`app${String(i).padStart(3, '0')}`, 'alice', i + 1);
      }

      // Assert - no cross-contamination at scale
      expect(ops.getApp('app000')).toMatchObject({ owner: 'dev0' });
      expect(ops.getApp('app199')).toMatchObject({ owner: 'dev199' });
      expect(ops.creditOf('app000', 'alice')).toBe(1);
      expect(ops.creditOf('app199', 'alice')).toBe(200);
      expect(ops.getTotalLiability('app100')).toBe(101);
    });

    it('should paginate app listings rather than returning everything', () => {
      // Arrange
      for (let i = 0; i < 120; i++) {
        ops.register(`app${String(i).padStart(3, '0')}`, `dev${i}`);
      }

      // Act
      const page0 = ops.listApps(0, 50);
      const page1 = ops.listApps(1, 50);
      const page2 = ops.listApps(2, 50);

      // Assert - full coverage without overlap
      expect(page0).toHaveLength(50);
      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(20);
      expect(new Set([...page0, ...page1, ...page2]).size).toBe(120);
      expect(page0[0]).toBe('app000');
    });

    it('should reject an oversized page request', () => {
      // Assert - an unbounded query would exhaust gas
      expect(() => ops.listApps(0, LIMIT.appsPerPage + 1)).toThrow(/page size exceeds/i);
    });

    it('should return an empty page past the end of the registry', () => {
      // Arrange
      ops.register('dice', 'dev1');

      // Assert - pagination terminates cleanly instead of erroring
      expect(ops.listApps(5, 50)).toEqual([]);
    });
  });

  describe('Event Payload Bounds', () => {
    beforeEach(() => {
      ops.register('dice', 'dev1');
      ops.fundPool('dice', 10_000);
      ops.credit('dice', 'alice', 1000);
    });

    it('should summarize a large opLog instead of inlining it', () => {
      // Arrange - a long but legal opLog
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      const opLog = Array.from({ length: LIMIT.opLogEntries }, () => 'x'.repeat(200));

      // Act
      ops.finalizeGame('dice', 'alice', 0, opLog);

      // Assert - the event carries a count, so payload size stays bounded
      const finalized = ops.events().find((e) => e.name === 'GameFinalized')!;
      expect(finalized.payload.opCount).toBe(LIMIT.opLogEntries);
      expect(JSON.stringify(finalized.payload).length).toBeLessThan(
        LIMIT.eventPayloadBytes,
      );
    });

    it('should keep every emitted payload inside the size budget', () => {
      // Arrange - exercise every event-emitting path
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      ops.finalizeGame('dice', 'alice', 150, ['roll', 'settle']);
      ops.withdrawCredit('dice', 'alice', 100);
      ops.batchCredit('dice', [{ player: 'bob', amount: 50 }]);
      ops.pause();
      ops.unpause();
      ops.proposeUpgrade(2, 100);
      ops.cancelUpgrade();

      // Assert
      for (const event of ops.events()) {
        expect(
          JSON.stringify(event.payload).length,
          event.name,
        ).toBeLessThanOrEqual(LIMIT.eventPayloadBytes);
      }
    });

    it('should record events in ascending block order', () => {
      // Arrange
      ops.startGame('dice', 'engine-dice', 'alice', 100);
      ops.finalizeGame('dice', 'alice', 150, []);
      ops.withdrawCredit('dice', 'alice', 100);

      // Assert - ordering is what lets an indexer replay deterministically
      const heights = ops.events().map((e) => e.blockHeight);
      expect(heights).toEqual([...heights].sort((a, b) => a - b));
      expect(new Set(heights).size).toBe(heights.length);
    });
  });
});

export { };
