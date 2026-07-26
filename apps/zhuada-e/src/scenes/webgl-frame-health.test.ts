import { describe, expect, it, vi } from "vitest";
import { webglFrameHasVisibleContent } from "./webgl-frame-health";

function contextWith(
  sampleAt: number | null,
  throws = false,
): Pick<WebGLRenderingContext, "RGBA" | "UNSIGNED_BYTE" | "readPixels"> {
  let reads = 0;
  return {
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    readPixels: vi.fn((
      _x: number,
      _y: number,
      _width: number,
      _height: number,
      _format: number,
      _type: number,
      pixels: ArrayBufferView | null,
    ) => {
      if (throws) throw new Error("context lost");
      if (reads === sampleAt && pixels instanceof Uint8Array) {
        pixels.set([18, 42, 63, 255]);
      }
      reads += 1;
    }) as WebGLRenderingContext["readPixels"],
  };
}

describe("WebGL rendered-frame health probe", () => {
  it("accepts a frame only when the live framebuffer contains visible pixels", () => {
    expect(webglFrameHasVisibleContent(contextWith(4), 1080, 1800)).toBe(true);
    expect(webglFrameHasVisibleContent(contextWith(null), 1080, 1800)).toBe(false);
  });

  it("fails closed for invalid dimensions and context readback errors", () => {
    expect(webglFrameHasVisibleContent(contextWith(0), 0, 1800)).toBe(false);
    expect(webglFrameHasVisibleContent(contextWith(null, true), 1080, 1800)).toBe(false);
  });

});
