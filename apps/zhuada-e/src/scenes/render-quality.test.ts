import { describe, expect, it } from "vitest";
import { isSoftwareRendererLabel, renderQualityProfile } from "./render-quality";

describe("mobile render quality", () => {
  it("keeps full illustrated lighting on normal phone GPUs", () => {
    expect(renderQualityProfile({
      mobile: true,
      rendererLabel: "ANGLE (Qualcomm, Adreno 740)",
      deviceMemoryGb: 8,
      hardwareConcurrency: 8,
    })).toEqual({
      tier: "full",
      antialias: true,
      pixelRatioCap: 1.5,
      shadows: true,
      shadowMapSize: 1024,
      solverIterations: 10,
    });
  });

  it("uses a cheaper render path on SwiftShader without reducing gameplay bodies", () => {
    expect(isSoftwareRendererLabel("ANGLE (Google, Vulkan (SwiftShader Device))")).toBe(true);
    expect(isSoftwareRendererLabel("Android Emulator OpenGL ES Translator (Apple M4)")).toBe(true);
    expect(renderQualityProfile({
      mobile: true,
      rendererLabel: "ANGLE (Google, Vulkan (SwiftShader Device))",
      deviceMemoryGb: 8,
      hardwareConcurrency: 8,
    })).toMatchObject({
      tier: "constrained",
      antialias: false,
      pixelRatioCap: 1.25,
      shadows: false,
      solverIterations: 8,
    });
  });

  it("does not classify real mobile GPUs as software renderers", () => {
    expect(isSoftwareRendererLabel("ANGLE (Qualcomm, Adreno 740)")).toBe(false);
    expect(isSoftwareRendererLabel("Apple GPU")).toBe(false);
  });

  it("protects real low-memory four-core phones even when the GPU label is unavailable", () => {
    expect(renderQualityProfile({
      mobile: true,
      deviceMemoryGb: 2,
      hardwareConcurrency: 4,
    }).tier).toBe("constrained");
  });

  it("never downgrades desktop solely because browser hardware hints are small", () => {
    expect(renderQualityProfile({
      mobile: false,
      deviceMemoryGb: 2,
      hardwareConcurrency: 2,
    }).tier).toBe("full");
  });
});
