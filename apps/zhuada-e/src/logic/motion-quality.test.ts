import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TRAY_ENTRY_MOTION_MS,
  TRAY_MATCH_MOTION_MS,
  TRAY_MOTION_TIMINGS,
} from "./tray-motion";
import { SCENE_MOTION, portraitCameraBias } from "../scenes/scene-motion";

const scssPath = fileURLToPath(new URL("../PlayArea.scss", import.meta.url));
const playAreaScss = readFileSync(scssPath, "utf8");
const scenePath = fileURLToPath(new URL("../scenes/ZhuaDaScene.ts", import.meta.url));
const zhuaDaSceneSource = readFileSync(scenePath, "utf8");
const trayMatchHoldBlock = playAreaScss.match(/@keyframes goose-tray-match-hold \{[\s\S]*?\n\}/)?.[0] ?? "";

describe("motion quality guardrails", () => {
  it("keeps tray choreography readable instead of collapsing to instant motion", () => {
    expect(TRAY_MOTION_TIMINGS.approachMs).toBeGreaterThanOrEqual(70);
    expect(TRAY_MOTION_TIMINGS.groupingMs).toBeGreaterThanOrEqual(620);
    expect(TRAY_MOTION_TIMINGS.highlightMs).toBeGreaterThanOrEqual(240);
    expect(TRAY_MOTION_TIMINGS.clearMs).toBeGreaterThanOrEqual(420);
    expect(TRAY_MOTION_TIMINGS.compactMs).toBeGreaterThanOrEqual(460);
    expect(TRAY_ENTRY_MOTION_MS).toBe(692);
    expect(TRAY_MATCH_MOTION_MS).toBe(1812);
  });

  it("keeps tray movement compositor-friendly and naturally eased", () => {
    expect(playAreaScss).toContain("--goose-motion-natural: cubic-bezier(0.22, 0.74, 0.18, 1)");
    expect(playAreaScss).toContain("--goose-motion-soft: cubic-bezier(0.2, 0.9, 0.2, 1)");
    expect(playAreaScss).toContain("--goose-motion-quick: cubic-bezier(0.2, 0.82, 0.24, 1)");
    expect(playAreaScss).toContain("--goose-motion-loop: cubic-bezier(0.45, 0, 0.55, 1)");
    expect(playAreaScss).toContain("--goose-motion-celebrate: cubic-bezier(0.2, 0.9, 0.2, 1.25)");
    expect(playAreaScss).toContain("--goose-tray-entry-ms: 692ms");
    expect(playAreaScss).toContain("--goose-tray-grouping-ms: 620ms");
    expect(playAreaScss).toContain("--goose-tray-highlight-ms: 240ms");
    expect(playAreaScss).toContain("--goose-tray-clear-ms: 420ms");
    expect(playAreaScss).toContain("--goose-tray-compact-ms: 460ms");
    expect(playAreaScss).toContain("contain: layout paint");
    expect(playAreaScss).toContain("will-change: transform, opacity, filter");
    expect(playAreaScss).toContain("transform: translate3d(var(--goose-tray-x), 0, 0)");
    expect(playAreaScss).toContain("transform var(--goose-tray-grouping-ms) var(--goose-motion-natural)");
    expect(playAreaScss).toContain("transform var(--goose-tray-compact-ms) var(--goose-motion-natural)");
    expect(playAreaScss).toContain("animation: goose-tray-match-hold var(--goose-tray-highlight-ms)");
    expect(trayMatchHoldBlock).not.toMatch(/translateX\(/);
    expect(trayMatchHoldBlock).toContain("translate3d(var(--goose-tray-x), 0, 0)");
    expect(playAreaScss).not.toMatch(/left:\s*var\(--goose-tray-x\)/);
    expect(playAreaScss).not.toMatch(/transition:\s*all\b/);
  });

  it("keeps UI controls and shelf clear animations on the shared smooth motion system", () => {
    expect(playAreaScss).toContain("animation: goose-shelf-clear 420ms var(--goose-motion-pop) both");
    expect(playAreaScss).toContain("animation: goose-tray-enter 380ms var(--goose-motion-soft) both");
    expect(playAreaScss).toContain("animation: goose-map-enter 280ms var(--goose-motion-soft) both");
    expect(playAreaScss).toContain("animation: goose-unlock-pop 500ms var(--goose-motion-celebrate) both");
    expect(playAreaScss).toContain("animation: goose-chip-hop 1.4s var(--goose-motion-loop) infinite");
    expect(playAreaScss).toContain("transition: width 280ms var(--goose-motion-soft)");
    expect(playAreaScss).toContain("transform 180ms var(--goose-motion-quick)");
    expect(playAreaScss).toContain("box-shadow 260ms var(--goose-motion-soft)");
    expect(playAreaScss).toContain("animation: goose-drawer-enter 0.3s var(--goose-motion-soft) both");
    const withoutMotionTokenDeclarations = playAreaScss.replace(/^\s*--goose-motion-[^:]+:[^;]+;\n/gm, "");
    expect(withoutMotionTokenDeclarations).not.toMatch(/\b(?:ease|ease-in|ease-out|ease-in-out|cubic-bezier)\b/);
    expect(playAreaScss).not.toContain("transition: transform 0.12s ease");
  });

  it("keeps rapid picks visually queued instead of interrupting tray choreography", () => {
    expect(readFileSync(fileURLToPath(new URL("../AnimatedTray.tsx", import.meta.url)), "utf8"))
      .toContain("pendingReceiptsRef");
    expect(readFileSync(fileURLToPath(new URL("../AnimatedTray.test.tsx", import.meta.url)), "utf8"))
      .toContain("queues a second receipt until the first tray choreography settles");
  });

  it("keeps 3D pick and pan-toss motion on readable, capped timings", () => {
    expect(SCENE_MOTION.cameraShakeMs).toBe(420);
    expect(SCENE_MOTION.panTossMs).toBe(820);
    expect(SCENE_MOTION.popMiniMs).toBe(TRAY_MOTION_TIMINGS.clearMs);
    expect(SCENE_MOTION.popBurstMs).toBeGreaterThan(SCENE_MOTION.popMiniMs);
    expect(SCENE_MOTION.failRunMs).toBeGreaterThanOrEqual(SCENE_MOTION.panTossMs);
    expect(SCENE_MOTION.hintPulseMs).toBeGreaterThanOrEqual(1_600);
    expect(SCENE_MOTION.panTossMs).toBeGreaterThan(SCENE_MOTION.cameraShakeMs);
    expect(SCENE_MOTION.cameraShakeAmplitude).toBeLessThanOrEqual(0.1);
    expect(SCENE_MOTION.panRollAmplitude).toBeLessThanOrEqual(0.11);
    expect(SCENE_MOTION.panPitchAmplitude).toBeLessThanOrEqual(0.07);
    expect(SCENE_MOTION.panDampingPower).toBeGreaterThanOrEqual(1.6);
    expect(SCENE_MOTION.trayFlightArcY).toBeGreaterThanOrEqual(0.75);
    expect(SCENE_MOTION.pickPressScale).toBeGreaterThan(1);
    expect(SCENE_MOTION.pickPressScale).toBeLessThanOrEqual(1.16);
    expect(SCENE_MOTION.trayFlightEndScale).toBeGreaterThanOrEqual(0.45);
    expect(SCENE_MOTION.qaTelemetryMs).toBe(1_000);
  });

  it("moves a tall-phone pile down into the reference composition without shifting desktop", () => {
    expect(portraitCameraBias(1.04)).toBe(0);
    expect(portraitCameraBias(0.75)).toBeGreaterThan(0.4);
    expect(portraitCameraBias(308 / 552)).toBeGreaterThan(0.9);
    expect(portraitCameraBias(0.4)).toBeLessThanOrEqual(0.94);
  });

  it("keeps 3D tray flight on the same smooth handoff contract as the tray", () => {
    expect(TRAY_ENTRY_MOTION_MS).toBeGreaterThan(SCENE_MOTION.cameraShakeMs);
    expect(zhuaDaSceneSource).toContain("const e = easeInOutCubic(t)");
    expect(zhuaDaSceneSource).toContain("const e = easeInOutCubic(Math.min(1, t))");
    expect(zhuaDaSceneSource).toContain("Math.pow(1 - e, SCENE_MOTION.panDampingPower)");
    expect(zhuaDaSceneSource).toContain("duplicatePickGuardUntil(performance.now())");
    expect(zhuaDaSceneSource).toContain("Do not");
    expect(zhuaDaSceneSource).toContain("globally lock the pile");
    expect(zhuaDaSceneSource).toContain("vis.mesh.position.copy(end)");
    expect(zhuaDaSceneSource).not.toContain("/ 820");
    expect(zhuaDaSceneSource).not.toContain("const dur = 420");
    expect(zhuaDaSceneSource).not.toContain("const dur = 550");
    expect(zhuaDaSceneSource).not.toContain("const dur = 1600");
    expect(playAreaScss).toContain("transform var(--goose-tray-grouping-ms) var(--goose-motion-natural)");
    expect(playAreaScss).toContain("transition: transform var(--goose-tray-compact-ms) var(--goose-motion-natural)");
  });
});
