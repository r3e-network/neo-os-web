import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

import type { MiniAppFramework } from "../../shared/react";
import { createObservable } from "../react/context";
import { useConverter } from "../../neo-convert/src/composables/useConverter";
import { useNeoConvert } from "../../neo-convert/src/composables/useNeoConvert";
import {
  MAX_SCRIPT_BYTES,
  MAX_SOURCE_CHARS,
  convertPrivateKeyToWif,
  convertPublicKeyToAddress,
  getPrivateKeyFromWIF,
  getPublicKey,
  isOversizedHexScript,
  validateHexScript,
  validatePrivateKey,
  validatePublicKey,
  validateWif,
} from "../../neo-convert/src/services/neo";

const disposables: Array<() => void> = [];

afterEach(() => {
  while (disposables.length > 0) disposables.pop()?.();
});

function converterWithCopy(copy: (text: string) => Promise<boolean>) {
  const converter = useConverter(
    (key) => key,
    { copy } as MiniAppFramework["clipboard"],
  );
  disposables.push(converter.dispose);
  return converter;
}

describe("neo-convert production invariants", () => {
  it("matches a deterministic Neo N3 private-key conversion vector", () => {
    const privateKey = `${"0".repeat(63)}1`;
    const expectedWif = "KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn";
    const expectedPublicKey = "036b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296";
    const expectedAddress = "NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK";

    expect(convertPrivateKeyToWif(privateKey)).toBe(expectedWif);
    expect(getPrivateKeyFromWIF(expectedWif)).toBe(privateKey);
    expect(getPublicKey(privateKey)).toBe(expectedPublicKey);
    expect(convertPublicKeyToAddress(expectedPublicKey)).toBe(expectedAddress);
    expect(validateWif(expectedWif)).toBe(true);
  });

  it("rejects out-of-range private scalars and malformed compressed public keys", () => {
    expect(validatePrivateKey("0".repeat(64))).toBe(false);
    expect(validatePrivateKey("f".repeat(64))).toBe(false);
    expect(validatePublicKey(`03${"ff".repeat(32)}`)).toBe(false);
    expect(validatePublicKey(`04${"00".repeat(64)}`)).toBe(false);
    expect(() => convertPrivateKeyToWif("0".repeat(64))).toThrow();
    expect(() => convertPublicKeyToAddress(`03${"ff".repeat(32)}`)).toThrow();
  });

  it("invalidates an old result as soon as the source changes", () => {
    const converter = converterWithCopy(vi.fn().mockResolvedValue(true));
    converter.inputKey.set(`${"0".repeat(63)}1`);
    converter.detectAndConvert();
    expect(converter.result.get().address).toBe("NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK");

    converter.inputKey.set("new-source");
    expect(converter.result.get().address).toBe("");
    expect(converter.result.get().privateKey).toBe("");
    expect(converter.statusMsg.get()).toBe("");
  });

  it("reports clipboard rejection instead of showing false copy success", async () => {
    const copy = vi.fn().mockResolvedValue(false);
    const converter = converterWithCopy(copy);

    await expect(converter.copy("explicit-secret-copy")).resolves.toBe(false);
    expect(copy).toHaveBeenCalledWith("explicit-secret-copy", {
      successKey: "copied",
      errorKey: "copyFailed",
    });
    expect(converter.copyStatus.get()).toBe("copyFailed");
    expect(converter.copyStatusType.get()).toBe("error");
  });

  it("rejects truncated and oversized NeoVM scripts with recoverable status", () => {
    const converter = converterWithCopy(vi.fn().mockResolvedValue(true));
    converter.inputKey.set("0c040102");
    converter.detectAndConvert();
    expect(converter.statusMsg.get()).toBe("invalidScript");
    expect(converter.statusType.get()).toBe("error");
    expect(converter.result.get().opcodes).toEqual([]);

    const oversized = "21".repeat(MAX_SCRIPT_BYTES + 1);
    expect(isOversizedHexScript(oversized)).toBe(true);
    expect(validateHexScript(oversized)).toBe(false);
    converter.inputKey.set(oversized);
    converter.detectAndConvert();
    expect(converter.statusMsg.get()).toBe("scriptTooLarge");
    expect(converter.statusType.get()).toBe("error");
  });

  it("bounds an oversized non-hex source before format detection", () => {
    const converter = converterWithCopy(vi.fn().mockResolvedValue(true));
    converter.inputKey.set("x".repeat(MAX_SOURCE_CHARS + 1));
    converter.detectAndConvert();
    expect(converter.statusMsg.get()).toBe("sourceTooLarge");
    expect(converter.statusType.get()).toBe("error");
    expect(converter.result.get()).toEqual({
      address: "",
      publicKey: "",
      wif: "",
      privateKey: "",
      opcodes: [],
      scriptHash: "",
      scriptHashLE: "",
    });
  });

  it("reset clears source, derived secrets, result status, and copy feedback", async () => {
    const converter = converterWithCopy(vi.fn().mockResolvedValue(true));
    converter.inputKey.set(`${"0".repeat(63)}1`);
    converter.detectAndConvert();
    await converter.copy("explicit-copy");

    converter.reset();
    expect(converter.inputKey.get()).toBe("");
    expect(converter.result.get()).toEqual({
      address: "",
      publicKey: "",
      wif: "",
      privateKey: "",
      opcodes: [],
      scriptHash: "",
      scriptHashLE: "",
    });
    expect(converter.statusMsg.get()).toBe("");
    expect(converter.copyStatus.get()).toBe("");
  });

  it("formats optional wallet balances from exact raw base units", async () => {
    const address = createObservable<string | null>("NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK");
    const raw = vi.fn(async (asset: string) => asset === "NEO" ? 9_007_199_254_740_993n : 123_456_789n);
    const app = {
      clipboard: { copy: vi.fn().mockResolvedValue(true) },
      wallet: {
        address: () => address.get(),
        isConnected: () => Boolean(address.get()),
        observe: () => address,
        raw,
        observeBalance: () => ({ balance: createObservable("0"), refresh: vi.fn(), cleanup: vi.fn() }),
      },
    } as unknown as MiniAppFramework;
    const neoConvert = useNeoConvert({ app, t: (key) => key });
    disposables.push(neoConvert.destroy);

    await neoConvert.loadAll();
    expect(raw).toHaveBeenCalledWith("NEO", address.get());
    expect(raw).toHaveBeenCalledWith("GAS", address.get());
    expect(neoConvert.formattedNeoBalance.get()).toBe("9007199254740993 NEO");
    expect(neoConvert.formattedGasBalance.get()).toBe("1.23456789 GAS");
  });

  it("discards a balance response when the wallet changes during the read", async () => {
    let currentAddress: string | null = "NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK";
    const address = createObservable<string | null>(currentAddress);
    const pending = new Map<string, (value: bigint) => void>();
    const raw = vi.fn((asset: string) => new Promise<bigint>((resolve) => pending.set(asset, resolve)));
    const app = {
      clipboard: { copy: vi.fn().mockResolvedValue(true) },
      wallet: {
        address: () => currentAddress,
        isConnected: () => Boolean(currentAddress),
        observe: () => address,
        raw,
        observeBalance: () => ({ balance: createObservable("0"), refresh: vi.fn(), cleanup: vi.fn() }),
      },
    } as unknown as MiniAppFramework;
    const neoConvert = useNeoConvert({ app, t: (key) => key });
    disposables.push(neoConvert.destroy);

    const load = neoConvert.loadAll();
    await vi.waitFor(() => expect(pending.size).toBe(2));
    currentAddress = "NfVbFMwE7XyPYDUNdGtyEKWvLGs3z1hP6W";
    pending.get("NEO")?.(10n);
    pending.get("GAS")?.(200_000_000n);
    await load;
    expect(neoConvert.formattedNeoBalance.get()).toBe("—");
    expect(neoConvert.formattedGasBalance.get()).toBe("—");
    expect(neoConvert.balanceStatus.get()).toBe("idle");
  });

  it("clears the old wallet snapshot immediately when the connected address changes", async () => {
    const firstAddress = "NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK";
    const secondAddress = "NfVbFMwE7XyPYDUNdGtyEKWvLGs3z1hP6W";
    const address = createObservable<string | null>(firstAddress);
    let currentAddress: string | null = firstAddress;
    const pending: Array<(value: bigint) => void> = [];
    const raw = vi.fn(async (asset: string) => asset === "NEO" ? 7n : 125_000_000n);
    const app = {
      clipboard: { copy: vi.fn().mockResolvedValue(true) },
      wallet: {
        address: () => currentAddress,
        isConnected: () => Boolean(currentAddress),
        observe: () => address,
        raw,
        observeBalance: () => ({ balance: createObservable("0"), refresh: vi.fn(), cleanup: vi.fn() }),
      },
    } as unknown as MiniAppFramework;
    const neoConvert = useNeoConvert({ app, t: (key) => key });
    disposables.push(neoConvert.destroy);

    await neoConvert.loadAll();
    expect(neoConvert.formattedNeoBalance.get()).toBe("7 NEO");
    expect(neoConvert.formattedGasBalance.get()).toBe("1.25 GAS");

    raw.mockImplementation(() => new Promise<bigint>((resolve) => pending.push(resolve)));
    currentAddress = secondAddress;
    address.set(secondAddress);

    expect(neoConvert.formattedNeoBalance.get()).toBe("—");
    expect(neoConvert.formattedGasBalance.get()).toBe("—");
    expect(neoConvert.balanceStatus.get()).toBe("loading");

    pending.forEach((resolve, index) => resolve(index === 0 ? 3n : 50_000_000n));
    await vi.waitFor(() => expect(neoConvert.balanceStatus.get()).toBe("ready"));
    expect(neoConvert.formattedNeoBalance.get()).toBe("3 NEO");
    expect(neoConvert.formattedGasBalance.get()).toBe("0.5 GAS");
  });

  it("marks a failed optional balance read unavailable and recovers on retry", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const address = createObservable<string | null>("NVHt5YtAnadMwntAVAJLUy36M2nLYKHUeK");
    const raw = vi.fn().mockRejectedValueOnce(new Error("rpc unavailable"));
    const app = {
      clipboard: { copy: vi.fn().mockResolvedValue(true) },
      wallet: {
        address: () => address.get(),
        isConnected: () => true,
        observe: () => address,
        raw,
        observeBalance: () => ({ balance: createObservable("0"), refresh: vi.fn(), cleanup: vi.fn() }),
      },
    } as unknown as MiniAppFramework;
    const neoConvert = useNeoConvert({ app, t: (key) => key });
    disposables.push(neoConvert.destroy);

    await neoConvert.loadAll();
    expect(neoConvert.balanceStatus.get()).toBe("error");
    expect(neoConvert.formattedNeoBalance.get()).toBe("—");
    expect(neoConvert.formattedGasBalance.get()).toBe("—");

    raw.mockImplementation(async (asset: string) => asset === "NEO" ? 4n : 250_000_000n);
    await neoConvert.loadAll();
    expect(neoConvert.balanceStatus.get()).toBe("ready");
    expect(neoConvert.formattedNeoBalance.get()).toBe("4 NEO");
    expect(neoConvert.formattedGasBalance.get()).toBe("2.5 GAS");
    warn.mockRestore();
  });

  it("keeps the manifest, storage boundary, artwork, and documentation aligned", () => {
    const root = `${process.cwd()}/../neo-convert`;
    const manifest = JSON.parse(fs.readFileSync(`${root}/neo-manifest.json`, "utf8"));
    const converterSource = fs.readFileSync(`${root}/src/composables/useConverter.ts`, "utf8");
    const appSource = fs.readFileSync(`${root}/src/composables/useNeoConvert.ts`, "utf8");
    const playArea = fs.readFileSync(`${root}/src/PlayArea.tsx`, "utf8");
    const uiManifest = fs.readFileSync(`${root}/src/manifest.ts`, "utf8");

    expect(manifest.contracts).toEqual({});
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest).not.toHaveProperty("stateSource");
    expect(manifest.urls.banner).toBe("/miniapps/neo-convert/key-workbench-stage.webp");
    expect(`${converterSource}\n${appSource}`).not.toMatch(/localStorage|sessionStorage|app\.storage|fetch\s*\(/);
    expect(playArea).toContain("key-workbench-stage.webp");
    expect(playArea).toContain("dispatchSafely");
    expect(playArea).toContain(".catch(() => undefined)");
    expect(playArea).toContain('import { CoinArt } from "@shared/art";');
    expect(uiManifest).toMatch(/tabs:\s*\[\]/);
    expect(uiManifest).toContain('labelKey: "sidebarWorkspace"');
    expect(fs.existsSync(`${root}/NETWORK_STATUS.md`)).toBe(true);
    expect(fs.existsSync(`${root}/ASSET_PROVENANCE.md`)).toBe(true);
  });
});
