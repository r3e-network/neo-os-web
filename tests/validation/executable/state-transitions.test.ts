/**
 * Executable State Transition Tests
 * Priority: P1 - Lifecycle guard validation
 *
 * Verifies that entities only move between legal states, that terminal
 * states are truly terminal, and that operations gated on a state are
 * rejected outside it.
 */

import { describe, it, expect, beforeEach } from 'vitest';

type AppState = 'unregistered' | 'registered' | 'active' | 'paused' | 'retired';

const LEGAL_APP_TRANSITIONS: Record<AppState, AppState[]> = {
  unregistered: ['registered'],
  registered: ['active', 'retired'],
  active: ['paused', 'retired'],
  paused: ['active', 'retired'],
  retired: [],
};

type SessionState = 'open' | 'awaiting-oracle' | 'finalized' | 'refunded';

const LEGAL_SESSION_TRANSITIONS: Record<SessionState, SessionState[]> = {
  open: ['awaiting-oracle', 'refunded'],
  'awaiting-oracle': ['finalized', 'refunded'],
  finalized: [],
  refunded: [],
};

function createMockStateMachine() {
  const apps = new Map<string, AppState>();
  const sessions = new Map<string, SessionState>();

  const transitionApp = (appId: string, next: AppState) => {
    const current = apps.get(appId) ?? 'unregistered';

    if (!LEGAL_APP_TRANSITIONS[current].includes(next)) {
      throw new Error(`FAULT: illegal transition ${current} -> ${next}`);
    }

    apps.set(appId, next);
    return { state: 'HALT', appState: next };
  };

  const transitionSession = (sessionId: string, next: SessionState) => {
    const current = sessions.get(sessionId);
    if (!current) {
      throw new Error('FAULT: session not found');
    }

    if (!LEGAL_SESSION_TRANSITIONS[current].includes(next)) {
      throw new Error(`FAULT: illegal transition ${current} -> ${next}`);
    }

    sessions.set(sessionId, next);
    return { state: 'HALT', sessionState: next };
  };

  return {
    transitionApp,
    getAppState: (appId: string): AppState => apps.get(appId) ?? 'unregistered',

    openSession: (sessionId: string) => {
      if (sessions.has(sessionId)) {
        throw new Error('FAULT: session already exists');
      }
      sessions.set(sessionId, 'open');
      return { state: 'HALT', sessionState: 'open' as SessionState };
    },
    transitionSession,
    getSessionState: (sessionId: string) => sessions.get(sessionId),

    // Operation gated on app being active
    submitPlay: (appId: string, sessionId: string) => {
      const appState = apps.get(appId) ?? 'unregistered';
      if (appState !== 'active') {
        throw new Error(`FAULT: app not active (state: ${appState})`);
      }

      const sessionState = sessions.get(sessionId);
      if (sessionState !== 'open') {
        throw new Error(`FAULT: session not open (state: ${sessionState})`);
      }

      sessions.set(sessionId, 'awaiting-oracle');
      return { state: 'HALT', accepted: true };
    },
  };
}

describe('State Transitions - Executable', () => {
  let sm: ReturnType<typeof createMockStateMachine>;

  beforeEach(() => {
    sm = createMockStateMachine();
  });

  describe('App Lifecycle', () => {
    it('should follow the full legal lifecycle path', () => {
      // Act & Assert - each hop is legal
      expect(sm.transitionApp('app', 'registered').appState).toBe('registered');
      expect(sm.transitionApp('app', 'active').appState).toBe('active');
      expect(sm.transitionApp('app', 'paused').appState).toBe('paused');
      expect(sm.transitionApp('app', 'active').appState).toBe('active');
      expect(sm.transitionApp('app', 'retired').appState).toBe('retired');
    });

    it('should reject skipping registration', () => {
      // Act & Assert - unregistered cannot jump straight to active
      expect(() => sm.transitionApp('app', 'active')).toThrow(
        /illegal transition unregistered -> active/i,
      );
    });

    it('should reject reviving a retired app', () => {
      // Arrange
      sm.transitionApp('app', 'registered');
      sm.transitionApp('app', 'retired');

      // Act & Assert - retired is terminal
      expect(() => sm.transitionApp('app', 'active')).toThrow(
        /illegal transition retired -> active/i,
      );
      expect(() => sm.transitionApp('app', 'registered')).toThrow(
        /illegal transition retired -> registered/i,
      );
    });

    it('should reject pausing an app that was never activated', () => {
      // Arrange
      sm.transitionApp('app', 'registered');

      // Act & Assert
      expect(() => sm.transitionApp('app', 'paused')).toThrow(
        /illegal transition registered -> paused/i,
      );
    });

    it('should keep state unchanged after a rejected transition', () => {
      // Arrange
      sm.transitionApp('app', 'registered');

      // Act - illegal hop
      expect(() => sm.transitionApp('app', 'paused')).toThrow();

      // Assert - no partial mutation
      expect(sm.getAppState('app')).toBe('registered');
    });
  });

  describe('Session Lifecycle', () => {
    it('should move open -> awaiting-oracle -> finalized', () => {
      // Arrange
      sm.openSession('s1');

      // Act & Assert
      expect(sm.transitionSession('s1', 'awaiting-oracle').sessionState).toBe(
        'awaiting-oracle',
      );
      expect(sm.transitionSession('s1', 'finalized').sessionState).toBe('finalized');
    });

    it('should allow refund from open and from awaiting-oracle', () => {
      // Arrange
      sm.openSession('s1');
      sm.openSession('s2');
      sm.transitionSession('s2', 'awaiting-oracle');

      // Act & Assert
      expect(sm.transitionSession('s1', 'refunded').sessionState).toBe('refunded');
      expect(sm.transitionSession('s2', 'refunded').sessionState).toBe('refunded');
    });

    it('should reject finalizing directly from open', () => {
      // Arrange
      sm.openSession('s1');

      // Act & Assert - oracle step cannot be skipped
      expect(() => sm.transitionSession('s1', 'finalized')).toThrow(
        /illegal transition open -> finalized/i,
      );
    });

    it('should treat finalized as terminal', () => {
      // Arrange
      sm.openSession('s1');
      sm.transitionSession('s1', 'awaiting-oracle');
      sm.transitionSession('s1', 'finalized');

      // Act & Assert
      expect(() => sm.transitionSession('s1', 'refunded')).toThrow(
        /illegal transition finalized -> refunded/i,
      );
    });

    it('should treat refunded as terminal', () => {
      // Arrange
      sm.openSession('s1');
      sm.transitionSession('s1', 'refunded');

      // Act & Assert
      expect(() => sm.transitionSession('s1', 'finalized')).toThrow(
        /illegal transition refunded -> finalized/i,
      );
    });

    it('should reject duplicate session creation', () => {
      // Arrange
      sm.openSession('s1');

      // Act & Assert
      expect(() => sm.openSession('s1')).toThrow(/already exists/i);
    });

    it('should reject transitions on unknown sessions', () => {
      // Act & Assert
      expect(() => sm.transitionSession('missing', 'finalized')).toThrow(
        /session not found/i,
      );
    });
  });

  describe('State-Gated Operations', () => {
    it('should accept play when app is active and session open', () => {
      // Arrange
      sm.transitionApp('app', 'registered');
      sm.transitionApp('app', 'active');
      sm.openSession('s1');

      // Act
      const result = sm.submitPlay('app', 's1');

      // Assert
      expect(result.accepted).toBe(true);
      expect(sm.getSessionState('s1')).toBe('awaiting-oracle');
    });

    it('should reject play while app is paused', () => {
      // Arrange
      sm.transitionApp('app', 'registered');
      sm.transitionApp('app', 'active');
      sm.transitionApp('app', 'paused');
      sm.openSession('s1');

      // Act & Assert
      expect(() => sm.submitPlay('app', 's1')).toThrow(/app not active \(state: paused\)/i);

      // Session untouched
      expect(sm.getSessionState('s1')).toBe('open');
    });

    it('should reject play on an already-finalized session', () => {
      // Arrange
      sm.transitionApp('app', 'registered');
      sm.transitionApp('app', 'active');
      sm.openSession('s1');
      sm.transitionSession('s1', 'awaiting-oracle');
      sm.transitionSession('s1', 'finalized');

      // Act & Assert
      expect(() => sm.submitPlay('app', 's1')).toThrow(
        /session not open \(state: finalized\)/i,
      );
    });
  });
});

export { };
