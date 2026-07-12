import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SCENE_AUDIO_MUTE_EVENT,
  SCENE_AUDIO_MUTE_STORAGE_KEY,
  SCENE_AUDIO_PRESETS,
  SceneAudio,
  isSceneAudioMuted,
  setSceneAudioMuted,
  toggleSceneAudioMuted,
  type SceneAudioPreset,
} from "@framework/phaser";

type ScheduledRamp = { value: number; at: number };

class FakeAudioParam {
  events: ScheduledRamp[] = [];

  setValueAtTime(value: number, at: number): void {
    this.events.push({ value, at });
  }

  exponentialRampToValueAtTime(value: number, at: number): void {
    this.events.push({ value, at });
  }
}

class FakeOscillator {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  connected: unknown = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  connect(node: unknown): void {
    this.connected = node;
  }

  start(at: number): void {
    this.startedAt = at;
  }

  stop(at: number): void {
    this.stoppedAt = at;
  }
}

class FakeGain {
  gain = new FakeAudioParam();
  connected: unknown = null;

  connect(node: unknown): void {
    this.connected = node;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  state: AudioContextState = "running";
  currentTime = 0;
  destination = { fake: "destination" };
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resumeCalls = 0;
  closeCalls = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = "running";
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

type SceneEventsLike = {
  handlers: Map<string, Array<() => void>>;
  once(event: string, handler: () => void): void;
  emit(event: string): void;
};

function createSceneLike(): { events: SceneEventsLike } {
  const handlers = new Map<string, Array<() => void>>();
  return {
    events: {
      handlers,
      once(event, handler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      emit(event) {
        const list = handlers.get(event) ?? [];
        handlers.set(event, []);
        for (const handler of list) handler();
      },
    },
  };
}

const originalAudioContext = window.AudioContext;

beforeEach(() => {
  FakeAudioContext.instances = [];
  window.localStorage.clear();
  (window as { AudioContext?: unknown }).AudioContext =
    FakeAudioContext as unknown as typeof AudioContext;
});

afterEach(() => {
  window.localStorage.clear();
  (window as { AudioContext?: unknown }).AudioContext = originalAudioContext;
});

describe("SceneAudio", () => {
  it("does not create an AudioContext until sound is requested", () => {
    const audio = new SceneAudio();
    expect(FakeAudioContext.instances).toHaveLength(0);

    audio.play("tap");
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("unlock() resumes a suspended context and marks the mixer unlocked", () => {
    const audio = new SceneAudio();
    audio.unlock();

    const context = FakeAudioContext.instances[0];
    expect(context).toBeDefined();
    expect(audio.unlocked).toBe(true);

    context.state = "suspended";
    audio.unlock();
    expect(context.resumeCalls).toBe(1);
  });

  it("skips scheduling while suspended before the first unlock gesture", () => {
    const audio = new SceneAudio();
    audio.play("tap"); // creates context
    const context = FakeAudioContext.instances[0];
    context.oscillators = [];
    context.state = "suspended";

    audio.play("win");
    expect(context.oscillators).toHaveLength(0);

    audio.unlock();
    audio.play("win");
    expect(context.oscillators.length).toBeGreaterThan(0);
  });

  it("schedules one oscillator per preset tone with envelope and stop time", () => {
    const audio = new SceneAudio();
    audio.unlock();
    const context = FakeAudioContext.instances[0];

    audio.play("win");
    const tones = SCENE_AUDIO_PRESETS.win;
    expect(context.oscillators).toHaveLength(tones.length);

    const first = context.oscillators[0];
    const firstTone = tones[0];
    expect(first.startedAt).toBeCloseTo(firstTone.delay ?? 0, 5);
    expect(first.stoppedAt).toBeCloseTo(
      (firstTone.delay ?? 0) + firstTone.duration + 0.025,
      5,
    );
    expect(first.connected).toBe(context.gains[0]);
    expect(context.gains[0].connected).toBe(context.destination);
    // Envelope: near-zero attack start, audible peak, near-zero release.
    const gainEvents = context.gains[0].gain.events;
    expect(gainEvents.length).toBeGreaterThanOrEqual(3);
    expect(gainEvents[0].value).toBeLessThan(0.001);
    expect(gainEvents.at(-1)?.value).toBeLessThan(0.001);
  });

  it("applies an exponential glide when a tone declares endFrequency", () => {
    const audio = new SceneAudio();
    audio.unlock();
    const context = FakeAudioContext.instances[0];

    audio.tones([
      { frequency: 200, duration: 0.1, endFrequency: 400 },
    ]);

    const osc = context.oscillators.at(-1);
    expect(osc?.frequency.events.map((event) => event.value)).toEqual([200, 400]);
  });

  it("persists and broadcasts the shared mute preference", () => {
    const events: boolean[] = [];
    window.addEventListener(SCENE_AUDIO_MUTE_EVENT, (event) => {
      events.push((event as CustomEvent<{ muted: boolean }>).detail.muted);
    });

    setSceneAudioMuted(true);
    expect(isSceneAudioMuted()).toBe(true);
    expect(window.localStorage.getItem(SCENE_AUDIO_MUTE_STORAGE_KEY)).toBe("true");
    expect(events).toEqual([true]);

    expect(toggleSceneAudioMuted()).toBe(false);
    expect(isSceneAudioMuted()).toBe(false);
    expect(window.localStorage.getItem(SCENE_AUDIO_MUTE_STORAGE_KEY)).toBe("false");
    expect(events).toEqual([true, false]);
  });

  it("stays silent without creating an AudioContext while globally muted", () => {
    setSceneAudioMuted(true);
    const audio = new SceneAudio();

    audio.unlock();
    audio.play("win");
    audio.tones([{ frequency: 440, duration: 0.05 }]);

    expect(audio.unlocked).toBe(true);
    expect(audio.muted).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("stops scheduling tones when muted after unlock", () => {
    const audio = new SceneAudio();
    audio.unlock();
    const context = FakeAudioContext.instances[0];

    setSceneAudioMuted(true);
    audio.play("win");
    expect(context.oscillators).toHaveLength(0);

    audio.setMuted(false);
    audio.play("tap");
    expect(context.oscillators.length).toBeGreaterThan(0);
  });

  it("closes the context when the attached scene shuts down", () => {
    const scene = createSceneLike();
    const audio = new SceneAudio().attach(
      scene as unknown as Parameters<SceneAudio["attach"]>[0],
    );
    audio.unlock();
    const context = FakeAudioContext.instances[0];

    scene.events.emit("shutdown");
    expect(context.closeCalls).toBe(1);
    expect(audio.unlocked).toBe(false);

    // Idempotent: destroy after shutdown must not double-close.
    scene.events.emit("destroy");
    expect(context.closeCalls).toBe(1);
  });

  it("swallows an async close() rejection from an already-closed context", async () => {
    const audio = new SceneAudio();
    audio.unlock();
    const context = FakeAudioContext.instances[0];
    // Page teardown can close the context first — the spec then REJECTS the
    // close() promise. That rejection must never surface as unhandled.
    context.close = () =>
      Promise.reject(new Error("InvalidStateError")) as Promise<void>;

    expect(() => audio.close()).not.toThrow();
    // Flush microtasks: an unconsumed rejection would fail the run here.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(audio.unlocked).toBe(false);
  });

  it("recovers after close by lazily creating a fresh context", () => {
    const audio = new SceneAudio();
    audio.unlock();
    audio.close();

    audio.unlock();
    audio.play("tap");
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(FakeAudioContext.instances[1].oscillators.length).toBeGreaterThan(0);
  });

  it("stays silent and never throws when WebAudio is unavailable", () => {
    (window as { AudioContext?: unknown }).AudioContext = undefined;
    const audio = new SceneAudio();

    expect(() => {
      audio.unlock();
      audio.play("win");
      audio.tones([{ frequency: 440, duration: 0.05 }]);
      audio.close();
    }).not.toThrow();
    expect(audio.unlocked).toBe(false);
  });

  it("ships bounded, finite preset recipes for every named cue", () => {
    const names = Object.keys(SCENE_AUDIO_PRESETS) as SceneAudioPreset[];
    expect(names.length).toBeGreaterThanOrEqual(16);

    for (const name of names) {
      const tones = SCENE_AUDIO_PRESETS[name];
      expect(tones.length, name).toBeGreaterThan(0);
      for (const tone of tones) {
        expect(Number.isFinite(tone.frequency), name).toBe(true);
        expect(tone.frequency, name).toBeGreaterThan(20);
        expect(tone.frequency, name).toBeLessThan(8000);
        expect(tone.duration, name).toBeGreaterThan(0);
        expect(tone.duration, name).toBeLessThanOrEqual(0.5);
        expect(tone.gain ?? 0.02, name).toBeLessThanOrEqual(0.08);
        if (tone.endFrequency !== undefined) {
          expect(tone.endFrequency, name).toBeGreaterThan(0);
        }
      }
    }
  });
});
