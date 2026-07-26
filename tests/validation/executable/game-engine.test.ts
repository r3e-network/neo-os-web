/**
 * Executable Game Engine Tests
 * Priority: P0 - Core platform functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../../setup';

// Mock game engine with full lifecycle support
function createMockGameEngine() {
  const sessions = new Map<string, {
    appId: string;
    player: string;
    entryFee: number;
    startTime: number;
    status: 'active' | 'completed' | 'expired';
    result?: any;
  }>();

  let sessionCounter = 0;

  return {
    startGame: async (appId: string, player: string, entryFee: number) => {
      if (entryFee < 0) {
        throw new Error('FAULT: entry fee cannot be negative');
      }

      // Generate unique session ID
      const sessionId = `session-${appId}-${Date.now()}-${++sessionCounter}`;

      // Create session
      sessions.set(sessionId, {
        appId,
        player,
        entryFee,
        startTime: Date.now(),
        status: 'active'
      });

      return {
        state: 'HALT',
        gasconsumed: '800000',
        sessionId,
        status: 'started'
      };
    },

    getSession: async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error('FAULT: session not found');
      }
      return session;
    },

    finalize: async (sessionId: string, result: { win: boolean; score: number }) => {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error('FAULT: session not found');
      }

      if (session.status !== 'active') {
        throw new Error(`FAULT: session already ${session.status}`);
      }

      // Calculate payout
      const payout = result.win ? session.entryFee * 2 : 0;

      // Update session
      session.status = 'completed';
      session.result = result;

      return {
        state: 'HALT',
        gasconsumed: '1200000',
        sessionId,
        status: 'completed',
        payout,
        win: result.win
      };
    },

    expireSession: async (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error('FAULT: session not found');
      }

      // Check if actually expired (3600s timeout)
      const elapsed = Date.now() - session.startTime;
      if (elapsed < 3600000) {
        throw new Error('FAULT: session not yet expired');
      }

      if (session.status !== 'active') {
        throw new Error('FAULT: session not active');
      }

      session.status = 'expired';

      return {
        state: 'HALT',
        gasconsumed: '500000',
        sessionId,
        status: 'expired',
        refund: session.entryFee
      };
    }
  };
}

describe('Game Engine - Executable', () => {
  let gameEngine: ReturnType<typeof createMockGameEngine>;

  beforeEach(() => {
    gameEngine = createMockGameEngine();
  });

  describe('Game Session Creation', () => {
    it('should successfully start a new game session', async () => {
      // Arrange
      const appId = 'test-game';
      const player = testUtils.generateAddress();
      const entryFee = 100000000; // 0.1 GAS

      // Act
      const result = await gameEngine.startGame(appId, player, entryFee);

      // Assert
      expect(result.state).toBe('HALT');
      expect(result.sessionId).toBeDefined();
      expect(result.status).toBe('started');

      // Verify session exists
      const session = await gameEngine.getSession(result.sessionId);
      expect(session.appId).toBe(appId);
      expect(session.player).toBe(player);
      expect(session.entryFee).toBe(entryFee);
      expect(session.status).toBe('active');
    });

    it('should generate unique session IDs for concurrent games', async () => {
      // Arrange
      const appId = 'test-game';
      const player1 = testUtils.generateAddress();
      const player2 = testUtils.generateAddress();

      // Act - Start multiple games
      const result1 = await gameEngine.startGame(appId, player1, 1000);
      const result2 = await gameEngine.startGame(appId, player2, 1000);
      const result3 = await gameEngine.startGame(appId, player1, 2000);

      // Assert - All session IDs are unique
      expect(result1.sessionId).not.toBe(result2.sessionId);
      expect(result2.sessionId).not.toBe(result3.sessionId);
      expect(result1.sessionId).not.toBe(result3.sessionId);
    });

    it('should reject negative entry fees', async () => {
      // Arrange
      const appId = 'test-game';
      const player = testUtils.generateAddress();

      // Act & Assert
      await expect(
        gameEngine.startGame(appId, player, -1000)
      ).rejects.toThrow(/entry fee cannot be negative/i);
    });
  });

  describe('Game Finalization', () => {
    it('should finalize winning game with correct payout', async () => {
      // Arrange
      const appId = 'test-game';
      const player = testUtils.generateAddress();
      const entryFee = 1000;
      const startResult = await gameEngine.startGame(appId, player, entryFee);

      // Act - Finalize as win
      const result = await gameEngine.finalize(startResult.sessionId, {
        win: true,
        score: 100
      });

      // Assert
      expect(result.state).toBe('HALT');
      expect(result.status).toBe('completed');
      expect(result.win).toBe(true);
      expect(result.payout).toBe(entryFee * 2); // 2x payout for win

      // Verify session updated
      const session = await gameEngine.getSession(startResult.sessionId);
      expect(session.status).toBe('completed');
    });

    it('should finalize losing game with zero payout', async () => {
      // Arrange
      const appId = 'test-game';
      const player = testUtils.generateAddress();
      const entryFee = 1000;
      const startResult = await gameEngine.startGame(appId, player, entryFee);

      // Act - Finalize as loss
      const result = await gameEngine.finalize(startResult.sessionId, {
        win: false,
        score: 50
      });

      // Assert
      expect(result.state).toBe('HALT');
      expect(result.status).toBe('completed');
      expect(result.win).toBe(false);
      expect(result.payout).toBe(0); // No payout for loss
    });

    it('should reject finalization of non-existent session', async () => {
      // Act & Assert
      await expect(
        gameEngine.finalize('invalid-session-id', { win: true, score: 100 })
      ).rejects.toThrow(/session not found/i);
    });

    it('should reject double finalization', async () => {
      // Arrange
      const appId = 'test-game';
      const player = testUtils.generateAddress();
      const startResult = await gameEngine.startGame(appId, player, 1000);

      // Act - First finalization
      await gameEngine.finalize(startResult.sessionId, { win: true, score: 100 });

      // Act & Assert - Second finalization should fail
      await expect(
        gameEngine.finalize(startResult.sessionId, { win: false, score: 50 })
      ).rejects.toThrow(/session already completed/i);
    });
  });
});

export { };
