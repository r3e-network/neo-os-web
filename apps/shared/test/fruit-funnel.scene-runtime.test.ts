import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SuikaEngine } from "../../fruit-funnel/src/logic/suika-engine";
import { createSuikaSceneCopy } from "../../fruit-funnel/src/suika-copy";

type FakeObject = ReturnType<typeof makeObject>;
type SuikaSceneConstructor = typeof import("../../fruit-funnel/src/scenes/SuikaScene").SuikaScene;

let SuikaScene: SuikaSceneConstructor;

const harness = vi.hoisted(() => ({
  objects: [] as Array<Record<string, unknown>>,
  circleBodies: 0,
  state: {} as Record<string, unknown>,
}));

function makeObject(type: string, texture = "") {
  const object = {
    type,
    x: 0,
    y: 0,
    texture,
    text: "",
    alpha: 1,
    depth: 0,
    visible: true,
    list: [] as FakeObject[],
    setDisplaySize() { return object; },
    setDepth(depth: number) { object.depth = depth; return object; },
    setAlpha(alpha: number) { object.alpha = alpha; return object; },
    setVisible(visible: boolean) { object.visible = visible; return object; },
    setOrigin() { return object; },
    setStrokeStyle() { return object; },
    setInteractive() { return object; },
    setSize() { return object; },
    setScale() { return object; },
    setPosition() { return object; },
    setRotation() { return object; },
    setText(text: string) { object.text = text; return object; },
    fillStyle() { return object; },
    fillRect() { return object; },
    fillRoundedRect() { return object; },
    lineStyle() { return object; },
    strokeRoundedRect() { return object; },
    lineBetween() { return object; },
    clear() { return object; },
    add(children: FakeObject | FakeObject[]) {
      object.list.push(...(Array.isArray(children) ? children : [children]));
      return object;
    },
    removeAll() { object.list.length = 0; return object; },
    on() { return object; },
    destroy() { return undefined; },
  };
  harness.objects.push(object);
  return object;
}

class FakeBaseScene {
  static preloadAssets() {}
  protected state = harness.state;
  protected reducedMotion = false;
  protected sfx = { unlock() {}, play() {} };
  protected add = {
    image: (x: number, y: number, texture: string) => {
      const object = makeObject("image", texture);
      object.x = x;
      object.y = y;
      return object;
    },
    graphics: () => makeObject("graphics"),
    text: (x: number, y: number, text: string) => {
      const object = makeObject("text");
      object.x = x;
      object.y = y;
      object.text = text;
      return object;
    },
    circle: () => makeObject("circle"),
    ellipse: () => makeObject("ellipse"),
    rectangle: () => makeObject("rectangle"),
    container: (x: number, y: number, children?: FakeObject[]) => {
      const object = makeObject("container");
      object.x = x;
      object.y = y;
      if (children) object.add(children);
      return object;
    },
  };
  protected matter = {
    world: {
      enabled: true,
      setBounds() {},
      setGravity() {},
      on() {},
      remove() {},
    },
    add: {
      circle: (x: number, y: number, r: number, opts: { label?: string }) => {
        harness.circleBodies += 1;
        return {
          position: { x, y },
          velocity: { x: 0, y: 0 },
          angle: 0,
          circleRadius: r,
          label: opts?.label ?? "",
        };
      },
    },
  };
  protected textures = { exists: () => true };
  protected load = { image() {} };
  protected time = { addEvent: () => ({}), now: 0 };
  protected input = { on() {}, keyboard: { on() {}, off() {} } };
  protected cameras = { main: { flash() {} } };
  constructor(_key: string) {}
  create() {
    this.state = harness.state;
  }
  protected val<T>(key: string, fallback?: T): T | undefined {
    return (this.state[key] as T) ?? fallback;
  }
  protected bool(key: string): boolean { return Boolean(this.state[key]); }
  protected tween() { return null; }
  protected animate(config: { onComplete?: () => void }) {
    config.onComplete?.();
    return null;
  }
  protected bindGameButton() {}
  protected dispatch() {}
}

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("@framework/phaser", () => ({ BaseScene: FakeBaseScene }));
  ({ SuikaScene } = await import("../../fruit-funnel/src/scenes/SuikaScene"));
}, 120_000);

beforeEach(() => {
  harness.objects.length = 0;
  harness.circleBodies = 0;
  const engine = SuikaEngine.fresh(42, 0, 1_000);
  engine.dropFruit(engine.snapshot().currentLevel, 195, 100, 1_001);
  harness.state = {
    game: engine.snapshot(1_001),
    aimX: 195,
    storageHealthy: true,
    sceneText: createSuikaSceneCopy((key) => key),
  };
});

describe("Fruit Funnel live Phaser stage construction", () => {
  it("builds the physics stage, orchard backdrop, fruit sprites, and a Matter body without throwing", () => {
    const scene = new SuikaScene();
    expect(() => {
      scene.preload();
      scene.create();
    }).not.toThrow();

    // The one dropped fruit is reconciled into a real Matter circle body.
    expect(harness.circleBodies).toBe(1);

    // Real illustrated backdrop is placed on the stage.
    expect(
      harness.objects.some(
        (object) => object.type === "image" && object.texture === "fruit-funnel-orchard-stage",
      ),
    ).toBe(true);

    // Droppable fruit render through their loaded sprite textures.
    expect(
      harness.objects.some(
        (object) =>
          object.type === "image" && String(object.texture).startsWith("fruit-funnel-fruit-"),
      ),
    ).toBe(true);

    // HUD text (score / best / next / status) is built.
    expect(harness.objects.some((object) => object.type === "text")).toBe(true);
  });
});
