/**
 * Executable User Journey Tests
 * Priority: P4 - complete end-to-end journeys
 *
 * Executable form of the three end-to-end journeys catalogued in
 * docs/validation/SCENARIO-CATALOG.md: developer onboards a new game, player
 * plays a game, developer manages an app. Each journey runs the full sequence a real actor
 * performs and asserts the observable state at every step, so a step that
 * silently no-ops is caught rather than assumed to work.
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface AppRecord {
  appId: string;
  owner: string;
  account: string;
  descriptor: Record<string, string>;
  status: 'active' | 'paused' | 'retired';
  registeredAt: number;
}

interface PlaySession {
  appId: string;
  player: string;
  wager: number;
  status: 'open' | 'awaiting-oracle' | 'settled';
  payout?: number;
}

const REGISTRATION_FEE = 100_000_000; // 1 GAS in datoshi

function createMockPlatformJourney() {
  const apps = new Map<string, AppRecord>();
  const balances = new Map<string, number>();
  const credits = new Map<string, Map<string, number>>();
  const pools = new Map<string, number>();
  const sessions = new Map<string, PlaySession>();
  const events: Array<{ name: string; appId: string }> = [];
  let sessionCounter = 0;
  let blockHeight = 1000;

  const creditsFor = (appId: string) => {
    if (!credits.has(appId)) credits.set(appId, new Map());
    return credits.get(appId)!;
  };

  const requireApp = (appId: string) => {
    const app = apps.get(appId);
    if (!app) throw new Error('FAULT: app not registered');
    return app;
  };

  const requireOwner = (appId: string, caller: string) => {
    const app = requireApp(appId);
    if (app.owner !== caller) throw new Error('FAULT: caller is not the app owner');
    return app;
  };

  const emit = (name: string, appId: string) => events.push({ name, appId });

  return {
    fundWallet: (address: string, amount: number) => {
      balances.set(address, (balances.get(address) ?? 0) + amount);
      return { state: 'HALT', balance: balances.get(address) };
    },
    balanceOf: (address: string) => balances.get(address) ?? 0,

    register: (appId: string, owner: string, descriptor: Record<string, string>) => {
      if (!appId || appId.length < 3) throw new Error('FAULT: appId too short');
      if (apps.has(appId)) throw new Error('FAULT: appId already registered');
      const balance = balances.get(owner) ?? 0;
      if (balance < REGISTRATION_FEE) {
        throw new Error('FAULT: insufficient balance for registration fee');
      }
      if (!descriptor.name || !descriptor.version) {
        throw new Error('FAULT: descriptor requires name and version');
      }

      balances.set(owner, balance - REGISTRATION_FEE);
      // The registry mints a deterministic contract account per app.
      const account = `aa-${appId}`;
      apps.set(appId, {
        appId,
        owner,
        account,
        descriptor: { ...descriptor },
        status: 'active',
        registeredAt: ++blockHeight,
      });
      pools.set(appId, 0);
      emit('AppRegistered', appId);
      return { state: 'HALT', appId, account };
    },

    getApp: (appId: string) => {
      const app = apps.get(appId);
      return app ? { ...app, descriptor: { ...app.descriptor } } : undefined;
    },

    updateDescriptor: (appId: string, caller: string, patch: Record<string, string>) => {
      const app = requireOwner(appId, caller);
      if (app.status === 'retired') throw new Error('FAULT: app is retired');
      app.descriptor = { ...app.descriptor, ...patch };
      emit('DescriptorUpdated', appId);
      return { state: 'HALT', descriptor: { ...app.descriptor } };
    },

    fundPool: (appId: string, caller: string, amount: number) => {
      const app = requireOwner(appId, caller);
      if (amount <= 0) throw new Error('FAULT: invalid amount');
      const balance = balances.get(caller) ?? 0;
      if (balance < amount) throw new Error('FAULT: insufficient balance');
      balances.set(caller, balance - amount);
      pools.set(app.appId, (pools.get(app.appId) ?? 0) + amount);
      emit('PoolFunded', appId);
      return { state: 'HALT', poolBalance: pools.get(app.appId) };
    },
    poolBalance: (appId: string) => pools.get(appId) ?? 0,

    depositCredit: (appId: string, player: string, amount: number) => {
      const app = requireApp(appId);
      if (app.status !== 'active') throw new Error('FAULT: app is not active');
      if (amount <= 0) throw new Error('FAULT: invalid amount');
      const balance = balances.get(player) ?? 0;
      if (balance < amount) throw new Error('FAULT: insufficient balance');
      balances.set(player, balance - amount);
      const scoped = creditsFor(appId);
      scoped.set(player, (scoped.get(player) ?? 0) + amount);
      emit('CreditDeposited', appId);
      return { state: 'HALT', credit: scoped.get(player) };
    },
    creditOf: (appId: string, player: string) => creditsFor(appId).get(player) ?? 0,

    play: (appId: string, player: string, wager: number) => {
      const app = requireApp(appId);
      if (app.status !== 'active') throw new Error('FAULT: app is not active');
      const scoped = creditsFor(appId);
      const credit = scoped.get(player) ?? 0;
      if (credit < wager) throw new Error('FAULT: insufficient credit');
      const pool = pools.get(appId) ?? 0;
      if (pool < wager * 2) throw new Error('FAULT: pool cannot cover maximum payout');

      scoped.set(player, credit - wager);
      pools.set(appId, pool + wager);
      const sessionId = `sess-${++sessionCounter}`;
      sessions.set(sessionId, { appId, player, wager, status: 'awaiting-oracle' });
      emit('PlayStarted', appId);
      return { state: 'HALT', sessionId };
    },

    resolve: (sessionId: string, multiplier: number) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('FAULT: session not found');
      if (session.status !== 'awaiting-oracle') {
        throw new Error(`FAULT: session not awaiting oracle (status: ${session.status})`);
      }
      if (multiplier < 0 || multiplier > 2) throw new Error('FAULT: multiplier out of range');

      const payout = session.wager * multiplier;
      const pool = pools.get(session.appId) ?? 0;
      if (pool < payout) throw new Error('FAULT: pool insolvent for payout');
      pools.set(session.appId, pool - payout);
      if (payout > 0) {
        const scoped = creditsFor(session.appId);
        scoped.set(session.player, (scoped.get(session.player) ?? 0) + payout);
      }
      session.status = 'settled';
      session.payout = payout;
      emit('PlaySettled', session.appId);
      return { state: 'HALT', payout };
    },

    withdrawCredit: (appId: string, player: string, amount: number) => {
      const scoped = creditsFor(appId);
      const credit = scoped.get(player) ?? 0;
      if (amount <= 0) throw new Error('FAULT: invalid amount');
      if (credit < amount) throw new Error('FAULT: insufficient credit');
      scoped.set(player, credit - amount);
      balances.set(player, (balances.get(player) ?? 0) + amount);
      emit('CreditWithdrawn', appId);
      return { state: 'HALT', credit: scoped.get(player) };
    },

    pause: (appId: string, caller: string) => {
      const app = requireOwner(appId, caller);
      if (app.status !== 'active') throw new Error('FAULT: app is not active');
      app.status = 'paused';
      emit('AppPaused', appId);
      return { state: 'HALT', status: 'paused' };
    },
    unpause: (appId: string, caller: string) => {
      const app = requireOwner(appId, caller);
      if (app.status !== 'paused') throw new Error('FAULT: app is not paused');
      app.status = 'active';
      emit('AppUnpaused', appId);
      return { state: 'HALT', status: 'active' };
    },
    retire: (appId: string, caller: string) => {
      const app = requireOwner(appId, caller);
      if (app.status === 'retired') throw new Error('FAULT: app already retired');
      app.status = 'retired';
      emit('AppRetired', appId);
      return { state: 'HALT', status: 'retired' };
    },

    getSession: (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session ? { ...session } : undefined;
    },
    eventNames: (appId: string) => events.filter((e) => e.appId === appId).map((e) => e.name),
  };
}

describe('User Journeys - Executable', () => {
  let platform: ReturnType<typeof createMockPlatformJourney>;

  beforeEach(() => {
    platform = createMockPlatformJourney();
  });

  describe('Journey 1: Developer Onboards a New Game', () => {
    it('should carry a developer from funded wallet to a playable app', () => {
      // Arrange - a developer with GAS and nothing else
      const dev = 'dev-alice';
      platform.fundWallet(dev, 1_000_000_000);

      // Act - the documented onboarding sequence
      const registration = platform.register('my-dice-game', dev, {
        name: 'My Dice Game',
        version: '1.0.0',
      });
      platform.fundPool('my-dice-game', dev, 500_000_000);

      // Assert - app exists, account minted, pool funded, fee charged
      expect(registration.account).toBe('aa-my-dice-game');
      const app = platform.getApp('my-dice-game')!;
      expect(app.owner).toBe(dev);
      expect(app.status).toBe('active');
      expect(platform.poolBalance('my-dice-game')).toBe(500_000_000);
      expect(platform.balanceOf(dev)).toBe(1_000_000_000 - REGISTRATION_FEE - 500_000_000);
      expect(platform.eventNames('my-dice-game')).toEqual([
        'AppRegistered',
        'PoolFunded',
      ]);
    });

    it('should block registration when the developer cannot cover the fee', () => {
      // Arrange - underfunded developer
      const dev = 'dev-broke';
      platform.fundWallet(dev, REGISTRATION_FEE - 1);

      // Act & Assert - no partial registration
      expect(() => platform.register('my-game', dev, { name: 'G', version: '1' })).toThrow(
        /insufficient balance for registration fee/i,
      );
      expect(platform.getApp('my-game')).toBeUndefined();
      expect(platform.balanceOf(dev)).toBe(REGISTRATION_FEE - 1);
    });

    it('should reject an incomplete descriptor before charging the fee', () => {
      // Arrange
      const dev = 'dev-alice';
      platform.fundWallet(dev, 1_000_000_000);

      // Act & Assert - the fee is not consumed by a failed registration
      expect(() => platform.register('my-game', dev, { name: 'Only Name' })).toThrow(
        /descriptor requires name and version/i,
      );
      expect(platform.balanceOf(dev)).toBe(1_000_000_000);
    });

    it('should reject a duplicate appId without disturbing the original app', () => {
      // Arrange - first developer owns the id
      platform.fundWallet('dev-alice', 1_000_000_000);
      platform.register('shared-id', 'dev-alice', { name: 'A', version: '1' });
      platform.fundWallet('dev-bob', 1_000_000_000);

      // Act & Assert
      expect(() =>
        platform.register('shared-id', 'dev-bob', { name: 'B', version: '1' }),
      ).toThrow(/already registered/i);
      expect(platform.getApp('shared-id')!.owner).toBe('dev-alice');
      expect(platform.balanceOf('dev-bob')).toBe(1_000_000_000);
    });
  });

  describe('Journey 2: Player Plays a Game', () => {
    beforeEach(() => {
      platform.fundWallet('dev-alice', 2_000_000_000);
      platform.register('dice', 'dev-alice', { name: 'Dice', version: '1.0.0' });
      platform.fundPool('dice', 'dev-alice', 1_000_000_000);
      platform.fundWallet('player-1', 500_000_000);
    });

    it('should carry a player from deposit through a winning round to withdrawal', () => {
      // Arrange
      platform.depositCredit('dice', 'player-1', 100_000_000);
      expect(platform.creditOf('dice', 'player-1')).toBe(100_000_000);

      // Act - play, win 2x, then cash out everything
      const { sessionId } = platform.play('dice', 'player-1', 50_000_000);
      const settlement = platform.resolve(sessionId, 2);
      const finalCredit = platform.creditOf('dice', 'player-1');
      platform.withdrawCredit('dice', 'player-1', finalCredit);

      // Assert - credit fully realised into the wallet
      expect(settlement.payout).toBe(100_000_000);
      expect(finalCredit).toBe(150_000_000);
      expect(platform.creditOf('dice', 'player-1')).toBe(0);
      expect(platform.balanceOf('player-1')).toBe(500_000_000 - 100_000_000 + 150_000_000);
      expect(platform.getSession(sessionId)!.status).toBe('settled');
    });

    it('should retain the wager in the pool on a losing round', () => {
      // Arrange
      platform.depositCredit('dice', 'player-1', 100_000_000);
      const poolBefore = platform.poolBalance('dice');

      // Act - lose the round
      const { sessionId } = platform.play('dice', 'player-1', 40_000_000);
      platform.resolve(sessionId, 0);

      // Assert
      expect(platform.creditOf('dice', 'player-1')).toBe(60_000_000);
      expect(platform.poolBalance('dice')).toBe(poolBefore + 40_000_000);
    });

    it('should surface an actionable failure when the player has no credit', () => {
      // Act & Assert - a first-time player who skipped the deposit step
      expect(() => platform.play('dice', 'player-new', 10_000_000)).toThrow(
        /insufficient credit/i,
      );
    });

    it('should let a player withdraw an unspent deposit in full', () => {
      // Arrange - deposit then change mind without playing
      platform.depositCredit('dice', 'player-1', 100_000_000);

      // Act
      platform.withdrawCredit('dice', 'player-1', 100_000_000);

      // Assert - no value lost to the round trip
      expect(platform.balanceOf('player-1')).toBe(500_000_000);
      expect(platform.creditOf('dice', 'player-1')).toBe(0);
    });

    it('should reject withdrawing more credit than the player holds', () => {
      // Arrange
      platform.depositCredit('dice', 'player-1', 100_000_000);

      // Act & Assert
      expect(() =>
        platform.withdrawCredit('dice', 'player-1', 100_000_001),
      ).toThrow(/insufficient credit/i);
      expect(platform.creditOf('dice', 'player-1')).toBe(100_000_000);
    });

    it('should emit the full observable event trail for one round', () => {
      // Arrange & Act
      platform.depositCredit('dice', 'player-1', 100_000_000);
      const { sessionId } = platform.play('dice', 'player-1', 20_000_000);
      platform.resolve(sessionId, 1);
      platform.withdrawCredit('dice', 'player-1', 100_000_000);

      // Assert - an indexer can reconstruct the journey from events alone
      expect(platform.eventNames('dice')).toEqual([
        'AppRegistered',
        'PoolFunded',
        'CreditDeposited',
        'PlayStarted',
        'PlaySettled',
        'CreditWithdrawn',
      ]);
    });
  });

  describe('Journey 3: Developer Manages an App', () => {
    beforeEach(() => {
      platform.fundWallet('dev-alice', 2_000_000_000);
      platform.register('dice', 'dev-alice', { name: 'Dice', version: '1.0.0' });
      platform.fundPool('dice', 'dev-alice', 1_000_000_000);
      platform.fundWallet('player-1', 500_000_000);
      platform.depositCredit('dice', 'player-1', 100_000_000);
    });

    it('should let the owner ship a descriptor update without downtime', () => {
      // Act
      const result = platform.updateDescriptor('dice', 'dev-alice', { version: '1.1.0' });

      // Assert - version bumped, name preserved, app still playable
      expect(result.descriptor).toEqual({ name: 'Dice', version: '1.1.0' });
      expect(platform.play('dice', 'player-1', 10_000_000).sessionId).toBeDefined();
    });

    it('should reject descriptor updates from a non-owner', () => {
      // Act & Assert
      expect(() =>
        platform.updateDescriptor('dice', 'attacker', { version: '9.9.9' }),
      ).toThrow(/not the app owner/i);
      expect(platform.getApp('dice')!.descriptor.version).toBe('1.0.0');
    });

    it('should halt new play while paused and resume cleanly after unpause', () => {
      // Act - pause
      platform.pause('dice', 'dev-alice');

      // Assert - play blocked, credit untouched
      expect(() => platform.play('dice', 'player-1', 10_000_000)).toThrow(
        /app is not active/i,
      );
      expect(platform.creditOf('dice', 'player-1')).toBe(100_000_000);

      // Act - resume
      platform.unpause('dice', 'dev-alice');

      // Assert
      expect(platform.play('dice', 'player-1', 10_000_000).sessionId).toBeDefined();
    });

    it('should block deposits while paused so funds cannot enter a stopped app', () => {
      // Arrange
      platform.pause('dice', 'dev-alice');

      // Act & Assert
      expect(() => platform.depositCredit('dice', 'player-1', 10_000_000)).toThrow(
        /app is not active/i,
      );
    });

    it('should still allow withdrawals while paused', () => {
      // Arrange - a pause must not trap player funds
      platform.pause('dice', 'dev-alice');

      // Act
      platform.withdrawCredit('dice', 'player-1', 100_000_000);

      // Assert
      expect(platform.creditOf('dice', 'player-1')).toBe(0);
      expect(platform.balanceOf('player-1')).toBe(500_000_000);
    });

    it('should reject pausing an app that is not active', () => {
      // Arrange
      platform.pause('dice', 'dev-alice');

      // Act & Assert
      expect(() => platform.pause('dice', 'dev-alice')).toThrow(/not active/i);
    });

    it('should let players exit after the app is retired', () => {
      // Arrange
      platform.retire('dice', 'dev-alice');

      // Assert - no new play, but the exit path stays open
      expect(() => platform.play('dice', 'player-1', 10_000_000)).toThrow(
        /app is not active/i,
      );
      expect(() =>
        platform.withdrawCredit('dice', 'player-1', 100_000_000),
      ).not.toThrow();
    });

    it('should reject descriptor updates on a retired app', () => {
      // Arrange
      platform.retire('dice', 'dev-alice');

      // Act & Assert
      expect(() =>
        platform.updateDescriptor('dice', 'dev-alice', { version: '2.0.0' }),
      ).toThrow(/app is retired/i);
    });

    it('should settle an in-flight session even after the app is paused', () => {
      // Arrange - a round is already awaiting the oracle when the owner pauses
      const { sessionId } = platform.play('dice', 'player-1', 20_000_000);
      platform.pause('dice', 'dev-alice');

      // Act - the oracle answer must still land
      const settlement = platform.resolve(sessionId, 2);

      // Assert - the player is not stranded mid-round by an admin action
      expect(settlement.payout).toBe(40_000_000);
      expect(platform.getSession(sessionId)!.status).toBe('settled');
    });
  });
});

export { };
