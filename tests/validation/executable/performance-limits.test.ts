/**
 * Executable Performance Limit Tests
 * Priority: P2 - resource bounds and algorithmic complexity validation
 *
 * These are not wall-clock benchmarks; timing assertions would be flaky in CI.
 * They assert the properties that actually break in production: that storage
 * reads per operation stay constant as data grows, that batch operations are
 * bounded, and that unbounded growth is rejected rather than degrading.
 */

import { describe, it, expect, beforeEach } from 'vitest';

const MAX_BATCH_SIZE = 50;
const MAX_ITEMS_PER_APP = 1000;
// Storage prices in datoshi, matching Neo N3 interop service pricing.
// The per-operation cap is deliberately set so that a maximum-size batch fits
// with headroom, while an unbounded scan over a full app dataset does not.
const GAS_PER_READ = 32_768;
const GAS_PER_WRITE = 100_000;
const MAX_GAS_PER_OPERATION = 20_000_000;

function createMockMeteredStore() {
  const data = new Map<string, Map<string, number>>();
  let reads = 0;
  let writes = 0;
  let iterations = 0;

  const scopeFor = (appId: string) => {
    if (!data.has(appId)) data.set(appId, new Map());
    return data.get(appId)!;
  };

  // Gas is metered per invocation on-chain, so these counters are scoped to a
  // single operation. The cumulative reads/writes/iterations meters above are
  // separate and drive the complexity assertions.
  let opReads = 0;
  let opWrites = 0;

  const beginOperation = () => {
    opReads = 0;
    opWrites = 0;
  };

  const countRead = () => {
    reads++;
    opReads++;
  };

  const countWrite = () => {
    writes++;
    opWrites++;
  };

  const chargeGas = () => {
    const gas = opReads * GAS_PER_READ + opWrites * GAS_PER_WRITE;
    if (gas > MAX_GAS_PER_OPERATION) {
      throw new Error(`FAULT: gas limit exceeded (${gas} > ${MAX_GAS_PER_OPERATION})`);
    }
    return gas;
  };

  return {
    resetMeters: () => {
      reads = 0;
      writes = 0;
      iterations = 0;
    },
    getMeters: () => ({ reads, writes, iterations }),

    // O(1): direct keyed lookup, independent of how much data exists
    get: (appId: string, key: string) => {
      beginOperation();
      countRead();
      chargeGas();
      return scopeFor(appId).get(key);
    },

    // O(1): direct keyed write
    put: (appId: string, key: string, value: number) => {
      beginOperation();
      const scope = scopeFor(appId);
      if (!scope.has(key) && scope.size >= MAX_ITEMS_PER_APP) {
        throw new Error('FAULT: per-app item limit reached');
      }
      countRead();
      countWrite();
      chargeGas();
      scope.set(key, value);
      return { state: 'HALT', key, value };
    },

    // Bounded batch: rejects oversized input instead of running out of gas
    putBatch: (appId: string, entries: Array<[string, number]>) => {
      beginOperation();
      if (entries.length === 0) throw new Error('FAULT: empty batch');
      if (entries.length > MAX_BATCH_SIZE) {
        throw new Error(
          `FAULT: batch size ${entries.length} exceeds limit ${MAX_BATCH_SIZE}`,
        );
      }

      const scope = scopeFor(appId);
      const newKeys = entries.filter(([key]) => !scope.has(key)).length;
      if (scope.size + newKeys > MAX_ITEMS_PER_APP) {
        throw new Error('FAULT: batch would exceed per-app item limit');
      }

      for (const [key, value] of entries) {
        iterations++;
        countRead();
        countWrite();
        chargeGas();
        scope.set(key, value);
      }
      return { state: 'HALT', written: entries.length };
    },

    // Paginated scan: work is bounded by page size, not by total item count
    scanPage: (appId: string, offset: number, limit: number) => {
      beginOperation();
      if (limit <= 0 || limit > MAX_BATCH_SIZE) {
        throw new Error('FAULT: page size out of range');
      }
      if (offset < 0) throw new Error('FAULT: negative offset');

      const keys = [...scopeFor(appId).keys()].sort();
      const page = keys.slice(offset, offset + limit);
      for (const _key of page) {
        iterations++;
        countRead();
      }
      chargeGas();
      return {
        state: 'HALT',
        items: page,
        nextOffset: offset + page.length < keys.length ? offset + page.length : null,
      };
    },

    itemCount: (appId: string) => scopeFor(appId).size,
  };
}

describe('Performance Limits - Executable', () => {
  let store: ReturnType<typeof createMockMeteredStore>;

  beforeEach(() => {
    store = createMockMeteredStore();
  });

  describe('Constant-Time Access', () => {
    it('should read with a constant storage cost regardless of dataset size', () => {
      // Arrange - two datasets differing by two orders of magnitude
      for (let i = 0; i < 10; i++) store.put('small', `k${i}`, i);
      for (let i = 0; i < 900; i++) store.put('large', `k${i}`, i);

      // Act
      store.resetMeters();
      store.get('small', 'k5');
      const smallReads = store.getMeters().reads;

      store.resetMeters();
      store.get('large', 'k500');
      const largeReads = store.getMeters().reads;

      // Assert
      expect(smallReads).toBe(1);
      expect(largeReads).toBe(1);
    });

    it('should write with a constant storage cost regardless of dataset size', () => {
      // Arrange
      for (let i = 0; i < 900; i++) store.put('large', `k${i}`, i);

      // Act
      store.resetMeters();
      store.put('large', 'new-key', 1);

      // Assert - one existence read plus one write
      expect(store.getMeters()).toMatchObject({ reads: 1, writes: 1 });
    });

    it('should keep a single read well within the per-operation gas limit', () => {
      // Arrange
      store.put('game', 'k', 1);
      store.resetMeters();

      // Act & Assert
      expect(() => store.get('game', 'k')).not.toThrow();
      expect(store.getMeters().reads * GAS_PER_READ).toBeLessThan(MAX_GAS_PER_OPERATION);
    });
  });

  describe('Batch Bounds', () => {
    it('should accept a batch at the maximum size', () => {
      // Arrange
      const entries: Array<[string, number]> = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => [
        `k${i}`,
        i,
      ]);

      // Act
      const result = store.putBatch('game', entries);

      // Assert
      expect(result.written).toBe(MAX_BATCH_SIZE);
      expect(store.itemCount('game')).toBe(MAX_BATCH_SIZE);
    });

    it('should reject a batch one over the maximum size', () => {
      // Arrange
      const entries: Array<[string, number]> = Array.from(
        { length: MAX_BATCH_SIZE + 1 },
        (_, i) => [`k${i}`, i],
      );

      // Act & Assert
      expect(() => store.putBatch('game', entries)).toThrow(/exceeds limit/i);
      expect(store.itemCount('game')).toBe(0);
    });

    it('should reject an empty batch', () => {
      // Act & Assert
      expect(() => store.putBatch('game', [])).toThrow(/empty batch/i);
    });

    it('should scale batch work linearly with batch size, not dataset size', () => {
      // Arrange - preload a large dataset
      for (let i = 0; i < 500; i++) store.put('game', `pre${i}`, i);
      const entries: Array<[string, number]> = Array.from({ length: 10 }, (_, i) => [
        `new${i}`,
        i,
      ]);

      // Act
      store.resetMeters();
      store.putBatch('game', entries);

      // Assert - exactly one iteration per entry
      expect(store.getMeters().iterations).toBe(10);
    });

    it('should stay within the gas limit for a maximum-size batch', () => {
      // Arrange
      const entries: Array<[string, number]> = Array.from({ length: MAX_BATCH_SIZE }, (_, i) => [
        `k${i}`,
        i,
      ]);
      store.resetMeters();

      // Act & Assert - the batch limit exists to keep gas under the cap
      expect(() => store.putBatch('game', entries)).not.toThrow();
      const { reads, writes } = store.getMeters();
      expect(reads * GAS_PER_READ + writes * GAS_PER_WRITE).toBeLessThanOrEqual(
        MAX_GAS_PER_OPERATION,
      );
    });

    it('should keep the batch limit small enough that a full batch fits in gas', () => {
      // Arrange - the cost the contract would pay for a maximum-size batch
      const worstCaseBatchGas = MAX_BATCH_SIZE * (GAS_PER_READ + GAS_PER_WRITE);

      // Act - the cost of touching an entire app dataset unbounded
      const unboundedScanGas = MAX_ITEMS_PER_APP * GAS_PER_READ;

      // Assert - the limit is what keeps operations executable
      expect(worstCaseBatchGas).toBeLessThanOrEqual(MAX_GAS_PER_OPERATION);
      expect(unboundedScanGas).toBeGreaterThan(MAX_GAS_PER_OPERATION);
    });
  });

  describe('Pagination', () => {
    it('should bound scan work by page size, not total items', () => {
      // Arrange
      for (let i = 0; i < 400; i++) store.put('game', `k${String(i).padStart(3, '0')}`, i);

      // Act
      store.resetMeters();
      const page = store.scanPage('game', 0, 20);

      // Assert
      expect(page.items).toHaveLength(20);
      expect(store.getMeters().iterations).toBe(20);
    });

    it('should signal the end of the dataset with a null next offset', () => {
      // Arrange
      for (let i = 0; i < 30; i++) store.put('game', `k${String(i).padStart(2, '0')}`, i);

      // Act
      const first = store.scanPage('game', 0, 20);
      const second = store.scanPage('game', first.nextOffset!, 20);

      // Assert
      expect(first.nextOffset).toBe(20);
      expect(second.items).toHaveLength(10);
      expect(second.nextOffset).toBeNull();
    });

    it('should reject a page size above the batch limit', () => {
      // Act & Assert
      expect(() => store.scanPage('game', 0, MAX_BATCH_SIZE + 1)).toThrow(
        /page size out of range/i,
      );
    });

    it('should reject a non-positive page size', () => {
      // Act & Assert
      expect(() => store.scanPage('game', 0, 0)).toThrow(/page size out of range/i);
    });

    it('should reject a negative offset', () => {
      // Act & Assert
      expect(() => store.scanPage('game', -1, 10)).toThrow(/negative offset/i);
    });

    it('should return an empty page past the end without faulting', () => {
      // Arrange
      for (let i = 0; i < 5; i++) store.put('game', `k${i}`, i);

      // Act
      const page = store.scanPage('game', 100, 10);

      // Assert
      expect(page.items).toHaveLength(0);
      expect(page.nextOffset).toBeNull();
    });

    it('should cover every item exactly once across full pagination', () => {
      // Arrange
      const total = 137;
      for (let i = 0; i < total; i++) {
        store.put('game', `k${String(i).padStart(3, '0')}`, i);
      }

      // Act - walk every page
      const seen: string[] = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page = store.scanPage('game', offset, 25);
        seen.push(...page.items);
        offset = page.nextOffset;
      }

      // Assert - no gaps, no duplicates
      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(total);
    });
  });

  describe('Growth Bounds', () => {
    it('should accept items up to the per-app limit', () => {
      // Arrange & Act
      for (let i = 0; i < MAX_ITEMS_PER_APP; i++) {
        store.put('game', `k${i}`, i);
      }

      // Assert
      expect(store.itemCount('game')).toBe(MAX_ITEMS_PER_APP);
    });

    it('should reject a new item past the per-app limit', () => {
      // Arrange
      for (let i = 0; i < MAX_ITEMS_PER_APP; i++) store.put('game', `k${i}`, i);

      // Act & Assert
      expect(() => store.put('game', 'overflow', 1)).toThrow(/item limit reached/i);
      expect(store.itemCount('game')).toBe(MAX_ITEMS_PER_APP);
    });

    it('should still allow updating an existing item at the limit', () => {
      // Arrange
      for (let i = 0; i < MAX_ITEMS_PER_APP; i++) store.put('game', `k${i}`, i);

      // Act - overwrite rather than insert
      store.put('game', 'k0', 999);

      // Assert
      expect(store.get('game', 'k0')).toBe(999);
      expect(store.itemCount('game')).toBe(MAX_ITEMS_PER_APP);
    });

    it('should reject a batch that would cross the per-app limit', () => {
      // Arrange - leave room for 10 more items
      for (let i = 0; i < MAX_ITEMS_PER_APP - 10; i++) store.put('game', `k${i}`, i);
      const entries: Array<[string, number]> = Array.from({ length: 20 }, (_, i) => [
        `new${i}`,
        i,
      ]);

      // Act & Assert - rejected wholesale, not partially applied
      expect(() => store.putBatch('game', entries)).toThrow(/exceed per-app item limit/i);
      expect(store.itemCount('game')).toBe(MAX_ITEMS_PER_APP - 10);
    });

    it('should apply growth limits per app independently', () => {
      // Arrange - saturate one app
      for (let i = 0; i < MAX_ITEMS_PER_APP; i++) store.put('game-a', `k${i}`, i);

      // Act & Assert
      expect(() => store.put('game-b', 'k0', 1)).not.toThrow();
      expect(store.itemCount('game-b')).toBe(1);
    });
  });
});

export { };
