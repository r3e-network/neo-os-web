const canvasContextState: Record<string | symbol, unknown> = {
  canvas: null,
  fillStyle: "#000",
  globalCompositeOperation: "source-over",
  getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
  measureText: (text: string) => ({ width: text.length * 8 }),
};

const canvasContext2d = new Proxy(
  canvasContextState,
  {
    get(target, property) {
      if (property in target) {
        return target[property];
      }
      return () => undefined;
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  },
);

function ensureCanvasContext(): void {
  if (typeof HTMLCanvasElement === "undefined") return;

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value(type: string) {
      if (type === "2d") {
        canvasContextState.canvas = this;
        return canvasContext2d;
      }
      return null;
    },
  });
}

ensureCanvasContext();
