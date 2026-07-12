import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FruitFunnelEngine } from "../../fruit-funnel/src/logic/fruit-engine";
import { createFruitSceneCopy } from "../../fruit-funnel/src/scene-copy";

type FakeObject = ReturnType<typeof makeObject>;
type FruitSceneConstructor = typeof import("../../fruit-funnel/src/scenes/FruitFunnelScene").FruitFunnelScene;

let FruitFunnelScene: FruitSceneConstructor;

const harness = vi.hoisted(() => ({
  objects: [] as Array<Record<string, unknown>>,
  readyObjectNames: [] as string[],
  notifyReady: null as null | (() => void),
  resize: null as null | (() => void),
  state: {} as Record<string, unknown>,
}));

function makeObject(type: string, x = 0, y = 0, texture = "") {
  const object = {
    type,
    x,
    y,
    texture,
    name: "",
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    depth: 0,
    visible: true,
    text: "",
    list: [] as FakeObject[],
    setDisplaySize(width: number, height: number) {
      object.scaleX = width / 256;
      object.scaleY = height / 256;
      return object;
    },
    setName(name: string) { object.name = name; return object; },
    setDepth(depth: number) { object.depth = depth; return object; },
    setAlpha(alpha: number) { object.alpha = alpha; return object; },
    setVisible(visible: boolean) { object.visible = visible; return object; },
    setOrigin() { return object; },
    setStrokeStyle() { return object; },
    setInteractive() { return object; },
    setColor() { return object; },
    setFillStyle() { return object; },
    setText(text: string) { object.text = text; return object; },
    fillStyle() { return object; },
    fillRect() { return object; },
    fillRoundedRect() { return object; },
    lineStyle() { return object; },
    strokeRoundedRect() { return object; },
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
    image: (x: number, y: number, texture: string) => makeObject("image", x, y, texture),
    graphics: () => makeObject("graphics"),
    text: (x: number, y: number, text: string) => {
      const object = makeObject("text", x, y);
      object.text = text;
      return object;
    },
    circle: (x: number, y: number) => makeObject("circle", x, y),
    rectangle: (x: number, y: number) => makeObject("rectangle", x, y),
    container: (x: number, y: number) => makeObject("container", x, y),
  };
  protected input = {
    on() {},
    keyboard: { on() {}, off() {} },
  };
  protected time = { addEvent() {} };
  protected events = { once() {} };
  protected cameras = { main: { flash() {} } };
  protected scale = {
    on: (_event: string, callback: () => void, scope: object) => {
      harness.resize = () => callback.call(scope);
    },
  };
  constructor(_key: string) {}
  create() {
    // Production BaseScene defers bridge-ready to the next scene tick. Model
    // that callback so this gate sees the display list at notification time,
    // after FruitFunnelScene's synchronous create() work has finished.
    harness.notifyReady = () => {
      harness.readyObjectNames = harness.objects.map((object) => String(object.name));
    };
    this.state = harness.state;
    this.scale.on("resize", this.onResize, this);
  }
  protected onResize() {}
  protected val<T>(key: string, fallback?: T): T | undefined {
    return (this.state[key] as T) ?? fallback;
  }
  protected bool(key: string): boolean { return Boolean(this.state[key]); }
  protected animate(config: { onComplete?: () => void }) {
    config.onComplete?.();
    return null;
  }
  protected bindGameButton() {}
  protected dispatch() {}
  protected setButtonEnabled() {}
}

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("@framework/phaser", () => ({ BaseScene: FakeBaseScene }));
  ({ FruitFunnelScene } = await import("../../fruit-funnel/src/scenes/FruitFunnelScene"));
}, 120_000);

beforeEach(() => {
  harness.objects.length = 0;
  harness.readyObjectNames = [];
  harness.notifyReady = null;
  harness.resize = null;
  harness.state = {
    game: FruitFunnelEngine.fresh(42, 1, 1_000).snapshot(1_000),
    hintLanes: [],
    hintMessageKey: null,
    storageHealthy: true,
    sceneText: createFruitSceneCopy((key) => key),
  };
});

describe("Fruit Funnel live Phaser stage construction", () => {
  it("creates and retains the static stage, rack, basket, and 48 fruit through resize", () => {
    const scene = new FruitFunnelScene();
    expect(() => scene.create()).not.toThrow();
    expect(harness.notifyReady).toBeTypeOf("function");
    harness.notifyReady?.();

    expect(harness.readyObjectNames).toEqual(expect.arrayContaining([
      "fruit-funnel-stage",
      "fruit-funnel-rack",
      "fruit-funnel-basket",
      "fruit-funnel-orchard",
      "fruit-funnel-channel",
      "fruit-funnel-effects",
    ]));

    const named = new Map(harness.objects.map((object) => [object.name, object]));
    expect(named.get("fruit-funnel-stage")).toMatchObject({ type: "image", texture: "fruit-funnel-stage" });
    expect(named.get("fruit-funnel-rack")).toMatchObject({ type: "image", texture: "fruit-funnel-vine-rack" });
    expect(named.get("fruit-funnel-basket")).toMatchObject({ type: "image", texture: "fruit-funnel-basket" });
    const orchard = named.get("fruit-funnel-orchard") as FakeObject;
    expect(orchard.list.length).toBe(60);
    expect(orchard.list.filter((object) => String(object.texture).startsWith("fruit-")).length).toBe(48);

    expect(harness.resize).toBeTypeOf("function");
    harness.resize?.();
    expect(named.get("fruit-funnel-stage")).toBeTruthy();
    expect(named.get("fruit-funnel-basket")).toBeTruthy();
    expect(orchard.list.length).toBe(60);
  });
});
