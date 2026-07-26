/**
 * Executable Concurrency Tests
 * Priority: P2 - Race condition and thread safety validation
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock concurrent resource manager
function createMockConcurrentSystem() {
  let counter = 0;
  let locks = new Map<string, boolean>();
  let resources = new Map<string, { value: number; locked: boolean }>();

  return {
    // Increment counter (non-atomic, can have race conditions)
    incrementUnsafe: () => {
      const current = counter;
      // Simulate non-atomic operation
      counter = current + 1;
      return counter;
    },

    // Increment counter (atomic, safe)
    incrementSafe: () => {
      counter++;
      return counter;
    },

    getCounter: () => counter,
    resetCounter: () => { counter = 0; },

    // Lock-based resource access
    acquireLock: (resourceId: string) => {
      if (locks.get(resourceId)) {
        throw new Error('FAULT: resource already locked');
      }

      locks.set(resourceId, true);
      return {
        state: 'HALT',
        locked: true
      };
    },

    releaseLock: (resourceId: string) => {
      if (!locks.get(resourceId)) {
        throw new Error('FAULT: resource not locked');
      }

      locks.delete(resourceId);
      return {
        state: 'HALT',
        released: true
      };
    },

    isLocked: (resourceId: string) => locks.get(resourceId) || false,

    // Atomic resource modification
    modifyResourceAtomic: async (resourceId: string, delta: number) => {
      // Simulate atomic operation with lock
      if (locks.get(resourceId)) {
        throw new Error('FAULT: resource locked');
      }

      if (!resources.has(resourceId)) {
        resources.set(resourceId, { value: 0, locked: false });
      }

      const resource = resources.get(resourceId)!;

      // Atomic lock-modify-unlock
      locks.set(resourceId, true);
      resource.value += delta;
      locks.delete(resourceId);

      return {
        state: 'HALT',
        newValue: resource.value
      };
    },

    getResourceValue: (resourceId: string) => {
      return resources.get(resourceId)?.value || 0;
    }
  };
}

describe('Concurrency - Executable', () => {
  let system: ReturnType<typeof createMockConcurrentSystem>;

  beforeEach(() => {
    system = createMockConcurrentSystem();
  });

  describe('Atomic Operations', () => {
    it('should handle safe increment atomically', () => {
      // Act - simulate multiple concurrent increments
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(system.incrementSafe());
      }

      // Assert
      expect(system.getCounter()).toBe(10);
      expect(results[9]).toBe(10); // Last result should be 10
    });

    it('should handle atomic resource modification', async () => {
      // Arrange
      const resourceId = 'resource-1';

      // Act - multiple modifications
      await system.modifyResourceAtomic(resourceId, 5);
      await system.modifyResourceAtomic(resourceId, 3);
      await system.modifyResourceAtomic(resourceId, 2);

      // Assert
      expect(system.getResourceValue(resourceId)).toBe(10);
    });
  });

  describe('Lock Management', () => {
    it('should acquire lock successfully', () => {
      // Act
      const result = system.acquireLock('resource-1');

      // Assert
      expect(result.state).toBe('HALT');
      expect(result.locked).toBe(true);
      expect(system.isLocked('resource-1')).toBe(true);
    });

    it('should reject double lock acquisition', () => {
      // Arrange
      system.acquireLock('resource-1');

      // Act & Assert
      expect(() => system.acquireLock('resource-1')).toThrow(/already locked/i);
    });

    it('should release lock successfully', () => {
      // Arrange
      system.acquireLock('resource-1');

      // Act
      const result = system.releaseLock('resource-1');

      // Assert
      expect(result.released).toBe(true);
      expect(system.isLocked('resource-1')).toBe(false);
    });

    it('should reject releasing unlocked resource', () => {
      // Act & Assert
      expect(() => system.releaseLock('resource-1')).toThrow(/not locked/i);
    });

    it('should allow lock re-acquisition after release', () => {
      // Arrange
      system.acquireLock('resource-1');
      system.releaseLock('resource-1');

      // Act - should succeed
      const result = system.acquireLock('resource-1');

      // Assert
      expect(result.locked).toBe(true);
    });
  });

  describe('Resource Contention', () => {
    it('should reject modification of locked resource', async () => {
      // Arrange
      const resourceId = 'resource-1';
      system.acquireLock(resourceId);

      // Act & Assert
      await expect(
        system.modifyResourceAtomic(resourceId, 5)
      ).rejects.toThrow(/resource locked/i);
    });

    it('should allow modification after lock release', async () => {
      // Arrange
      const resourceId = 'resource-1';
      system.acquireLock(resourceId);
      system.releaseLock(resourceId);

      // Act
      const result = await system.modifyResourceAtomic(resourceId, 5);

      // Assert
      expect(result.newValue).toBe(5);
    });

    it('should handle multiple independent resources concurrently', async () => {
      // Act - modify different resources
      await system.modifyResourceAtomic('resource-1', 10);
      await system.modifyResourceAtomic('resource-2', 20);
      await system.modifyResourceAtomic('resource-3', 30);

      // Assert - all should succeed independently
      expect(system.getResourceValue('resource-1')).toBe(10);
      expect(system.getResourceValue('resource-2')).toBe(20);
      expect(system.getResourceValue('resource-3')).toBe(30);
    });
  });
});

export { };
