export type RenderQualityTier = "full" | "constrained";

export interface RenderQualityInput {
  mobile: boolean;
  rendererLabel?: string;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
}

export interface RenderQualityProfile {
  tier: RenderQualityTier;
  antialias: boolean;
  pixelRatioCap: number;
  shadows: boolean;
  /**
   * When real shadow maps are disabled, render a cheap projected dark circle
   * under each item for grounding/depth perception. Costs 1 extra draw call
   * per item but prevents the "floating" look on constrained devices.
   */
  blobShadows: boolean;
  shadowMapSize: number;
  solverIterations: number;
}

const SOFTWARE_RENDERER = /\b(?:swiftshader|llvmpipe|software rasterizer|software renderer|android emulator openGL ES translator)\b/i;

export function isSoftwareRendererLabel(rendererLabel: string | undefined): boolean {
  return SOFTWARE_RENDERER.test(rendererLabel ?? "");
}

/**
 * Preserve the full illustrated lighting on normal phone GPUs, while keeping
 * the same models/materials playable on software renderers and 2 GB devices.
 * This is a rendering-quality choice only: item count, physics bodies,
 * collisions, picking and game rules never change between tiers.
 *
 * Desktop software renderers (SwiftShader in CI/VMs, disabled GPU) are also
 * constrained — previously only mobile was checked, causing single-digit FPS
 * on headless environments.
 */
export function renderQualityProfile(input: RenderQualityInput): RenderQualityProfile {
  const memory = finitePositive(input.deviceMemoryGb);
  const cores = finitePositive(input.hardwareConcurrency);
  const software = isSoftwareRendererLabel(input.rendererLabel);
  const lowMemory = memory !== null && memory <= 2;
  const lowSpec = memory !== null && memory <= 4 && cores !== null && cores <= 4;
  // Software renderers are constrained regardless of platform (fixes CI/VM).
  const constrained = software || (input.mobile && (lowMemory || lowSpec));

  return constrained
    ? {
        tier: "constrained",
        antialias: false,
        pixelRatioCap: 1.5,
        shadows: false,
        blobShadows: true,
        shadowMapSize: 512,
        solverIterations: 8,
      }
    : {
        tier: "full",
        antialias: true,
        pixelRatioCap: input.mobile ? 1.5 : 2,
        shadows: true,
        blobShadows: false,
        shadowMapSize: input.mobile ? 1024 : 1536,
        solverIterations: input.mobile ? 10 : 12,
      };
}

/**
 * Dynamic quality adaptation: call with the rolling average frame time (ms).
 * Returns a suggested pixel ratio scale factor [0.6, 1.0] that the render loop
 * can apply when sustained frame times exceed the budget. This prevents
 * thermal throttling from making the game unplayable after extended sessions.
 */
export function dynamicQualityScale(avgFrameTimeMs: number, targetMs = 16.7): number {
  if (avgFrameTimeMs <= targetMs * 1.15) return 1.0;
  if (avgFrameTimeMs >= targetMs * 2.5) return 0.6;
  // Linear interpolation between 1.15x and 2.5x budget.
  const t = (avgFrameTimeMs - targetMs * 1.15) / (targetMs * 1.35);
  return Math.max(0.6, 1.0 - t * 0.4);
}

function finitePositive(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
