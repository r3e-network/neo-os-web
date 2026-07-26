/**
 * Probe the WebGL default framebuffer immediately after a submitted render.
 *
 * `renderer.info.render.calls > 0` only proves that Three.js issued commands;
 * an Android GPU/driver failure can still composite a permanently blank
 * canvas. Reading a small grid directly from the live WebGL context gives the
 * React host an honest positive signal without relying on a 2D canvas copy,
 * which Android Chrome may return transparent for a healthy composited layer.
 */
export function webglFrameHasVisibleContent(
  gl: Pick<WebGLRenderingContext, "RGBA" | "UNSIGNED_BYTE" | "readPixels">,
  width: number,
  height: number,
): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    return false;
  }
  const sample = new Uint8Array(4);
  const probes = [
    [0.5, 0.5],
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
    [0.5, 0.2],
    [0.5, 0.8],
    [0.2, 0.5],
    [0.8, 0.5],
  ] as const;
  try {
    for (const [nx, ny] of probes) {
      sample.fill(0);
      const x = Math.max(0, Math.min(width - 1, Math.floor(width * nx)));
      const y = Math.max(0, Math.min(height - 1, Math.floor(height * ny)));
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
      if (sample[0]! > 2 || sample[1]! > 2 || sample[2]! > 2 || sample[3]! > 2) {
        return true;
      }
    }
  } catch {
    // A lost/invalid context is not a positive rendered-frame signal.
  }
  return false;
}
