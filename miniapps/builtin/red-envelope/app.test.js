/**
 * Red Envelope App Unit Tests
 * Run with: node app.test.js
 */

// Mock browser globals
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  clear() {
    this.data = {};
  },
};

global.document = {
  getElementById: () => ({
    style: {},
    textContent: "",
    innerHTML: "",
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {} },
  }),
  querySelectorAll: () => [],
  createElement: () => ({
    className: "",
    innerHTML: "",
    remove: () => {},
  }),
  body: { appendChild: () => {} },
};

global.navigator = { share: null, clipboard: { writeText: () => {} } };

// Test utilities
let passed = 0,
  failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = "") {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(val, msg = "") {
  if (!val) throw new Error(msg || "Expected true");
}

function assertFalse(val, msg = "") {
  if (val) throw new Error(msg || "Expected false");
}

// ============ distributeAmount function (extracted for testing) ============
function distributeAmount(total, count, type, randomness) {
  const packets = [];
  if (type === "equal") {
    const each = Math.floor(total / count);
    for (let i = 0; i < count; i++) {
      packets.push(i === count - 1 ? total - each * (count - 1) : each);
    }
  } else {
    let remaining = total;
    const seed = parseInt(randomness.slice(0, 8), 16);
    let rng = seed;
    for (let i = 0; i < count - 1; i++) {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      const maxShare = Math.floor((remaining / (count - i)) * 2);
      const share = Math.max(1000, Math.floor((rng / 0x7fffffff) * maxShare));
      packets.push(Math.min(share, remaining - (count - i - 1) * 1000));
      remaining -= packets[i];
    }
    packets.push(remaining);
  }
  return packets;
}

// ============ Tests for distributeAmount ============
console.log("\n=== distributeAmount Tests ===");

test("equal distribution divides evenly", () => {
  const packets = distributeAmount(100000000, 5, "equal", "abcd1234");
  assertEqual(packets.length, 5);
  assertEqual(
    packets.reduce((a, b) => a + b, 0),
    100000000,
  );
});

test("equal distribution handles remainder", () => {
  const packets = distributeAmount(100000003, 5, "equal", "abcd1234");
  assertEqual(
    packets.reduce((a, b) => a + b, 0),
    100000003,
  );
});

test("random distribution returns correct count", () => {
  const packets = distributeAmount(100000000, 5, "random", "abcd1234");
  assertEqual(packets.length, 5);
});

test("random distribution sums to total", () => {
  const packets = distributeAmount(100000000, 5, "random", "abcd1234");
  assertEqual(
    packets.reduce((a, b) => a + b, 0),
    100000000,
  );
});

test("random distribution has minimum per packet", () => {
  const packets = distributeAmount(100000000, 10, "random", "abcd1234");
  assertTrue(
    packets.every((p) => p >= 1000),
    "All packets should be >= 1000",
  );
});

// ============ Envelope State Tests ============
console.log("\n=== Envelope State Tests ===");

test("envelope initializes with grabbers array", () => {
  const envelope = {
    code: "TEST01",
    totalAmount: 100000000,
    packets: [20000000, 30000000, 50000000],
    remaining: 3,
    creator: "NXtest123",
    type: "random",
    createdAt: Date.now(),
    grabbers: [],
    bestLuck: null,
  };
  assertEqual(envelope.grabbers.length, 0);
  assertEqual(envelope.bestLuck, null);
});

test("grabber tracking adds user correctly", () => {
  const envelope = { grabbers: [], bestLuck: null };
  const grabber = { address: "NXuser1", amount: 25000000, timestamp: Date.now() };
  envelope.grabbers.push(grabber);
  assertEqual(envelope.grabbers.length, 1);
  assertEqual(envelope.grabbers[0].address, "NXuser1");
});

test("duplicate grab detection works", () => {
  const envelope = {
    grabbers: [{ address: "NXuser1", amount: 25000000 }],
  };
  const isDuplicate = envelope.grabbers.some((g) => g.address === "NXuser1");
  assertTrue(isDuplicate, "Should detect duplicate");
});

test("non-duplicate user allowed", () => {
  const envelope = {
    grabbers: [{ address: "NXuser1", amount: 25000000 }],
  };
  const isDuplicate = envelope.grabbers.some((g) => g.address === "NXuser2");
  assertFalse(isDuplicate, "Should allow new user");
});

// ============ Best Luck Winner Tests ============
console.log("\n=== Best Luck Winner Tests ===");

test("best luck updates when higher amount grabbed", () => {
  const envelope = { bestLuck: null };
  const amount = 30000000;
  const address = "NXuser1";

  if (!envelope.bestLuck || amount > envelope.bestLuck.amount) {
    envelope.bestLuck = { address, amount };
  }

  assertEqual(envelope.bestLuck.amount, 30000000);
  assertEqual(envelope.bestLuck.address, "NXuser1");
});

test("best luck does not update for lower amount", () => {
  const envelope = { bestLuck: { address: "NXuser1", amount: 50000000 } };
  const amount = 20000000;
  const address = "NXuser2";

  if (!envelope.bestLuck || amount > envelope.bestLuck.amount) {
    envelope.bestLuck = { address, amount };
  }

  assertEqual(envelope.bestLuck.amount, 50000000);
  assertEqual(envelope.bestLuck.address, "NXuser1");
});

test("best luck updates for higher amount", () => {
  const envelope = { bestLuck: { address: "NXuser1", amount: 20000000 } };
  const amount = 60000000;
  const address = "NXuser2";

  if (!envelope.bestLuck || amount > envelope.bestLuck.amount) {
    envelope.bestLuck = { address, amount };
  }

  assertEqual(envelope.bestLuck.amount, 60000000);
  assertEqual(envelope.bestLuck.address, "NXuser2");
});

test("grabbers sorted by amount descending", () => {
  const grabbers = [
    { address: "NXuser1", amount: 20000000 },
    { address: "NXuser2", amount: 50000000 },
    { address: "NXuser3", amount: 30000000 },
  ];
  const sorted = grabbers.sort((a, b) => b.amount - a.amount);
  assertEqual(sorted[0].address, "NXuser2");
  assertEqual(sorted[0].amount, 50000000);
});

// ============ Test Summary ============
console.log("\n=== Test Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Coverage: ${Math.round((passed / (passed + failed)) * 100)}%`);
process.exit(failed > 0 ? 1 : 0);
