/**
 * sound.test.ts — unit tests for the synthesized WebAudio SFX engine.
 *
 * The engine is a module-level singleton, so each test re-imports a fresh
 * module instance (vi.resetModules) against stubbed `window.AudioContext` /
 * `localStorage` globals. The fake AudioContext records every scheduled voice
 * (oscillator / buffer-source starts) so the tests can assert real synthesis
 * behavior — cue-table completeness, the land-cue throttle, mute persistence
 * and gating, and gesture-unlock handling — without a browser.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Sfx } from "./sound";

const MUTE_KEY = "zhuada-e:sound-muted";
const ALL_CUES: Sfx[] = ["land", "pick", "match", "combo", "win", "fail", "powerup", "shuffle", "click", "tick", "unlock", "shake"];

// ── Test doubles ─────────────────────────────────────────────────────────────

interface FakeParam {
  value: number;
  ramps: number[];
  setValueAtTime(v: number): void;
  exponentialRampToValueAtTime(v: number): void;
  cancelScheduledValues(): void;
  setTargetAtTime(v: number): void;
}

function makeParam(): FakeParam {
  return {
    value: 0,
    ramps: [],
    setValueAtTime(v: number) { this.value = v; },
    exponentialRampToValueAtTime(v: number) { this.ramps.push(v); },
    cancelScheduledValues() { /* recorded implicitly */ },
    setTargetAtTime(v: number) { this.value = v; },
  };
}

interface AudioRecord {
  constructed: number;
  started: number;
  resumes: number;
  gains: { gain: FakeParam }[];
}

function makeFakeAudio(initialState: "running" | "suspended" = "running") {
  const record: AudioRecord = { constructed: 0, started: 0, resumes: 0, gains: [] };
  class FakeAudioContext {
    state = initialState;
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    constructor() { record.constructed += 1; }
    resume(): Promise<void> {
      record.resumes += 1;
      this.state = "running";
      return Promise.resolve();
    }
    createGain() {
      const g = { gain: makeParam(), connect: (x: unknown) => x };
      record.gains.push(g);
      return g;
    }
    createOscillator() {
      return {
        type: "sine",
        frequency: makeParam(),
        connect: (x: unknown) => x,
        start: () => { record.started += 1; },
        stop: () => { /* noop */ },
      };
    }
    createBuffer(_channels: number, len: number, _rate: number) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      return {
        buffer: null as unknown,
        connect: (x: unknown) => x,
        start: () => { record.started += 1; },
        stop: () => { /* noop */ },
      };
    }
    createBiquadFilter() {
      return { type: "lowpass", frequency: { value: 0 }, connect: (x: unknown) => x };
    }
  }
  return { FakeAudioContext, record };
}

function makeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: () => null,
    get length() { return map.size; },
  } as Storage;
}

interface Env {
  record: AudioRecord;
  storage: Storage;
}

/** Fresh engine module against stubbed window/localStorage globals. */
async function freshSound(opts: { muteStored?: string; suspended?: boolean; noWebAudio?: boolean } = {}) {
  const { FakeAudioContext, record } = makeFakeAudio(opts.suspended ? "suspended" : "running");
  const storage = makeStorage(opts.muteStored !== undefined ? { [MUTE_KEY]: opts.muteStored } : {});
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", opts.noWebAudio ? {} : { AudioContext: FakeAudioContext });
  vi.resetModules();
  const mod = await import("./sound");
  const env: Env = { record, storage };
  return { sound: mod.sound, SFX_NAMES: mod.SFX_NAMES, SFX_ASSET_URLS: mod.SFX_ASSET_URLS, env };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SoundEngine (synthesized WebAudio)", () => {
  it("cue table is complete: SFX_NAMES lists all 12 cues including tick + unlock + shake", async () => {
    const { SFX_NAMES, SFX_ASSET_URLS } = await freshSound();
    expect([...SFX_NAMES].sort()).toEqual([...ALL_CUES].sort());
    expect(SFX_NAMES).toContain("tick");
    expect(SFX_NAMES).toContain("shake");
    expect(Object.keys(SFX_ASSET_URLS).sort()).toEqual([...ALL_CUES].sort());
    for (const cue of ALL_CUES) expect(SFX_ASSET_URLS[cue]).toBe(`./audio/${cue}.wav`);
  });

  it("every cue synthesizes at least one voice (no silent switch cases)", async () => {
    const { sound, env } = await freshSound();
    for (const cue of ALL_CUES) {
      const before = env.record.started;
      sound.play(cue);
      expect(env.record.started, `cue "${cue}" produced no voices`).toBeGreaterThan(before);
    }
  });

  it("the tick cue is a two-tone knock (no noise buffer)", async () => {
    const { sound, env } = await freshSound();
    sound.play("tick");
    expect(env.record.started).toBe(2);
  });

  it("land cues are throttled: a second land within 45ms is dropped", async () => {
    const { sound, env } = await freshSound();
    sound.play("land", 1);
    const afterFirst = env.record.started;
    expect(afterFirst).toBeGreaterThan(0);
    sound.play("land", 1); // immediate replay → inside the 45ms window
    expect(env.record.started).toBe(afterFirst);
  });

  it("dense collision bursts collapse to one land cue instead of stacking dozens of thuds", async () => {
    const { sound, env } = await freshSound();
    for (let i = 0; i < 36; i += 1) sound.play("land", 0.9);
    expect(env.record.started).toBe(2); // one noise buffer + one low thud tone
  });

  it("boots muted when localStorage has the persisted mute flag", async () => {
    const { sound } = await freshSound({ muteStored: "1" });
    expect(sound.muted).toBe(true);
    expect(sound.qaSnapshot().muted).toBe(true);
    expect(sound.qaSnapshot().contextState).toBe("not-created");
  });

  it("muted play is fully gated: no AudioContext is even constructed", async () => {
    const { sound, env } = await freshSound({ muteStored: "1" });
    sound.play("click");
    expect(env.record.constructed).toBe(0);
    expect(env.record.started).toBe(0);
  });

  it("setMuted persists the flag and drives the master gain to 0 / back up", async () => {
    const { sound, env } = await freshSound();
    sound.play("click"); // creates the context + master gain
    const master = env.record.gains[0]!;
    expect(master.gain.value).toBe(0.5);
    sound.setMuted(true);
    expect(env.storage.getItem(MUTE_KEY)).toBe("1");
    expect(master.gain.value).toBe(0);
    sound.setMuted(false);
    expect(env.storage.getItem(MUTE_KEY)).toBe("0");
    expect(master.gain.value).toBe(0.5);
  });

  it("stops gameplay voices immediately after muting an already-created context", async () => {
    const { sound, env } = await freshSound();
    sound.play("match");
    const beforeMute = env.record.started;
    expect(beforeMute).toBeGreaterThan(0);

    sound.setMuted(true);
    for (const cue of ALL_CUES) sound.play(cue);

    expect(env.record.started).toBe(beforeMute);
  });

  it("toggleMuted flips the state, returns it, and persists each flip", async () => {
    const { sound, env } = await freshSound();
    expect(sound.toggleMuted()).toBe(true);
    expect(sound.muted).toBe(true);
    expect(env.storage.getItem(MUTE_KEY)).toBe("1");
    expect(sound.toggleMuted()).toBe(false);
    expect(env.storage.getItem(MUTE_KEY)).toBe("0");
  });

  it("unlock resumes a suspended context (gesture unlock), and play self-resumes too", async () => {
    const first = await freshSound({ suspended: true });
    first.sound.unlock();
    expect(first.env.record.constructed).toBe(1);
    expect(first.env.record.resumes).toBe(1);
    expect(first.sound.qaSnapshot().contextState).toBe("running");
    // A play() on a still-suspended context also requests a resume.
    const second = await freshSound({ suspended: true });
    second.sound.play("click");
    expect(second.env.record.resumes).toBeGreaterThan(0);
    expect(second.env.record.started).toBeGreaterThan(0);
  });

  it("pauses ambience while hidden and resumes only for an active, unmuted run", async () => {
    const listeners = new Map<string, () => void>();
    const fakeDocument = {
      hidden: false,
      addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    };
    const audioRecord = { plays: 0, pauses: 0 };
    class FakeHtmlAudio {
      loop = false;
      preload = "";
      volume = 1;
      muted = false;
      constructor(_src: string) {}
      play(): Promise<void> {
        audioRecord.plays += 1;
        return Promise.resolve();
      }
      pause(): void {
        audioRecord.pauses += 1;
      }
    }
    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("Audio", FakeHtmlAudio);
    const { sound } = await freshSound();
    sound.setTheme("garden");
    sound.setPlaying(true);
    expect(audioRecord.plays).toBeGreaterThan(0);

    fakeDocument.hidden = true;
    listeners.get("visibilitychange")?.();
    expect(audioRecord.pauses).toBeGreaterThan(0);

    const beforeResume = audioRecord.plays;
    fakeDocument.hidden = false;
    listeners.get("visibilitychange")?.();
    expect(audioRecord.plays).toBeGreaterThan(beforeResume);

    sound.setMuted(true);
    const mutedPlayCount = audioRecord.plays;
    fakeDocument.hidden = true;
    listeners.get("visibilitychange")?.();
    fakeDocument.hidden = false;
    listeners.get("visibilitychange")?.();
    expect(audioRecord.plays).toBe(mutedPlayCount);
  });

  it("is inert without WebAudio: unlock/play/toggle never throw and start nothing", async () => {
    const { sound, env } = await freshSound({ noWebAudio: true });
    expect(() => sound.unlock()).not.toThrow();
    expect(() => sound.play("win")).not.toThrow();
    expect(() => sound.toggleMuted()).not.toThrow();
    expect(env.record.constructed).toBe(0);
    expect(env.record.started).toBe(0);
  });
});
