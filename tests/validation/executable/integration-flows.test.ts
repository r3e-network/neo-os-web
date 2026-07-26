/**
 * Executable Extended Integration Flow Tests
 * Priority: P1 - Cross-component correctness
 *
 * Each component (credit, session, oracle, pool) is validated in isolation
 * elsewhere. These tests exercise the composed end-to-end paths, where the
 * failure mode is a component that behaves correctly alone but leaves the
 * system inconsistent when combined - credit debited without a payout,
 * a pool drained below its reserve, or a refund that double-credits.
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface Session {
  appId: string;
  player: string;
  wager: number;
  status: 'open' | 'awaiting-oracle' | 'settled' | 'refunded';
  oracleRequestId?: string;
}

function createMockPlatform() {
  // appId -> payer -> balance
  const credits = new Map<string, Map<string, number>>();
  const pools = new Map<string, { balance: number; reserved: number }>();
  const sessions = new Map<string, Session>();
  const oracleRequests = new Map<
    string,
    { sessionId: string; status: 'pending' | 'completed' }
  >();
  let sessionCounter = 0;
  let oracleCounter = 0;

  const creditsFor = (appId: string) => {
    if (!credits.has(appId)) credits.set(appId, new Map());
    return credits.get(appId)!;
  };

  const requirePool = (appId: string) => {
    const pool = pools.get(appId);
    if (!pool) throw new Error('FAULT: pool not found');
    return pool;
  };

  return {
    // --- Setup ---
    fundCredit: (appId: string, payer: string, amount: number) => {
      if (amount <= 0) throw new Error('FAULT: invalid amount');
      const scoped = creditsFor(appId);
      scoped.set(payer, (scoped.get(payer) ?? 0) + amount);
      return { state: 'HALT', balance: scoped.get(payer) };
    },
    getCredit: (appId: string, payer: string) => creditsFor(appId).get(payer) ?? 0,

    createPool: (appId: string, balance: number, reserved: number) => {
      if (reserved > balance) throw new Error('FAULT: reserve exceeds balance');
      pools.set(appId, { balance, reserved });
      return { state: 'HALT', balance, reserved };
    },
    getPool: (appId: string) => {
      const pool = pools.get(appId);
      return pool ? { ...pool } : undefined;
    },

    // --- Flow: start a play ---
    startPlay: (appId: string, player: string, wager: number) => {
      if (wager <= 0) throw new Error('FAULT: invalid wager');

      const scoped = creditsFor(appId);
      const balance = scoped.get(player) ?? 0;
      if (balance < wager) throw new Error('FAULT: insufficient credit');

      // Pool must be able to cover a maximum payout before credit is debited,
      // otherwise the player pays for a game that cannot pay out.
      const pool = requirePool(appId);
      const maxPayout = wager * 2;
      if (pool.balance - pool.reserved < maxPayout) {
        throw new Error('FAULT: pool cannot cover maximum payout');
      }

      scoped.set(player, balance - wager);
      pool.balance += wager;
      pool.reserved += maxPayout;

      const sessionId = `sess-${++sessionCounter}`;
      sessions.set(sessionId, { appId, player, wager, status: 'open' });
      return { state: 'HALT', sessionId, debited: wager };
    },

    // --- Flow: request randomness ---
    requestOracle: (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('FAULT: session not found');
      if (session.status !== 'open') {
        throw new Error(`FAULT: session not open (status: ${session.status})`);
      }

      const requestId = `orc-${++oracleCounter}`;
      oracleRequests.set(requestId, { sessionId, status: 'pending' });
      session.status = 'awaiting-oracle';
      session.oracleRequestId = requestId;
      return { state: 'HALT', requestId };
    },

    // --- Flow: settle with oracle result ---
    settle: (requestId: string, payoutMultiplier: number) => {
      const request = oracleRequests.get(requestId);
      if (!request) throw new Error('FAULT: oracle request not found');
      if (request.status !== 'pending') {
        throw new Error('FAULT: oracle request already completed');
      }
      if (payoutMultiplier < 0 || payoutMultiplier > 2) {
        throw new Error('FAULT: payout multiplier out of range');
      }

      const session = sessions.get(request.sessionId)!;
      if (session.status !== 'awaiting-oracle') {
        throw new Error(`FAULT: session not awaiting oracle (status: ${session.status})`);
      }

      const pool = requirePool(session.appId);
      const maxPayout = session.wager * 2;
      const payout = session.wager * payoutMultiplier;

      // Release the reservation first, then pay out of the unreserved balance.
      pool.reserved -= maxPayout;
      if (pool.balance - pool.reserved < payout) {
        pool.reserved += maxPayout;
        throw new Error('FAULT: pool insolvent for payout');
      }
      pool.balance -= payout;

      if (payout > 0) {
        const scoped = creditsFor(session.appId);
        scoped.set(session.player, (scoped.get(session.player) ?? 0) + payout);
      }

      request.status = 'completed';
      session.status = 'settled';
      return { state: 'HALT', payout, sessionId: request.sessionId };
    },

    // --- Flow: refund a stuck session ---
    refund: (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('FAULT: session not found');
      if (session.status === 'settled') {
        throw new Error('FAULT: cannot refund a settled session');
      }
      if (session.status === 'refunded') {
        throw new Error('FAULT: session already refunded');
      }

      const pool = requirePool(session.appId);
      const maxPayout = session.wager * 2;

      pool.reserved -= maxPayout;
      pool.balance -= session.wager;

      const scoped = creditsFor(session.appId);
      scoped.set(session.player, (scoped.get(session.player) ?? 0) + session.wager);

      if (session.oracleRequestId) {
        const request = oracleRequests.get(session.oracleRequestId);
        if (request) request.status = 'completed';
      }

      session.status = 'refunded';
      return { state: 'HALT', refunded: session.wager };
    },

    getSession: (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session ? { ...session } : undefined;
    },
  };
}

describe('Extended Integration Flows - Executable', () => {
  let platform: ReturnType<typeof createMockPlatform>;

  beforeEach(() => {
    platform = createMockPlatform();
    platform.createPool('game', 10000, 0);
    platform.fundCredit('game', 'player-1', 500);
  });

  describe('Happy Path: fund -> play -> oracle -> settle', () => {
    it('should complete a winning round with consistent balances', () => {
      // Arrange
      const startingCredit = platform.getCredit('game', 'player-1');
      const startingPool = platform.getPool('game')!;

      // Act
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      const { requestId } = platform.requestOracle(sessionId);
      const settlement = platform.settle(requestId, 2);

      // Assert - player is up by the wager (paid 100, received 200)
      expect(settlement.payout).toBe(200);
      expect(platform.getCredit('game', 'player-1')).toBe(startingCredit + 100);

      // Pool took the wager and paid out; net -100
      const endingPool = platform.getPool('game')!;
      expect(endingPool.balance).toBe(startingPool.balance - 100);

      // No reservation left dangling
      expect(endingPool.reserved).toBe(0);
      expect(platform.getSession(sessionId)!.status).toBe('settled');
    });

    it('should complete a losing round retaining the wager in the pool', () => {
      // Arrange
      const startingPool = platform.getPool('game')!;

      // Act
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      const { requestId } = platform.requestOracle(sessionId);
      const settlement = platform.settle(requestId, 0);

      // Assert
      expect(settlement.payout).toBe(0);
      expect(platform.getCredit('game', 'player-1')).toBe(400);

      const endingPool = platform.getPool('game')!;
      expect(endingPool.balance).toBe(startingPool.balance + 100);
      expect(endingPool.reserved).toBe(0);
    });

    it('should handle a partial-return round', () => {
      // Act
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      const { requestId } = platform.requestOracle(sessionId);
      const settlement = platform.settle(requestId, 0.5);

      // Assert - player recovers half the wager
      expect(settlement.payout).toBe(50);
      expect(platform.getCredit('game', 'player-1')).toBe(450);
      expect(platform.getPool('game')!.reserved).toBe(0);
    });
  });

  describe('Credit and Pool Interaction', () => {
    it('should reject a play the player cannot afford before touching the pool', () => {
      // Arrange
      const startingPool = platform.getPool('game')!;

      // Act & Assert
      expect(() => platform.startPlay('game', 'player-1', 5000)).toThrow(
        /insufficient credit/i,
      );

      // Pool must be untouched by the failed attempt
      expect(platform.getPool('game')).toEqual(startingPool);
    });

    it('should reject a play the pool cannot cover before debiting credit', () => {
      // Arrange - pool too thin to cover a 2x payout on 100
      platform.createPool('thin', 150, 0);
      platform.fundCredit('thin', 'player-1', 500);

      // Act & Assert
      expect(() => platform.startPlay('thin', 'player-1', 100)).toThrow(
        /cannot cover maximum payout/i,
      );

      // Credit must not be debited for a play that never started
      expect(platform.getCredit('thin', 'player-1')).toBe(500);
    });

    it('should respect an existing reserve when admitting new plays', () => {
      // Arrange - almost all of the pool is reserved
      platform.createPool('reserved', 1000, 900);
      platform.fundCredit('reserved', 'player-1', 500);

      // Act & Assert - only 100 unreserved, needs 200
      expect(() => platform.startPlay('reserved', 'player-1', 100)).toThrow(
        /cannot cover maximum payout/i,
      );
    });

    it('should keep credit scoped per app across concurrent rounds', () => {
      // Arrange
      platform.createPool('other', 10000, 0);
      platform.fundCredit('other', 'player-1', 500);

      // Act - play in one app only
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      platform.settle(platform.requestOracle(sessionId).requestId, 0);

      // Assert - the other app's credit is unaffected
      expect(platform.getCredit('game', 'player-1')).toBe(400);
      expect(platform.getCredit('other', 'player-1')).toBe(500);
    });
  });

  describe('Oracle Coupling', () => {
    it('should reject settling twice on one oracle request', () => {
      // Arrange
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      const { requestId } = platform.requestOracle(sessionId);
      platform.settle(requestId, 2);

      // Act & Assert - replay protection
      expect(() => platform.settle(requestId, 2)).toThrow(/already completed/i);

      // Player was credited exactly once
      expect(platform.getCredit('game', 'player-1')).toBe(600);
    });

    it('should reject a second oracle request for the same session', () => {
      // Arrange
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      platform.requestOracle(sessionId);

      // Act & Assert
      expect(() => platform.requestOracle(sessionId)).toThrow(
        /session not open \(status: awaiting-oracle\)/i,
      );
    });

    it('should reject a payout multiplier beyond the reserved maximum', () => {
      // Arrange
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      const { requestId } = platform.requestOracle(sessionId);

      // Act & Assert - 3x was never reserved
      expect(() => platform.settle(requestId, 3)).toThrow(/multiplier out of range/i);

      // Session still settleable afterwards
      expect(platform.settle(requestId, 1).payout).toBe(100);
    });
  });

  describe('Refund Path', () => {
    it('should refund a session stuck awaiting the oracle', () => {
      // Arrange
      const startingCredit = platform.getCredit('game', 'player-1');
      const startingPool = platform.getPool('game')!;
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      platform.requestOracle(sessionId);

      // Act
      const result = platform.refund(sessionId);

      // Assert - the round is a no-op end to end
      expect(result.refunded).toBe(100);
      expect(platform.getCredit('game', 'player-1')).toBe(startingCredit);
      expect(platform.getPool('game')).toEqual(startingPool);
      expect(platform.getSession(sessionId)!.status).toBe('refunded');
    });

    it('should refund a session that never reached the oracle', () => {
      // Arrange
      const startingPool = platform.getPool('game')!;
      const { sessionId } = platform.startPlay('game', 'player-1', 100);

      // Act
      platform.refund(sessionId);

      // Assert
      expect(platform.getCredit('game', 'player-1')).toBe(500);
      expect(platform.getPool('game')).toEqual(startingPool);
    });

    it('should reject refunding a settled session', () => {
      // Arrange
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      platform.settle(platform.requestOracle(sessionId).requestId, 2);

      // Act & Assert
      expect(() => platform.refund(sessionId)).toThrow(/cannot refund a settled session/i);
      expect(platform.getCredit('game', 'player-1')).toBe(600);
    });

    it('should reject double refunds', () => {
      // Arrange
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      platform.refund(sessionId);

      // Act & Assert
      expect(() => platform.refund(sessionId)).toThrow(/already refunded/i);
      expect(platform.getCredit('game', 'player-1')).toBe(500);
    });

    it('should reject settling a refunded session via its oracle request', () => {
      // Arrange
      const { sessionId } = platform.startPlay('game', 'player-1', 100);
      const { requestId } = platform.requestOracle(sessionId);
      platform.refund(sessionId);

      // Act & Assert - refund closes the oracle request too
      expect(() => platform.settle(requestId, 2)).toThrow(/already completed/i);
      expect(platform.getCredit('game', 'player-1')).toBe(500);
    });
  });

  describe('Multi-Round Consistency', () => {
    it('should keep the pool balanced across many mixed rounds', () => {
      // Arrange
      platform.fundCredit('game', 'player-1', 1000);
      const startingTotal =
        platform.getCredit('game', 'player-1') + platform.getPool('game')!.balance;
      const multipliers = [0, 2, 1, 0.5, 0, 2, 1];

      // Act
      for (const multiplier of multipliers) {
        const { sessionId } = platform.startPlay('game', 'player-1', 100);
        platform.settle(platform.requestOracle(sessionId).requestId, multiplier);
      }

      // Assert - value is conserved, no reservations leaked
      const endingTotal =
        platform.getCredit('game', 'player-1') + platform.getPool('game')!.balance;
      expect(endingTotal).toBe(startingTotal);
      expect(platform.getPool('game')!.reserved).toBe(0);
    });

    it('should hold reservations for every concurrently open round', () => {
      // Arrange
      platform.fundCredit('game', 'player-1', 1000);

      // Act - three rounds open at once
      const a = platform.startPlay('game', 'player-1', 100);
      const b = platform.startPlay('game', 'player-1', 100);
      const c = platform.startPlay('game', 'player-1', 100);

      // Assert - 2x reserved per open round
      expect(platform.getPool('game')!.reserved).toBe(600);

      // Settling one releases only its own reservation
      platform.settle(platform.requestOracle(a.sessionId).requestId, 0);
      expect(platform.getPool('game')!.reserved).toBe(400);

      platform.settle(platform.requestOracle(b.sessionId).requestId, 2);
      platform.settle(platform.requestOracle(c.sessionId).requestId, 1);
      expect(platform.getPool('game')!.reserved).toBe(0);
    });
  });
});

export { };
