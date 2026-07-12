import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isPendingTimeCapsuleOperation } from "./src/time-capsule-safety";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)));
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

function luminance(hex: string): number {
  const channels = hex.replace("#", "").match(/.{2}/g)!.map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

describe("Time Capsule production closure", () => {
  it("suppresses the generic seven-parameter operation form", () => {
    const manifest = JSON.parse(source("neo-manifest.json")) as {
      version: string;
      permissions: string[];
      operation_panel: { operations: unknown[] };
      features: { stateless: boolean };
    };
    expect(manifest.version).toBe("1.1.0");
    expect(manifest.permissions).toContain("write:blockchain");
    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.features.stateless).toBe(false);
  });

  it("binds reads and writes to the canonical network contract", () => {
    const safety = source("src/time-capsule-safety.ts");
    expect(safety).toContain("getMiniAppContractHash");
    expect(safety).toContain("detectNetwork");
    expect(safety).toContain("configured !== expected");
    expect(safety).toContain("getapplicationlog");
  });

  it("persists exact transaction recovery and never uses the unsupported live fish-revenue API", () => {
    const logic = source("src/composables/useTimeCapsule.ts");
    const main = source("src/main.tsx");
    expect(logic).toContain("pendingOperation");
    expect(logic).toContain("result.verified === true && result.event");
    expect(logic).toContain("transactionReadbackMismatch");
    expect(logic).toContain("assertRecoveryStorage");
    expect(logic).toContain("PENDING_DURABLE_STORE_KEY");
    expect(logic).toContain("recoveryStorageUnavailableAfterBroadcast");
    expect(logic).not.toContain('"withdrawFishRevenue"');
    expect(main).not.toContain('"withdrawFishRevenue"');
  });

  it("accepts only an exact Neo transaction hash in a recovery record", () => {
    const pending = {
      version: 1,
      kind: "create",
      stage: "action",
      eventName: "Buried",
      network: "testnet",
      contractHash: "0x3e88058ef32c4d8d17eb1a2188d6d5e329c94f8a",
      actorHash: `0x${"11".repeat(20)}`,
      txid: `0x${"ab".repeat(32)}`,
      createdAt: Date.now(),
      amountFixed8: "20000000",
      contentHash: "cd".repeat(32),
      durationSeconds: 86_400,
      isPublic: false,
      category: 1,
      title: "Future note",
    } as const;

    expect(isPendingTimeCapsuleOperation(pending)).toBe(true);
    expect(isPendingTimeCapsuleOperation({ ...pending, txid: `0x${"ab".repeat(8)}` })).toBe(false);
    expect(isPendingTimeCapsuleOperation({ ...pending, txid: `0x${"ab".repeat(33)}` })).toBe(false);
  });

  it("uses actual transaction lifecycle state instead of a fake completion timer", () => {
    const playArea = source("src/PlayArea.tsx");
    expect(playArea).not.toContain("setTimeout(");
    expect(playArea).not.toContain("createPreview");
    expect(playArea).toContain("const isSealing = isCreating");
    expect(playArea).toContain('category="social"');
  });

  it("describes public capsules as discoverable, not publicly revealable", () => {
    const messages = source("src/locale/messages.ts");
    expect(messages).toContain("Others can tip; only you can reveal");
    expect(messages).not.toContain("Anyone can reveal after unlock");
  });

  it("keeps primary text and action colors above WCAG AA contrast", () => {
    expect(contrast("#173a38", "#fffaf0")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#0c665e", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#5f7470", "#fffaf3")).toBeGreaterThanOrEqual(4.5);
  });
});
