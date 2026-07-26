/**
 * ZhuaDaScene — Three.js + cannon-es physics scene for Goose Basket Shuffle.
 *
 * The mechanic (per the community Three.js + cannon-es reimplementation):
 *   - Low-poly items drop into an open-top box and pile up under physics.
 *   - The player taps an item to pull it OUT of the box into a 7-slot tray.
 *   - Three of the same kind in the tray clear away.
 *   - Level cleared when the box is empty; game over when the tray jams.
 *
 * This class implements `ThreeSceneController` (consumed by ThreeGameComponent):
 *   - `mount(host, bridge)` builds the renderer + cannon world + raycaster and
 *     starts the rAF loop.
 *   - `setState(state)` is called by React whenever observables change. We read
 *     `items` (the logical item list) and `tray` (slot contents), and reconcile
 *     the live meshes against them.
 *   - On a successful pick we call `bridge.dispatch("extract", { itemId, kind })`.
 *
 * The React/guest engine remains the single source of truth for game state
 * (items, tray, score, win/lose). The scene only renders + reports picks.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Body,
  Box,
  ContactMaterial,
  Cylinder,
  Material as CannonMaterial,
  Plane,
  Quaternion as CannonQuaternion,
  SAPBroadphase,
  Sphere,
  Vec3,
  World,
  type Body as CannonBody,
  type GSSolver,
} from "cannon-es";
import { GameBridge } from "@framework/phaser";
import type { GameState } from "@framework/phaser/types";
import {
  TRAY_SLOTS,
  type ExtractReceipt,
  type ItemInstance,
} from "../logic/engine-zhuada";
import { buildGoose, buildThemeModelMesh } from "./models";
import { pickItemAt, pickItemNearPointer } from "./pick";
import { sound } from "../logic/sound";
import { publicAssetUrl } from "../logic/public-asset-url";
import { haptics } from "../logic/haptics";
import { specOf, tuneGravity } from "../logic/game-rules";
import { computeHintPlan } from "../logic/hint-plan";
import { sceneOfLevel } from "../logic/scenes";
import { DEFAULT_THEME_ID, themeItem, themeOf, type GameThemeId } from "../logic/themes";
import { shakeDynamics } from "../logic/shake-dynamics";
import {
  TRAY_ENTRY_MOTION_MS,
  TRAY_MOTION_TIMINGS,
} from "../logic/tray-motion";
import {
  SURFACE_PHYSICS,
  physicsProfileOf,
  type CollisionShapeSpec,
  type ItemPhysicsProfile,
  type PhysicsSurface,
} from "./physics-profiles";
import { disposeObject } from "./scene-resources";
import { SCENE_MOTION, portraitCameraBias } from "./scene-motion";
import { duplicatePickGuardUntil } from "./pick-lock";
import {
  clearSettleCooldown,
  initialPileEuler,
  resettlePileAfterSupportRemoval,
  settleReadableFace,
  settleReadableUpright,
  tipUprightSideRestBody,
} from "./pile-dynamics";
import { pileDimensions } from "./pile-density";
import { webglFrameHasVisibleContent } from "./webgl-frame-health";
import {
  isSoftwareRendererLabel,
  renderQualityProfile,
  type RenderQualityProfile,
} from "./render-quality";

// Logical scene size (CSS pixels of the canvas host on desktop).
const SCENE_W = 400;
const SCENE_H = 580;

// Camera framing — the reference game is an almost orthogonal top view. A
// shallow perspective remains so cylindrical and long objects still read 3D.
const BOX_HALF = 3.0; // half-extent of the box interior (x and z)
const BOX_HEIGHT = 0.82; // shallow visible wall; collision walls remain infinite

const CONTAINER_TEXTURE_CACHE = new Map<GameThemeId, THREE.Texture>();

function containerTexture(themeId: GameThemeId): THREE.Texture {
  const cached = CONTAINER_TEXTURE_CACHE.get(themeId);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(publicAssetUrl(`./art/container-${themeId}.webp`));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.2, 2.4);
  texture.anisotropy = 4;
  texture.userData.sharedAsset = true;
  CONTAINER_TEXTURE_CACHE.set(themeId, texture);
  return texture;
}

const C = {
  boxFloor: 0xece4d6,
  boxWall: 0xf3ede2,
  boxEdge: 0x16c784,
  brand: 0x16c784,
  danger: 0xef4444,
  ink: "#19313a",
  sub: "#5c5a56",
  trayBg: 0xffffff,
};

interface ItemVisual {
  id: number;
  kind: number;
  /** Composed model root (models.ts builders return a Group of Meshes). */
  mesh: THREE.Group;
  body: CannonBody;
  /**
   * True from the instant a pick is dispatched (synchronous in-flight guard
   * against double-taps) until the visual is removed after the tray fly.
   */
  extracting: boolean;
  /** True once the accepted visual has started its one and only tray flight. */
  flying: boolean;
  /** Production model scale restored after a rejected full-tray pick. */
  baseScale: number;
  /** when true the body is asleep / not yet spawned. */
  spawned: boolean;
  /** Cached physics profile — avoids per-frame physicsProfileOf allocation. */
  profile: ItemPhysicsProfile;
  /** True while the pointer hovers this item (pre-pick visual feedback). */
  hovered: boolean;
}

export class ZhuaDaScene {
  private host: HTMLElement | null = null;
  private bridge: GameBridge | null = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  /** Shared PMREM target that gives glaze, ceramic and metal real reflections. */
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private camera!: THREE.OrthographicCamera;
  private world!: World;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();

  private itemVisuals = new Map<number, ItemVisual>();
  private boxMeshes: THREE.Object3D[] = [];
  /** Container + physical models tilt together during the pan-toss gesture. */
  private playfieldGroup!: THREE.Group;
  private containerGroup!: THREE.Group;
  // Themed pen materials + lights (retinted per scene, see applyTheme).
  private floorMat: THREE.MeshStandardMaterial | null = null;
  private wallMat: THREE.MeshStandardMaterial | null = null;
  private rimMat: THREE.MeshStandardMaterial | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  /** Scene id currently painted (-1 = default palette, forces first apply). */
  private themedScene = -1;
  private themedGameTheme: GameThemeId | "" = "";
  private trayGroup!: THREE.Group;
  private traySlots: (THREE.Group | null)[] = new Array(TRAY_SLOTS).fill(null);
  private overlayGroup!: THREE.Group;

  private logicalItems: ItemInstance[] = [];
  private trayKinds: (number | null)[] = Array(TRAY_SLOTS).fill(null);
  private gameStatus = "idle";
  private level = 1;
  private themeId: GameThemeId = DEFAULT_THEME_ID;
  private lastDealNonce = -1;
  private lastShuffleNonce = 0;
  private lastHintNonce = 0;
  private lastShakeNonce = 0;
  private lastExtractReceiptNonce = 0;
  /** Tiny same-item duplicate-tap guard; different items remain rapid-pickable. */
  private duplicatePickGuardUntil = 0;
  private acceptedTraySlots = new Map<number, number>();
  private pendingHintKind: number | null = null;
  /** Ids currently mid hint-pulse, so a group + a pending pulse never fight. */
  private hintPulsing = new Set<number>();
  private pendingShakeStrength: number | null = null;
  /** Camera rest position — the shake offset oscillates around this. */
  private cameraBase = new THREE.Vector3();
  /** Wall-clock start of the current camera micro-shake (0 = idle). */
  private cameraShakeT0 = 0;
  private cameraShakeStrength = 1;
  private panShakeT0 = 0;
  private panShakeStrength = 1;
  /** Last clearedFx pulse consumed (dedupes repeated state pushes). */
  private lastClearedFx: number[] = [];
  private spawnQueue: ItemInstance[] = [];
  private spawnTimer = 0;
  private boxHalf = BOX_HALF;
  private boxHeight = BOX_HEIGHT;
  private containerPhysicsMaterial!: CannonMaterial;
  private physicsMaterials = new Map<PhysicsSurface, CannonMaterial>();
  private mobileQuality = false;
  private renderQuality: RenderQualityProfile = renderQualityProfile({ mobile: false });
  private rendererLabel = "unknown";

  private rafId = 0;
  private paused = false;
  private lastRafAt = 0;
  private frameAccumulatorMs = 0;
  /** Throttles the synchronous framebuffer health probe until one real frame passes. */
  private lastFrameHealthProbeAt = 0;
  private reducedMotion = false;
  private unsubState: (() => void) | null = null;
  private unsubReady: (() => void) | null = null;
  private unsubError: (() => void) | null = null;
  private unsubDestroy: (() => void) | null = null;
  private disposed = false;
  /** Last one-second production QA renderer sample (QA build only). */
  private lastDeviceQaTelemetryAt = 0;
  /** Cached URLSearchParams check — avoids per-frame allocation. */
  private deviceQaEnabled = false;
  /** Currently hovered visual for pre-pick feedback (null = none). */
  private hoveredVisual: ItemVisual | null = null;
  /** Invalidates every short-lived rAF effect across retry/theme/unmount. */
  private animationEpoch = 0;
  /** Invalidates only overlay particles/goose beats when overlays are replaced. */
  private overlayEpoch = 0;

  // ── ThreeSceneController contract ──────────────────────────────────────────

  mount(host: HTMLElement, bridge: GameBridge): void {
    // React StrictMode intentionally mounts, unmounts and remounts once in dev.
    // Re-arm the reusable controller so the second mount owns a live rAF loop.
    this.disposed = false;
    this.paused = false;
    this.lastRafAt = 0;
    this.lastFrameHealthProbeAt = 0;
    this.frameAccumulatorMs = 0;
    this.clock = new THREE.Clock();
    this.itemVisuals.clear();
    this.acceptedTraySlots.clear();
    this.pendingHintKind = null;
    this.pendingShakeStrength = null;
    this.lastDeviceQaTelemetryAt = 0;
    // The controller instance is intentionally reused across StrictMode's
    // mount/unmount probe. Reset every reconciliation cache so the bridge's
    // current snapshot is treated as authoritative on the second mount.
    this.logicalItems = [];
    this.trayKinds = Array(TRAY_SLOTS).fill(null);
    this.gameStatus = "__mount__";
    this.level = 1;
    this.themeId = DEFAULT_THEME_ID;
    this.lastDealNonce = -1;
    this.lastShuffleNonce = 0;
    this.lastHintNonce = 0;
    this.lastShakeNonce = 0;
    this.lastExtractReceiptNonce = 0;
    this.duplicatePickGuardUntil = 0;
    this.lastClearedFx = [];
    this.themedScene = -1;
    this.themedGameTheme = "";
    this.host = host;
    this.bridge = bridge;

    // Reduced motion preference.
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reducedMotion = mq?.matches ?? false;

    // Renderer sized to the host element (CSS pixels).
    const w = host.clientWidth || SCENE_W;
    const h = host.clientHeight || SCENE_H;
    this.mobileQuality = w <= 760 || (window.matchMedia?.("(pointer: coarse)").matches ?? false);
    const runtimeNavigator = navigator as Navigator & { deviceMemory?: number };
    const qualityHints = {
      mobile: this.mobileQuality,
      deviceMemoryGb: runtimeNavigator.deviceMemory,
      hardwareConcurrency: runtimeNavigator.hardwareConcurrency,
    };
    const provisionalQuality = renderQualityProfile(qualityHints);
    const rendererOptions: THREE.WebGLRendererParameters = {
      antialias: provisionalQuality.antialias,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
      stencil: false,
    };
    this.renderer = new THREE.WebGLRenderer({
      ...rendererOptions,
      // The scene never uses stencil operations; avoiding that attachment
      // lowers tile-memory pressure on mobile GPUs without changing visuals.
    });
    const gl = this.renderer.getContext();
    const rendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
    this.rendererLabel = rendererInfo
      ? String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL) ?? "unknown")
      : String(gl.getParameter(gl.RENDERER) ?? "unknown");
    this.renderQuality = renderQualityProfile({
      ...qualityHints,
      rendererLabel: this.rendererLabel,
    });
    this.renderer.setPixelRatio(Math.min(
      window.devicePixelRatio || 1,
      this.renderQuality.pixelRatioCap,
    ));
    // updateStyle=true: the canvas MUST get explicit CSS width/height, or on
    // dpr>=2 devices it lays out at its attribute size (2x the host, clipped
    // to a magnified top-left quadrant).
    this.renderer.setSize(w, h, true);
    this.renderer.domElement.dataset.gooseQualityTier = this.renderQuality.tier;
    this.renderer.domElement.dataset.gooseSoftwareRenderer = isSoftwareRendererLabel(this.rendererLabel)
      ? "true"
      : "false";
    this.renderer.shadowMap.enabled = this.renderQuality.shadows;
    this.renderer.shadowMap.type = this.renderQuality.tier === "constrained"
      ? THREE.PCFShadowMap
      : THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setClearColor(0x000000, 0);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.setupMaterialEnvironment();
    this.playfieldGroup = new THREE.Group();
    this.scene.add(this.playfieldGroup);
    this.containerGroup = new THREE.Group();
    this.playfieldGroup.add(this.containerGroup);

    this.camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    this.camera.position.set(0, 14, 0.9);
    this.camera.lookAt(0, 0.58, 0);
    this.cameraBase.copy(this.camera.position);

    this.setupLights();
    this.setupWorld();
    const initial = pileDimensions(specOf(1).boxSize);
    this.buildBox(initial.half, initial.height, this.themeId);
    this.frameCamera(initial.half, initial.height);
    this.buildTray();
    this.buildOverlay();
    this.applyTheme(this.level, this.themeId);

    // Bridge wiring.
    this.unsubState = bridge.on("state", (s) => this.applyState(s as GameState));
    this.unsubReady = bridge.on("ready", () => {});
    this.unsubError = bridge.on("error", () => {});
    this.unsubDestroy = bridge.on("destroy", () => this.unmount());

    // Seed from any state already pushed before mount.
    this.applyState(bridge.getState());

    bridge.notifyReady();

    // Pointer pick.
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    // Hover feedback — subtle emissive glow on the item under the pointer.
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerleave", this.onPointerLeave);

    // Cache the deviceQa URL flag once (avoids per-frame URLSearchParams alloc).
    this.deviceQaEnabled = new URLSearchParams(window.location.search).get("deviceQa") === "1";

    // Physics pauses while the tab is hidden; on return the accumulated clock
    // delta is discarded so the pile resumes exactly where it froze (paired
    // with the engine's countdown pause — the deadline shifts by the same gap).
    document.addEventListener("visibilitychange", this.onVisibilityChange);

    this.clock.start();
    this.loop();
  }

  setState(state: GameState): void {
    this.applyState(state);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (this.disposed) return;
    // Discard the time spent behind the DOM compatibility surface so the
    // first resumed frame cannot advance physics or spawn pacing in a burst.
    this.paused = false;
    this.clock.getDelta();
    this.lastRafAt = 0;
    this.frameAccumulatorMs = 0;
  }

  unmount(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.animationEpoch += 1;
    this.overlayEpoch += 1;
    cancelAnimationFrame(this.rafId);
    this.renderer?.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer?.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer?.domElement.removeEventListener("pointerleave", this.onPointerLeave);
    this.hoveredVisual = null;
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.unsubState?.();
    this.unsubReady?.();
    this.unsubError?.();
    this.unsubDestroy?.();
    // Dispose geometry/material/textures to avoid GPU leaks across remounts
    // (traverse-based, so composed Groups and the emoji Sprite are covered).
    if (this.scene) disposeObject(this.scene);
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.host) {
      this.host?.removeChild(this.renderer.domElement);
    }
    this.itemVisuals.clear();
    this.acceptedTraySlots.clear();
    this.pendingHintKind = null;
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xfffbef, 0xd4b995, 1.05);
    this.hemiLight = hemi;
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff7e8, 1.72);
    this.keyLight = key;
    key.position.set(-4.5, 13, 5.5);
    key.castShadow = true;
    const shadowSize = this.renderQuality.shadowMapSize;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    const d = 10;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8ecff, 0.5);
    fill.position.set(6, 7, -5);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd9b0, 0.36);
    rim.position.set(0, 4, -9);
    this.scene.add(rim);
  }

  private setupMaterialEnvironment(): void {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    // 0.035 stays inside Three's 20-sample PMREM blur budget on WebGL1/2 and
    // avoids clipping warnings while retaining a soft illustrated highlight.
    this.environmentTarget = pmrem.fromScene(room, 0.035);
    this.scene.environment = this.environmentTarget.texture;
    // Direct lights retain the bright illustrated look; this lower-intensity
    // environment contributes only the soft rim/reflection cues that separate
    // metal, glaze, ceramic, produce skin, paper and fabric at phone size.
    this.scene.environmentIntensity = this.mobileQuality ? 0.52 : 0.62;
    room.dispose();
    pmrem.dispose();
  }

  private setupWorld(): void {
    this.world = new World({ gravity: new Vec3(0, tuneGravity(), 0) });
    this.world.broadphase = new SAPBroadphase(this.world);
    this.world.allowSleep = true;
    // A few solver iterations is plenty for a small pile (the default World
    // solver is a GSSolver; the base Solver type just doesn't expose it).
    (this.world.solver as GSSolver).iterations = this.renderQuality.solverIterations;
    this.world.defaultContactMaterial.friction = 0.36;
    this.world.defaultContactMaterial.restitution = 0.08;
    this.world.defaultContactMaterial.contactEquationStiffness = 8e6;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;
    this.containerPhysicsMaterial = new CannonMaterial("container");
    this.physicsMaterials.clear();
    const surfaces = Object.keys(SURFACE_PHYSICS) as PhysicsSurface[];
    for (const surfaceName of surfaces) {
      const material = new CannonMaterial(`item-${surfaceName}`);
      this.physicsMaterials.set(surfaceName, material);
      const values = SURFACE_PHYSICS[surfaceName];
      this.world.addContactMaterial(new ContactMaterial(material, this.containerPhysicsMaterial, {
        friction: values.friction,
        restitution: values.restitution,
        contactEquationStiffness: 8e6,
        contactEquationRelaxation: 4,
      }));
    }
    for (let i = 0; i < surfaces.length; i += 1) {
      for (let j = i; j < surfaces.length; j += 1) {
        const a = surfaces[i]!;
        const b = surfaces[j]!;
        const av = SURFACE_PHYSICS[a];
        const bv = SURFACE_PHYSICS[b];
        this.world.addContactMaterial(new ContactMaterial(
          this.physicsMaterials.get(a)!,
          this.physicsMaterials.get(b)!,
          {
            friction: Math.sqrt(av.friction * bv.friction),
            restitution: Math.max(av.restitution, bv.restitution),
            contactEquationStiffness: 8e6,
            contactEquationRelaxation: 4,
          },
        ));
      }
    }
  }

  private buildBox(half: number, height: number, themeId: GameThemeId): void {
    this.boxHalf = half;
    this.boxHeight = height;
    const theme = themeOf(themeId);
    const container = theme.container;
    const texture = containerTexture(themeId);
    const round = container !== "wood-crate";
    // Visual container: woven basket, wood crate, or round bamboo tray. Physics
    // uses matching inward planes, while these meshes provide the final art.
    const floorGeo = round
      ? new THREE.CylinderGeometry(half + 0.18, half + 0.18, 0.4, 48)
      : new THREE.BoxGeometry(half * 2 + 0.4, 0.4, half * 2 + 0.4);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      bumpMap: texture,
      bumpScale: 0.055,
      roughness: 0.84,
    });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.containerGroup.add(floor);
    this.boxMeshes.push(floor);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      bumpMap: texture,
      bumpScale: container === "wood-crate" ? 0.075 : 0.055,
      roughness: container === "wood-crate" ? 0.7 : 0.78,
      transparent: true,
      opacity: container === "wood-crate" ? 0.9 : 0.86,
      side: THREE.DoubleSide,
    });
    this.wallMat = wallMat;
    const wallThick = 0.3;
    if (round) {
      const visualHeight = Math.max(0.54, height * 0.72);
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(half + 0.2, half + 0.2, visualHeight, 48, 1, true),
        wallMat,
      );
      wall.position.y = visualHeight / 2;
      wall.receiveShadow = true;
      this.containerGroup.add(wall);
      this.boxMeshes.push(wall);
    } else {
      const visualHeight = Math.max(0.58, height * 0.78);
      const wallDefs: [number, number, number, number, number, number][] = [
        [0, visualHeight / 2, -half - wallThick / 2, half * 2 + wallThick * 2, visualHeight, wallThick],
        [0, visualHeight / 2, half + wallThick / 2, half * 2 + wallThick * 2, visualHeight, wallThick],
        [-half - wallThick / 2, visualHeight / 2, 0, wallThick, visualHeight, half * 2 + wallThick * 2],
        [half + wallThick / 2, visualHeight / 2, 0, wallThick, visualHeight, half * 2 + wallThick * 2],
      ];
      for (const [x, y, z, sx, sy, sz] of wallDefs) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMat);
        wall.position.set(x, y, z);
        wall.receiveShadow = true;
        this.containerGroup.add(wall);
        this.boxMeshes.push(wall);
      }
    }

    // Container rim. The rectangular front edge stays low and the side rails
    // slope toward the back, opening the pile toward the player instead of
    // presenting a tall wall from a top-down view.
    const rimMat = new THREE.MeshStandardMaterial({ color: C.boxEdge, map: texture, roughness: 0.52, emissive: C.boxEdge, emissiveIntensity: 0.1 });
    this.rimMat = rimMat;
    if (round) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(half + 0.32, 0.13, 10, 48), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = Math.max(0.54, height * 0.72);
      this.containerGroup.add(rim);
      this.boxMeshes.push(rim);
    } else {
      const visualHeight = Math.max(0.58, height * 0.78);
      const points: Array<[THREE.Vector3, THREE.Vector3]> = [
        [new THREE.Vector3(-half, visualHeight, -half), new THREE.Vector3(half, visualHeight, -half)],
        [new THREE.Vector3(-half, visualHeight, half), new THREE.Vector3(half, visualHeight, half)],
        [new THREE.Vector3(-half, visualHeight, half), new THREE.Vector3(-half, visualHeight, -half)],
        [new THREE.Vector3(half, visualHeight, half), new THREE.Vector3(half, visualHeight, -half)],
      ];
      for (const [from, to] of points) {
        const direction = to.clone().sub(from);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, direction.length(), 12), rimMat);
        bar.position.copy(from).add(to).multiplyScalar(0.5);
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        this.containerGroup.add(bar);
        this.boxMeshes.push(bar);
      }
    }

    // Physics floor.
    const floorBody = new Body({ mass: 0, shape: new Plane(), material: this.containerPhysicsMaterial });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    floorBody.position.set(0, 0, 0);
    this.world.addBody(floorBody);
    // Physics walls facing inward.
    const makeWall = (nx: number, nz: number, px: number, pz: number) => {
      const b = new Body({ mass: 0, shape: new Plane(), material: this.containerPhysicsMaterial });
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, 0, nz));
      b.quaternion.set(q.x, q.y, q.z, q.w);
      b.position.set(px, 0, pz);
      this.world.addBody(b);
    };
    if (round) {
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        makeWall(-Math.cos(a), -Math.sin(a), Math.cos(a) * half, Math.sin(a) * half);
      }
    } else {
      makeWall(0, 1, 0, -half);
      makeWall(0, -1, 0, half);
      makeWall(1, 0, -half, 0);
      makeWall(-1, 0, half, 0);
    }

    this.addContainerDetails(themeId, container, half, height);
  }

  private addContainerDetails(
    themeId: GameThemeId,
    container: ReturnType<typeof themeOf>["container"],
    half: number,
    height: number,
  ): void {
    const detailMat = new THREE.MeshStandardMaterial({
      color: container === "wood-crate" ? 0x6f4227 : 0xc39053,
      map: containerTexture(themeId),
      roughness: 0.78,
    });
    if (container !== "wood-crate") {
      for (const y of [0.4, height * 0.31, height * 0.56]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(half + 0.23, 0.055, 7, 48), detailMat);
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        this.containerGroup.add(band);
        this.boxMeshes.push(band);
      }
      return;
    }
    const barGeoH = new THREE.BoxGeometry(half * 2 + 0.58, 0.12, 0.12);
    const barGeoV = new THREE.BoxGeometry(0.12, 0.12, half * 2 + 0.58);
    for (const y of container === "wood-crate" ? [0.55, height * 0.52, height - 0.38] : [0.55, 1.2, 1.85, height - 0.38]) {
      for (const z of [-half - 0.2, half + 0.2]) {
        if (z > 0 && y > height * 0.42) continue;
        const bar = new THREE.Mesh(barGeoH, detailMat);
        bar.position.set(0, y, z);
        this.containerGroup.add(bar);
        this.boxMeshes.push(bar);
      }
      for (const x of [-half - 0.2, half + 0.2]) {
        const bar = new THREE.Mesh(barGeoV, detailMat);
        bar.position.set(x, y, 0);
        this.containerGroup.add(bar);
        this.boxMeshes.push(bar);
      }
    }
  }

  private buildTray(): void {
    // The visible tray is React-owned below the canvas. Keep only invisible
    // world-space targets here so extracted objects can fly toward that single
    // tray; rendering a second row inside WebGL created a duplicate interface.
    this.trayGroup = new THREE.Group();
    this.trayGroup.visible = false;
    this.scene.add(this.trayGroup);
    this.layoutTray();
  }

  private layoutTray(): void {
    for (const child of [...this.trayGroup.children]) disposeObject(child);
    this.trayGroup.clear();
    this.traySlots = new Array(TRAY_SLOTS).fill(null);
    const gap = 0.88;
    const totalW = (TRAY_SLOTS - 1) * gap;
    const y = -0.75;
    const z = this.boxHalf + 1.8;
    for (let i = 0; i < TRAY_SLOTS; i += 1) {
      const x = -totalW / 2 + i * gap;
      const g = new THREE.Group();
      g.position.set(x, y, z);
      this.trayGroup.add(g);
      this.traySlots[i] = g;
    }
  }

  private buildOverlay(): void {
    this.overlayGroup = new THREE.Group();
    this.scene.add(this.overlayGroup);
  }

  /**
   * Repaint the pen with the themed palette of `level`'s scene (G4). Colors
   * are retinted in place on the shared materials — no geometry rebuilds, so
   * switching scenes is free even mid-session.
   */
  private applyTheme(level: number, themeId: GameThemeId): void {
    const sceneTheme = sceneOfLevel(level);
    if (sceneTheme.id === this.themedScene && themeId === this.themedGameTheme) return;
    this.themedScene = sceneTheme.id;
    this.themedGameTheme = themeId;
    const playerTheme = themeOf(themeId);
    // The generated photo backdrop lives behind an alpha WebGL canvas. The
    // level band subtly modulates light, while the chosen player theme owns the
    // physical container materials and dominant identity.
    this.scene.background = null;
    this.renderer?.setClearColor(0x000000, playerTheme.scene.clearAlpha);
    // Authored material textures own the container color; multiplying them by
    // a flat theme tint was the source of the previous muddy, cheap surface.
    this.floorMat?.color.set(0xffffff);
    this.wallMat?.color.set(0xffffff);
    if (this.rimMat) {
      this.rimMat.color.set(playerTheme.scene.rim);
      this.rimMat.emissive.set(playerTheme.scene.rim);
    }
    this.hemiLight?.groundColor.set(playerTheme.scene.hemiGround);
    this.hemiLight?.color.set(sceneTheme.palette.bg);
    this.keyLight?.color.set(playerTheme.scene.keyLight);
  }

  private rebuildPen(level: number, themeId: GameThemeId): void {
    if (this.containerGroup) {
      this.playfieldGroup.remove(this.containerGroup);
      disposeObject(this.containerGroup);
    }
    this.containerGroup = new THREE.Group();
    this.playfieldGroup.add(this.containerGroup);
    this.boxMeshes = [];
    this.floorMat = null;
    this.wallMat = null;
    this.rimMat = null;
    this.setupWorld();
    const dimensions = pileDimensions(specOf(level).boxSize);
    this.buildBox(dimensions.half, dimensions.height, themeId);
    this.frameCamera(dimensions.half, dimensions.height);
    this.layoutTray();
    this.themedScene = -1;
    this.themedGameTheme = "";
    this.applyTheme(level, themeId);
  }

  private frameCamera(half: number, height: number): void {
    // A true top-view orthographic camera keeps an object's authored size
    // stable whether it is on the floor or resting high in a full pile. This
    // removes the old perspective "giant foreground object" effect while
    // preserving real body overlap, rolling and depth ordering.
    const aspect = Math.max(
      0.5,
      (this.renderer?.domElement.clientWidth || SCENE_W)
        / Math.max(1, this.renderer?.domElement.clientHeight || SCENE_H),
    );
    const radius = half + 0.58;
    const horizontalHalf = aspect >= 1 ? radius * aspect : radius;
    const verticalHalf = aspect >= 1 ? radius : radius / aspect;
    this.camera.left = -horizontalHalf;
    this.camera.right = horizontalHalf;
    this.camera.top = verticalHalf;
    this.camera.bottom = -verticalHalf;
    const verticalBias = portraitCameraBias(aspect);
    // Move the orthographic view center, not the playfield group: this keeps
    // item-to-tray world coordinates and pan-toss physics perfectly aligned.
    this.camera.position.set(0, 14, 0.9 - verticalBias);
    this.camera.lookAt(0, Math.max(0.42, height * 0.46), -verticalBias);
    this.camera.updateProjectionMatrix();
    this.cameraBase.copy(this.camera.position);
  }

  // ── State reconciliation ─────────────────────────────────────────────────────

  private applyState(state: GameState): void {
    // Guard against pushes before (or after a failed) mount: the scene graph
    // only exists once mount() succeeded past renderer construction.
    if (!this.scene) return;
    if (!state || Object.keys(state).length === 0) return;
    const nextStatus = (state.gameStatus as string) ?? this.gameStatus;
    const nextLevel = Number(state.level ?? this.level) || this.level;
    const nextThemeId = themeOf(state.themeId ?? this.themeId).id;
    const items = (state.items as ItemInstance[] | undefined) ?? this.logicalItems;
    const tray = (state.tray as (number | null)[] | undefined) ?? this.trayKinds;
    const shelf = (state.shelf as (number | null)[] | undefined) ?? [];

    const statusChanged = nextStatus !== this.gameStatus;
    const levelChanged = nextLevel !== this.level;
    const gameThemeChanged = nextThemeId !== this.themeId;
    const dealNonce = Number(state.dealNonce ?? 0) || 0;
    const dealChanged = dealNonce !== this.lastDealNonce;
    const shuffleNonce = Number(state.shuffleNonce ?? 0) || 0;
    const hintNonce = Number(state.hintNonce ?? 0) || 0;
    const shakeNonce = Number(state.shakeNonce ?? 0) || 0;
    const shakeStrength = Math.max(0.65, Math.min(1.35, Number(state.shakeStrength ?? 1) || 1));
    const hintChanged = hintNonce !== this.lastHintNonce;
    if (hintChanged) this.lastHintNonce = hintNonce;
    const triggerHint = (): void => {
      if (hintNonce <= 0 || nextStatus !== "dealt") return;
      const plan = computeHintPlan(tray, shelf, items);
      if (plan.kind < 0) return;
      // Pulse the whole near-triple group that's still reachable in the box;
      // if none are visible yet (all buried), defer to the pending anchor.
      const pulsed = this.pulseHintGroup(plan.kind, plan.needFromBox);
      if (pulsed === 0) this.pendingHintKind = plan.kind;
    };

    // Authoritative pick acknowledgement: an accepted pick remembers the exact
    // engine-selected slot even if the third copy already cleared React state;
    // a rejected full-tray pick immediately returns to physics and raycasting.
    const receipt = state.extractReceipt as ExtractReceipt | null | undefined;
    if (!dealChanged && receipt && receipt.nonce > 0 && receipt.nonce !== this.lastExtractReceiptNonce) {
      this.lastExtractReceiptNonce = receipt.nonce;
      const visual = this.itemVisuals.get(receipt.itemId);
      if (receipt.accepted) {
        this.acceptedTraySlots.set(receipt.itemId, receipt.placedIndex);
        if (receipt.matched && receipt.clearedTray.length > 0) {
          const animationEpoch = this.animationEpoch;
          window.setTimeout(() => {
            if (this.disposed || animationEpoch !== this.animationEpoch) return;
            this.playClearPop(receipt.clearedTray, receipt.kind);
          }, TRAY_ENTRY_MOTION_MS + TRAY_MOTION_TIMINGS.highlightMs);
        }
      } else if (visual && !visual.flying) {
        visual.extracting = false;
        visual.mesh.scale.setScalar(visual.baseScale);
        visual.body.wakeUp();
      }
    }

    // The receipt schedules the clear celebration after the incoming item has
    // visibly grouped and held its highlight. Track clearedFx only for bridge
    // pulse deduplication; playing it immediately used to make the triple pop
    // before the third object had even reached the bar.
    const clearedNow = Array.isArray(state.clearedFx) ? (state.clearedFx as number[]) : [];
    if (clearedNow.length > 0 && !sameIndexList(clearedNow, this.lastClearedFx)) {
      this.lastClearedFx = clearedNow.slice();
    } else if (clearedNow.length === 0 && this.lastClearedFx.length > 0) {
      this.lastClearedFx = [];
    }

    const changedTrayIndices: number[] = [];
    for (let i = 0; i < TRAY_SLOTS; i += 1) {
      if (this.trayKinds[i] !== tray[i]) changedTrayIndices.push(i);
    }
    this.trayKinds = tray.slice();

    // ── Power-up: SHUFFLE (re-drop remaining box items with permuted kinds) ──
    if (shuffleNonce !== this.lastShuffleNonce) {
      this.lastShuffleNonce = shuffleNonce;
      if (shuffleNonce > 0 && nextStatus === "dealt") {
        this.logicalItems = items.slice();
        this.resetScene();
        this.queueSpawns(this.logicalItems);
      }
    }

    // ── Shake (G3 晃一晃): jolt every pile body + camera micro-shake ──
    if (shakeNonce !== this.lastShakeNonce) {
      this.lastShakeNonce = shakeNonce;
      if (shakeNonce > 0 && nextStatus === "dealt") this.applyShake(shakeStrength);
    }

    if (statusChanged || levelChanged || gameThemeChanged || dealChanged) {
      this.gameStatus = nextStatus;
      this.level = nextLevel;
      this.themeId = nextThemeId;
      this.lastDealNonce = dealNonce;
      if (levelChanged || gameThemeChanged) {
        this.resetScene();
        this.rebuildPen(nextLevel, nextThemeId);
      } else {
        this.applyTheme(nextLevel, nextThemeId);
      }
      if (nextStatus === "dealt") {
        // New level / retry → reset visuals.
        if (!levelChanged && !gameThemeChanged) this.resetScene();
        this.logicalItems = items.slice();
        this.queueSpawns(this.logicalItems);
        if (hintChanged) triggerHint();
      } else if (nextStatus === "solved") {
        // The final extract and the solved status may be batched into one state
        // push. Reconcile the removed body before returning to the win overlay
        // path so no last item remains orphaned behind the celebration.
        const liveIds = new Set(items.map((item) => item.id));
        for (const [id, visual] of this.itemVisuals) {
          if (!liveIds.has(id)) this.sendToTray(visual, this.acceptedTraySlots.get(id));
        }
        this.playWin();
      } else if (nextStatus === "expired") {
        this.playFail();
      } else {
        // idle / lobby → clear.
        this.resetScene();
      }
      return;
    }

    if (hintChanged) triggerHint();

    // During play, reconcile removed items (the engine removes them on extract).
    const liveIds = new Set(items.map((it) => it.id));
    for (const [id, vis] of this.itemVisuals) {
      if (!liveIds.has(id)) {
        // Item was extracted — fly it to its tray slot, then remove.
        this.sendToTray(vis, this.acceptedTraySlots.get(id));
      }
    }
    // …and ADDED items (G2 撤回: an undone grab returns to the top of the
    // pile). "Added" means absent from the PREVIOUS logical snapshot — an id
    // whose pick-dispatch is merely still in flight (extracting=true but still
    // listed) must NOT be treated as an add, or normal rapid play would kill
    // and respawn in-flight picks. A genuine undo mid-fly (id re-added while
    // its old visual still animates to the tray) cancels the fly and re-drops.
    const prevIds = new Set(this.logicalItems.map((it) => it.id));
    for (const it of items) {
      if (prevIds.has(it.id)) continue;
      const vis = this.itemVisuals.get(it.id);
      if (!vis) {
        if (!this.spawnQueue.some((q) => q.id === it.id)) this.spawnQueue.push(it);
      } else if (vis.extracting) {
        clearSettleCooldown(vis.body.id);
        this.world.removeBody(vis.body);
        this.playfieldGroup.remove(vis.mesh);
        disposeObject(vis.mesh);
        this.itemVisuals.delete(it.id);
        this.acceptedTraySlots.delete(it.id);
        this.spawnQueue.push(it);
      }
    }
    this.logicalItems = items.slice();

    // Reflect only slots whose kind actually changed. The timed mode pushes a
    // clock snapshot every 100ms; rebuilding all compound meshes on each tick
    // caused unnecessary mobile GPU allocations and garbage collection.
    for (const i of changedTrayIndices) this.refreshTraySlot(i);
  }

  private resetScene(): void {
    this.animationEpoch += 1;
    this.panShakeT0 = 0;
    this.cameraShakeT0 = 0;
    this.playfieldGroup?.rotation.set(0, 0, 0);
    this.playfieldGroup?.position.set(0, 0, 0);
    this.camera.position.copy(this.cameraBase);
    for (const vis of this.itemVisuals.values()) {
      this.playfieldGroup.remove(vis.mesh);
      clearSettleCooldown(vis.body.id);
      this.world.removeBody(vis.body);
      disposeObject(vis.mesh);
    }
    this.itemVisuals.clear();
    this.acceptedTraySlots.clear();
    this.duplicatePickGuardUntil = 0;
    this.spawnQueue = [];
    this.pendingHintKind = null;
    this.hintPulsing.clear();
    this.pendingShakeStrength = null;
    this.clearOverlay();
    this.layoutTray();
  }

  /** Clear the win/fail overlay, disposing its GPU resources (goose meshes,
   * emoji sprite CanvasTexture) instead of orphaning them. */
  private clearOverlay(): void {
    this.overlayEpoch += 1;
    for (const child of [...this.overlayGroup.children]) disposeObject(child);
    this.overlayGroup.clear();
  }

  // ── Spawning ────────────────────────────────────────────────────────────────

  private queueSpawns(items: ItemInstance[]): void {
    this.spawnQueue = items.slice();
    this.spawnTimer = 0;
  }

  private spawnNext(): void {
    const it = this.spawnQueue.shift();
    if (!it) return;
    const item = themeItem(this.themeId, it.kind);
    const physics = physicsProfileOf(this.themeId, it.kind);
    const mesh = buildThemeModelMesh(this.themeId, it.kind, item.color);
    mesh.castShadow = true;
    const spec = specOf(this.level);
    const logicalHalf = Math.max(1, spec.boxSize / 2 - 0.6);
    const usableHalf = this.boxHalf - 0.72;
    const sx = THREE.MathUtils.clamp((it.px / logicalHalf) * usableHalf, -usableHalf, usableHalf);
    const sz = THREE.MathUtils.clamp((it.pz / logicalHalf) * usableHalf, -usableHalf, usableHalf);
    const fromReservoir = it.spawnMode === "reservoir";
    const dropT = THREE.MathUtils.clamp(
      (it.py - spec.boxSize / 2) / Math.max(1, spec.boxSize),
      0,
      1,
    );
    // Initial bodies cascade from above. Refill packets are born just above
    // the floor under the live pile so contact resolution visibly pushes them
    // upward, reading as a deeper layer surfacing instead of repeated rain.
    const sy = fromReservoir
      ? 0.72 + deterministicUnit(it.id + 73, it.py) * 0.18
      : this.boxHeight + 1.7 + dropT * 3.4;
    mesh.position.set(sx, sy, sz);
    this.playfieldGroup.add(mesh);

    const body = makeItemBody(physics, this.physicsMaterials.get(physics.surface));
    body.position.set(sx, sy, sz);
    const [rx, ry, rz] = initialPileEuler(
      physics,
      deterministicUnit(it.id, it.px),
      deterministicUnit(it.id + 17, it.py),
      deterministicUnit(it.id + 31, it.pz),
    );
    body.quaternion.setFromEuler(rx, ry, rz);
    body.velocity.set(0, fromReservoir ? 0.62 : -2, 0);
    const spin = 3.8 / Math.sqrt(Math.max(0.28, physics.mass));
    const streamSpin = fromReservoir ? 0.58 : 1;
    body.angularVelocity.set(
      (rx / Math.PI - 0.5) * spin * streamSpin,
      (ry / Math.PI - 0.5) * spin * streamSpin,
      (rz / Math.PI - 0.5) * spin * streamSpin,
    );
    this.world.addBody(body);

    // Landing thud — volume scales with impact speed; resting jitter is filtered
    // out by the velocity threshold (set in sound.play).
    body.addEventListener("collide", (e: { contact: { getImpactVelocityAlongNormal(): number } }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.2) sound.play("land", Math.min(1, v / 6));
    });

    this.itemVisuals.set(it.id, {
      id: it.id,
      kind: it.kind,
      mesh,
      body,
      extracting: false,
      flying: false,
      baseScale: mesh.scale.x,
      spawned: true,
      profile: physics,
      hovered: false,
    });
    if (this.pendingHintKind === it.kind) {
      this.pendingHintKind = null;
      requestAnimationFrame(() => this.pulseHint(it.kind));
    }
    // A shake made during the short cascade-in window is never wasted. Wait
    // until the final body exists, then apply the cached capped impulse to the
    // complete pile (the visual pan feedback already played on the gesture).
    if (this.spawnQueue.length === 0 && this.pendingShakeStrength !== null) {
      const pending = this.pendingShakeStrength;
      this.pendingShakeStrength = null;
      requestAnimationFrame(() => this.applyShake(pending, false));
    }
  }

  // ── Tray HUD ────────────────────────────────────────────────────────────────

  private refreshTraySlot(_i: number): void {
    // React's atlas-backed tray is the only visible tray. This method remains
    // as the state reconciliation seam but deliberately allocates no 3D mesh.
  }

  private sendToTray(vis: ItemVisual, acceptedSlot?: number): void {
    if (vis.flying) return;
    vis.flying = true;
    // The receipt carries the exact pre-clear landing slot. This remains valid
    // for the third copy even though React's tray is already empty again.
    const slotIdx = Number.isInteger(acceptedSlot) && acceptedSlot! >= 0
      ? acceptedSlot!
      : this.trayKinds.findIndex((k) => k === vis.kind);
    const target = slotIdx >= 0 ? this.traySlots[slotIdx]?.position.clone() : new THREE.Vector3(0, this.boxHeight + 1.1, 0);
    vis.extracting = true;
    clearSettleCooldown(vis.body.id);
    this.world.removeBody(vis.body);
    // Cannon does not wake sleeping bodies when their supporting body is
    // removed. Rebuild the pile's contact chain immediately so unsupported
    // objects fall instead of remaining frozen in mid-air.
    resettlePileAfterSupportRemoval(
      [...this.itemVisuals.values()].map((visual) => ({
        body: visual.body,
        profile: physicsProfileOf(this.themeId, visual.kind),
        seed: visual.id,
      })),
      vis.body,
    );
    // Animate the mesh up to the tray then remove (the HUD slot is re-rendered by React state).
    const start = vis.mesh.position.clone();
    // Shrink relative to the model's current scale (base 0.62 from
    // buildThemeModelMesh, possibly popped by press feedback) instead of stomping
    // it with an absolute value.
    const startScale = vis.mesh.scale.x;
    const t0 = performance.now();
    const dur = this.reducedMotion ? 1 : TRAY_ENTRY_MOTION_MS;
    const animationEpoch = this.animationEpoch;
    const step = () => {
      if (this.disposed || animationEpoch !== this.animationEpoch) return;
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = easeInOutCubic(t);
      const end = target ?? new THREE.Vector3();
      vis.mesh.position.lerpVectors(start, end, e);
      // A readable scoop arc keeps the selected object's identity visible all
      // the way to the bar. Use the same eased progress for position, scale and
      // spin so the 3D object visually hands off to the React tray in one beat.
      vis.mesh.position.y += Math.sin(e * Math.PI) * SCENE_MOTION.trayFlightArcY;
      vis.mesh.rotation.y += SCENE_MOTION.trayFlightSpinStep * (1 - e);
      vis.mesh.scale.setScalar(startScale * (1 - (1 - SCENE_MOTION.trayFlightEndScale) * e));
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        vis.mesh.position.copy(end);
        vis.mesh.scale.setScalar(startScale * SCENE_MOTION.trayFlightEndScale);
        this.playfieldGroup.remove(vis.mesh);
        disposeObject(vis.mesh);
        // Identity check: an undo during the fly may have already replaced
        // this id with a fresh re-dropped visual — never delete that one.
        if (this.itemVisuals.get(vis.id) === vis) this.itemVisuals.delete(vis.id);
        this.acceptedTraySlots.delete(vis.id);
      }
    };
    if (!this.reducedMotion) requestAnimationFrame(step);
    else step();
  }

  // ── 3-match clear celebration ───────────────────────────────────────────────

  /**
   * Pop the 3 just-cleared tray minis: a ghost mini scales up + fades at each
   * cleared slot while a small particle burst scatters in the kind's color.
   * The match/combo SFX is already played by the engine at clear time.
   * Reduced motion: skip entirely — the slots empty instantly (refreshTraySlot).
   */
  private playClearPop(indices: number[], kind: number | null): void {
    if (this.reducedMotion || kind === null) return;
    const item = themeItem(this.themeId, kind);
    for (const idx of indices) {
      const slot = this.traySlots[idx];
      if (!slot) continue;
      const origin = slot.position.clone().add(new THREE.Vector3(0, 0.28, 0));
      this.spawnPopMini(kind, item.color, origin);
      this.spawnPopBurst(item.color, origin);
    }
  }

  /** Ghost mini at a cleared slot: quick scale-up + rise + fade, then dispose. */
  private spawnPopMini(kind: number, color: number, origin: THREE.Vector3): void {
    const mini = buildThemeModelMesh(this.themeId, kind, color, 0.3);
    mini.position.copy(origin);
    this.overlayGroup.add(mini);
    const meshes = collectMeshes(mini);
    const sprites = collectSprites(mini);
    for (const m of meshes) {
      const mm = m.material as THREE.MeshStandardMaterial;
      if (mm) {
        mm.transparent = true;
        mm.depthWrite = false;
      }
    }
    sprites.forEach((sprite) => { sprite.material.transparent = true; });
    const t0 = performance.now();
    const dur = SCENE_MOTION.popMiniMs;
    const overlayEpoch = this.overlayEpoch;
    const step = (): void => {
      if (this.disposed || overlayEpoch !== this.overlayEpoch) return;
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = easeOutCubic(t);
      mini.scale.setScalar(0.3 * (1 + 0.9 * e));
      mini.position.y = origin.y + 0.35 * e;
      const fade = Math.max(0, 1 - t * t);
      for (const m of meshes) {
        const mm = m.material as THREE.MeshStandardMaterial;
        if (mm) mm.opacity = fade;
      }
      sprites.forEach((sprite) => { sprite.material.opacity = fade; });
      if (t < 1) requestAnimationFrame(step);
      else {
        this.overlayGroup.remove(mini);
        disposeObject(mini);
      }
    };
    requestAnimationFrame(step);
  }

  /** Small radial particle burst in the cleared kind's color (InstancedMesh). */
  private spawnPopBurst(color: number, origin: THREE.Vector3): void {
    const count = 10;
    const geo = new THREE.TetrahedronGeometry(0.09);
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      emissive: color,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });
    // Single InstancedMesh = 1 draw call instead of 10 individual Meshes.
    const instanced = new THREE.InstancedMesh(geo, mat, count);
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const parts: { vel: THREE.Vector3; spin: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      parts.push({
        vel: new THREE.Vector3(
          Math.cos(a) * (1.2 + Math.random() * 0.9),
          1.8 + Math.random() * 1.3,
          Math.sin(a) * (1.2 + Math.random() * 0.9),
        ),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
      });
      // Initial transform at origin.
      dummy.position.copy(origin);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    this.overlayGroup.add(instanced);
    const t0 = performance.now();
    const dur = SCENE_MOTION.popBurstMs;
    const overlayEpoch = this.overlayEpoch;
    let last = t0;
    const positions = parts.map(() => origin.clone());
    const rotations = parts.map(() => new THREE.Euler());
    const step = (): void => {
      if (this.disposed || overlayEpoch !== this.overlayEpoch) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = Math.min(1, (now - t0) / dur);
      for (let i = 0; i < count; i += 1) {
        const p = parts[i]!;
        p.vel.y -= 7.5 * dt;
        positions[i]!.addScaledVector(p.vel, dt);
        rotations[i]!.x += p.spin.x * dt;
        rotations[i]!.y += p.spin.y * dt;
        rotations[i]!.z += p.spin.z * dt;
        dummy.position.copy(positions[i]!);
        dummy.rotation.copy(rotations[i]!);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t * t);
      mat.emissiveIntensity = 0.4 * (1 - t);
      if (t < 1) requestAnimationFrame(step);
      else {
        this.overlayGroup.remove(instanced);
        geo.dispose();
        mat.dispose();
        instanced.dispose();
      }
    };
    requestAnimationFrame(step);
  }

  // ── Win / Fail sequences ────────────────────────────────────────────────────

  private playWin(): void {
    sound.play("win");
    this.clearOverlay();
    // The celebration goose wears the CURRENT scene's limited-edition outfit
    // (scarf + primitive hat) so every scene's win moment reads distinct.
    const goose = buildGoose(sceneOfLevel(this.level).goose);
    goose.scale.setScalar(1.5);
    goose.position.set(0, this.boxHeight + 1.8, 0);
    goose.rotation.y = Math.PI * 0.1;
    this.overlayGroup.add(goose);
    if (!this.reducedMotion) {
      this.spawnWinConfetti();
      const overlayEpoch = this.overlayEpoch;
      let t = 0;
      let lastBobAt = performance.now();
      const bob = () => {
        if (this.disposed || overlayEpoch !== this.overlayEpoch) return;
        const now = performance.now();
        t += Math.min(0.05, (now - lastBobAt) / 1000);
        lastBobAt = now;
        goose.position.y = this.boxHeight + 1.8 + Math.sin(t * 3) * 0.3;
        goose.rotation.y = Math.PI * 0.1 + Math.sin(t * 1.5) * 0.3;
        if (t < SCENE_MOTION.winBobMs / 1_000) requestAnimationFrame(bob);
      };
      bob();
    }
  }

  /** Celebratory confetti rain — 40 colorful instanced quads with gravity + tumble. */
  private spawnWinConfetti(): void {
    const count = SCENE_MOTION.winConfettiCount;
    const geo = new THREE.PlaneGeometry(0.12, 0.18);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      roughness: 0.6,
      metalness: 0.1,
    });
    const instanced = new THREE.InstancedMesh(geo, mat, count);
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Per-instance colors from a celebratory palette.
    const palette = [0x16c784, 0xf59e0b, 0xef4444, 0x7c3aed, 0x3b82f6, 0xec4899];
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      color.setHex(palette[i % palette.length]!);
      instanced.setColorAt(i, color);
    }
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;

    const dummy = new THREE.Object3D();
    const spread = this.boxHalf * 1.6;
    const parts: { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i += 1) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        this.boxHeight + 2.5 + Math.random() * 2,
        (Math.random() - 0.5) * spread,
      );
      parts.push({
        pos,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.2, -0.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1.2),
        rot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        spin: new THREE.Vector3(3 + Math.random() * 6, 2 + Math.random() * 5, 4 + Math.random() * 7),
      });
      dummy.position.copy(pos);
      dummy.rotation.copy(parts[i]!.rot);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    this.overlayGroup.add(instanced);

    const t0 = performance.now();
    const dur = SCENE_MOTION.winConfettiMs;
    const overlayEpoch = this.overlayEpoch;
    let last = t0;
    const step = (): void => {
      if (this.disposed || overlayEpoch !== this.overlayEpoch) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = Math.min(1, (now - t0) / dur);
      for (let i = 0; i < count; i += 1) {
        const p = parts[i]!;
        p.vel.y -= 3.2 * dt; // gentle gravity
        p.vel.x += Math.sin(now * 0.003 + i) * 0.4 * dt; // wind flutter
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.spin.x * dt;
        p.rot.y += p.spin.y * dt;
        p.rot.z += p.spin.z * dt;
        dummy.position.copy(p.pos);
        dummy.rotation.copy(p.rot);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
      mat.opacity = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
      if (t < 1) requestAnimationFrame(step);
      else {
        this.overlayGroup.remove(instanced);
        geo.dispose();
        mat.dispose();
        instanced.dispose();
      }
    };
    requestAnimationFrame(step);
  }

  private playFail(): void {
    sound.play("fail");
    this.clearOverlay();
    // The React dialog carries the readable loss reason. The 3D layer supplies
    // a short, original runaway-goose beat instead of a generated canvas glyph.
    const goose = buildGoose(sceneOfLevel(this.level).goose);
    goose.scale.setScalar(0.95);
    goose.position.set(-this.boxHalf * 0.7, this.boxHeight + 0.85, 0);
    goose.rotation.y = -0.45;
    this.overlayGroup.add(goose);
    if (!this.reducedMotion) {
      const overlayEpoch = this.overlayEpoch;
      const start = performance.now();
      const run = (): void => {
        if (this.disposed || overlayEpoch !== this.overlayEpoch) return;
        const t = Math.min(1, (performance.now() - start) / SCENE_MOTION.failRunMs);
        const e = easeInOutCubic(t);
        goose.position.x = THREE.MathUtils.lerp(-this.boxHalf * 0.7, this.boxHalf * 1.45, e);
        goose.position.y = this.boxHeight + 0.85 + Math.abs(Math.sin(e * Math.PI * 5)) * 0.22;
        goose.rotation.z = Math.sin(e * Math.PI * 5) * 0.08;
        if (t < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }
  }

  // ── Hint logic ──────────────────────────────────────────────────────────────

  /**
   * Pick the most useful kind to surface for a hint, and how many copies of it
   * are still needed from the box to complete (or advance) a triple. Delegates
   * to the pure `computeHintPlan` in ../logic/hint-plan so the selection rule
   * stays unit-tested away from the renderer.
   */
  private pulseVisual(target: ItemVisual): void {
    if (this.hintPulsing.has(target.id)) return;
    this.hintPulsing.add(target.id);
    const reduced = this.reducedMotion;
    const meshes = collectMeshes(target.mesh);
    const sprites = collectSprites(target.mesh);
    const tint = new THREE.Color(C.brand);
    const baseScale = target.mesh.scale.x;
    const t0 = performance.now();
    const dur = SCENE_MOTION.hintPulseMs;
    const animationEpoch = this.animationEpoch;
    const clear = (): void => {
      meshes.forEach((m) => { const mm = m.material as THREE.MeshStandardMaterial; if (mm) mm.emissiveIntensity = 0; });
      sprites.forEach((sprite) => sprite.material.color.setHex(0xffffff));
      target.mesh.scale.setScalar(baseScale);
      target.mesh.position.y = target.body.position.y;
    };
    const step = (): void => {
      if (this.disposed || animationEpoch !== this.animationEpoch) { this.hintPulsing.delete(target.id); return; }
      if (!this.itemVisuals.has(target.id)) { clear(); this.hintPulsing.delete(target.id); return; }
      const t = (performance.now() - t0) / dur;
      if (t >= 1) { clear(); this.hintPulsing.delete(target.id); return; }
      const e = easeInOutCubic(Math.min(1, t));
      const p = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(e * Math.PI * 6);
      meshes.forEach((m) => {
        const mm = m.material as THREE.MeshStandardMaterial;
        if (mm) { mm.emissive = tint; mm.emissiveIntensity = p * 1.6; }
      });
      const spriteTint = new THREE.Color(0xffffff).lerp(tint, 0.34 * p);
      sprites.forEach((sprite) => sprite.material.color.copy(spriteTint));
      if (!reduced) {
        // The object itself is the feedback: a gentle lift/breath makes the
        // target unmistakable without drawing a stripe, cross, ring, or other
        // identity marker over the authored model.
        target.mesh.scale.setScalar(baseScale + p * 0.26);
        // Lift it above the nearest layer so the authored silhouette can be
        // read in a dense pile; the motion ends back at the physics body and
        // never paints a badge, stripe, cross, or other identity decoration.
        target.mesh.position.y = target.body.position.y + p * 0.42;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Pulse the whole near-triple group still reachable in the box: up to
   * `needFromBox` visible, non-flying copies of `kind`, most accessible first
   * (highest in the pile = easiest to click). Returns how many were pulsed. */
  private pulseHintGroup(kind: number, needFromBox: number): number {
    const targets: ItemVisual[] = [];
    for (const v of this.itemVisuals.values()) {
      if (v.extracting || v.kind !== kind) continue;
      targets.push(v);
    }
    targets.sort((a, b) => b.body.position.y - a.body.position.y);
    const n = Math.min(needFromBox, targets.length);
    for (let i = 0; i < n; i += 1) {
      const v = targets[i];
      if (v) this.pulseVisual(v);
    }
    return n;
  }

  /** Thin wrapper used by the pending-hint path: pulse the single highest box
   * item of `kind` once a buried copy surfaces. Returns false if none visible. */
  private pulseHint(kind: number): boolean {
    let target: ItemVisual | undefined;
    for (const v of this.itemVisuals.values()) {
      if (v.extracting || v.kind !== kind) continue;
      if (!target || v.body.position.y > target.body.position.y) target = v;
    }
    if (!target) return false;
    this.pulseVisual(target);
    return true;
  }

  // ── Shake (G3 晃一晃) ───────────────────────────────────────────────────────

  /**
   * Jolt the pile: every settled body gets a random capped impulse (mostly
   * upward, some lateral scatter) so buried items surface. The pen's physics
   * walls are infinite planes, so no impulse can throw an item out sideways;
   * the cap keeps the vertical hop well below the drop height. A camera
   * micro-shake sells the jolt — skipped under prefers-reduced-motion (the
   * physics re-settle is the information, the camera wobble is decoration).
   */
  private applyShake(strength = 1, visualFeedback = true): void {
    const dynamics = shakeDynamics(strength);
    const scale = dynamics.intensity;
    if (this.spawnQueue.length > 0) {
      this.pendingShakeStrength = Math.max(this.pendingShakeStrength ?? 0, strength);
      if (visualFeedback) this.startShakeFeedback(scale);
      return;
    }
    // A small toss disturbs the exposed half; a hard toss progressively reaches
    // the whole pile. Selection is stable per item/shake but every run differs.
    const affectedRatio = dynamics.affectedRatio;
    const visuals = [...this.itemVisuals.values()];
    for (const vis of visuals) {
      if (vis.extracting) continue;
      if (deterministicUnit(vis.id + this.lastShakeNonce * 97, vis.body.position.y) > affectedRatio) continue;
      vis.body.wakeUp();
      const lateralCap = dynamics.lateralImpulse;
      const vertical = dynamics.verticalImpulseMin
        + Math.random() * (dynamics.verticalImpulseMax - dynamics.verticalImpulseMin);
      const impulse = new Vec3(
        (Math.random() * 2 - 1) * lateralCap,
        vertical,
        (Math.random() * 2 - 1) * lateralCap,
      );
      vis.body.applyImpulse(impulse);
      // Hard caps keep the toss playful without launching bodies over the rim.
      vis.body.velocity.x = THREE.MathUtils.clamp(vis.body.velocity.x, -dynamics.maxHorizontalVelocity, dynamics.maxHorizontalVelocity);
      vis.body.velocity.y = THREE.MathUtils.clamp(vis.body.velocity.y, -3.5, dynamics.maxVerticalVelocity);
      vis.body.velocity.z = THREE.MathUtils.clamp(vis.body.velocity.z, -dynamics.maxHorizontalVelocity, dynamics.maxHorizontalVelocity);
      const angularCap = dynamics.angularVelocity;
      vis.body.angularVelocity.set(
        (Math.random() * 2 - 1) * angularCap,
        (Math.random() * 2 - 1) * angularCap,
        (Math.random() * 2 - 1) * angularCap,
      );
    }
    if (visualFeedback) this.startShakeFeedback(scale);
  }

  private startShakeFeedback(scale: number): void {
    if (this.reducedMotion) return;
    const now = performance.now();
    this.cameraShakeT0 = now;
    this.cameraShakeStrength = scale;
    this.panShakeT0 = now;
    this.panShakeStrength = scale;
  }

  /** Per-frame camera micro-shake: damped noise around the rest position. */
  private updateCameraShake(): void {
    if (this.cameraShakeT0 === 0) return;
    const SHAKE_MS = SCENE_MOTION.cameraShakeMs;
    const t = (performance.now() - this.cameraShakeT0) / SHAKE_MS;
    if (t >= 1) {
      this.cameraShakeT0 = 0;
      this.camera.position.copy(this.cameraBase);
      return;
    }
    const damp = (1 - t) * (1 - t);
    const amp = SCENE_MOTION.cameraShakeAmplitude * this.cameraShakeStrength * damp;
    this.camera.position.set(
      this.cameraBase.x + Math.sin(t * 40) * amp,
      this.cameraBase.y + Math.sin(t * 53 + 1.7) * amp * 0.6,
      this.cameraBase.z + Math.cos(t * 47 + 0.6) * amp,
    );
  }

  /** Visual basket tilt/rebound that sells the coordinated pan-toss gesture. */
  private updatePanShake(): void {
    if (this.panShakeT0 === 0 || !this.playfieldGroup) return;
    const duration = SCENE_MOTION.panTossMs;
    const t = (performance.now() - this.panShakeT0) / duration;
    if (t >= 1) {
      this.panShakeT0 = 0;
      this.playfieldGroup.rotation.set(0, 0, 0);
      this.playfieldGroup.position.set(0, 0, 0);
      return;
    }
    const e = easeInOutCubic(t);
    const damp = Math.pow(1 - e, SCENE_MOTION.panDampingPower);
    const toss = Math.sin(e * Math.PI * 3.2);
    const rebound = Math.sin(e * Math.PI * 6.4 + 0.7);
    // This is a coordinated visual pan motion (container + item meshes), while
    // the capped Cannon impulses above remain the authoritative physics. A
    // stronger visible arc therefore reads as “颠锅” without increasing the
    // risk of launching bodies over the rim.
    this.playfieldGroup.rotation.z = toss * SCENE_MOTION.panRollAmplitude * this.panShakeStrength * damp;
    this.playfieldGroup.rotation.x = rebound * SCENE_MOTION.panPitchAmplitude * this.panShakeStrength * damp;
    this.playfieldGroup.position.x = toss * SCENE_MOTION.panOffsetX * this.panShakeStrength * damp;
    this.playfieldGroup.position.z = rebound * SCENE_MOTION.panOffsetZ * this.panShakeStrength * damp;
    this.playfieldGroup.position.y = Math.max(0, Math.sin(e * Math.PI * 2)) * SCENE_MOTION.panLiftY * this.panShakeStrength * damp;
  }

  // ── Pointer pick ────────────────────────────────────────────────────────────

  /** Keyboard equivalent: pull the highest currently exposed body. */
  activatePrimary(): void {
    if (this.gameStatus !== "dealt") return;
    const picked = [...this.itemVisuals.values()]
      .filter((visual) => !visual.extracting)
      .sort((a, b) => b.body.position.y - a.body.position.y)[0];
    if (picked) this.beginPick(picked);
  }

  private beginPick(picked: ItemVisual): void {
    if (
      picked.extracting
      || this.gameStatus !== "dealt"
    ) return;
    // Cover only the same visual's synchronous dispatch/receipt gap. Do not
    // globally lock the pile: rapid different-item picks are a core interaction,
    // and the React tray already queues receipts for readable choreography.
    this.duplicatePickGuardUntil = duplicatePickGuardUntil(performance.now());
    picked.extracting = true;
    sound.play("pick");
    haptics.play("pick");
    if (!this.reducedMotion) picked.mesh.scale.multiplyScalar(SCENE_MOTION.pickPressScale);
    this.bridge?.dispatch("extract", { itemId: picked.id, kind: picked.kind });
  }

  private onPointerDown = (ev: PointerEvent): void => {
    if (!this.renderer || this.gameStatus !== "dealt") return;
    // First canvas tap is a user gesture → unlock audio (covers mobile Safari).
    sound.unlock();
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    // Ensure world matrices are current before raycasting (the render loop
    // normally keeps them fresh; this also covers a pick before first paint).
    this.camera.updateMatrixWorld();
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Item visuals are composed Groups (Group.raycast is a no-op): intersect
    // recursively so the child Meshes are tested, then backtrack the nearest
    // hit up its parent chain to the owning item root (see pick.ts). Nearest
    // hit wins, so a fully occluded item can't steal the pick.
    const roots = new Map<THREE.Object3D, ItemVisual>();
    for (const v of this.itemVisuals.values()) {
      if (!v.extracting) roots.set(v.mesh, v);
    }
    const picked = pickItemAt(this.raycaster, roots) ?? pickItemNearPointer(
      this.camera,
      roots,
      this.pointer,
      { width: rect.width, height: rect.height },
      this.mobileQuality ? 34 : 22,
    );
    if (!picked) return;
    // Synchronous in-flight guard: flag the visual BEFORE the async React
    // round-trip so a same-frame double-tap can't dispatch a duplicate
    // extract (the roots filter above skips extracting visuals).
    this.beginPick(picked);
  };

  /** Hover feedback: subtle emissive glow on the item under the pointer. */
  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.renderer || this.gameStatus !== "dealt" || this.reducedMotion) return;
    // Throttle hover raycasts to ~30Hz to avoid GPU overhead on high-Hz mice.
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const roots = new Map<THREE.Object3D, ItemVisual>();
    for (const v of this.itemVisuals.values()) {
      if (!v.extracting) roots.set(v.mesh, v);
    }
    const hit = pickItemAt(this.raycaster, roots);
    const newHovered = hit ?? null;

    if (newHovered === this.hoveredVisual) return;
    // Clear previous hover glow.
    if (this.hoveredVisual) {
      this.setHoverGlow(this.hoveredVisual, false);
      this.hoveredVisual.hovered = false;
    }
    // Apply new hover glow.
    if (newHovered) {
      this.setHoverGlow(newHovered, true);
      newHovered.hovered = true;
    }
    this.hoveredVisual = newHovered;
    // Cursor feedback.
    this.renderer.domElement.style.cursor = newHovered ? "pointer" : "default";
  };

  private onPointerLeave = (): void => {
    if (this.hoveredVisual) {
      this.setHoverGlow(this.hoveredVisual, false);
      this.hoveredVisual.hovered = false;
      this.hoveredVisual = null;
    }
    if (this.renderer) this.renderer.domElement.style.cursor = "default";
  };

  /** Toggle a subtle emissive glow on all child meshes of an item visual. */
  private setHoverGlow(vis: ItemVisual, on: boolean): void {
    vis.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (on) {
          child.material.emissive.setHex(0x16c784);
          child.material.emissiveIntensity = 0.18;
        } else {
          child.material.emissive.setHex(0x000000);
          child.material.emissiveIntensity = 0;
        }
      }
    });
  }

  // ── Render loop ─────────────────────────────────────────────────────────────

  /** Tab became visible again: throw away the delta accumulated while hidden
   * so physics + spawn pacing resume from a standstill instead of a jump. */
  private onVisibilityChange = (): void => {
    if (!document.hidden) {
      this.clock.getDelta();
      this.lastRafAt = 0;
      this.frameAccumulatorMs = 0;
    }
  };

  private loop = (rafNow = performance.now()): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    // Hidden tab → hard pause. Most browsers stop rAF while hidden anyway;
    // this guard covers the ones that keep throttled frames alive.
    if (document.hidden || this.paused) return;
    // Rendering above 60Hz repeats the same fixed-step physics state and can
    // nearly double GPU work on 90/120Hz phones. A small accumulator keeps an
    // average 60Hz cadence without the 90Hz→45Hz aliasing of a simple timeout.
    if (this.lastRafAt === 0) this.lastRafAt = rafNow;
    this.frameAccumulatorMs += Math.max(0, Math.min(100, rafNow - this.lastRafAt));
    this.lastRafAt = rafNow;
    const targetFrameMs = 1000 / 60;
    if (this.frameAccumulatorMs + 0.25 < targetFrameMs) return;
    this.frameAccumulatorMs %= targetFrameMs;
    const rawDt = this.clock.getDelta();

    // Spawn queued items gradually so they cascade in. Pace with the UNCLAMPED
    // elapsed time so spawning still progresses under frame drops / throttled
    // rAF (otherwise spawnTimer can stay just below the interval forever).
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += rawDt;
      const interval = 0.035;
      let spawnedThisFrame = 0;
      let streamedThisFrame = 0;
      while (
        this.spawnTimer >= interval
        && this.spawnQueue.length > 0
        && spawnedThisFrame < 2
      ) {
        const fromReservoir = this.spawnQueue[0]?.spawnMode === "reservoir";
        if (fromReservoir && streamedThisFrame >= 1) break;
        this.spawnTimer -= interval;
        this.spawnNext();
        spawnedThisFrame += 1;
        if (fromReservoir) streamedThisFrame += 1;
      }
      // Do not repay an arbitrarily large background-tab/render-stall debt in
      // one burst; concentrated overlap correction is what launches bodies.
      this.spawnTimer = Math.min(this.spawnTimer, interval * 2);
    }

    // Variable-step physics: fixed 1/60 internal step fed with the REAL
    // elapsed time (clamped so a tab refocus can't explode the pile) and up
    // to 3 catch-up substeps. A bare step(1/60) would advance exactly one
    // fixed step per rAF, scaling game speed with the display refresh rate
    // (2x on 120Hz, slow-motion under throttling).
    this.world.step(1 / 60, Math.min(rawDt, 0.1), 3);

    // Sync mesh transforms from bodies (skip extracting items).
    const settleNow = performance.now();
    for (const vis of this.itemVisuals.values()) {
      if (vis.extracting) continue;
      const nearlySettled = vis.body.velocity.lengthSquared() < 0.045
        && vis.body.angularVelocity.lengthSquared() < 0.035;
      if (vis.body.sleepState === Body.SLEEPING || nearlySettled) {
        // Use the cached profile (avoids per-frame physicsProfileOf allocation)
        // and pass timestamp for the proportional cooldown in pile-dynamics.
        if (!settleReadableFace(vis.body, vis.profile, settleNow)
          && !settleReadableUpright(vis.body, vis.profile, settleNow)) {
          tipUprightSideRestBody(vis.body, vis.profile, vis.id);
        }
      }
      vis.mesh.position.set(vis.body.position.x, vis.body.position.y, vis.body.position.z);
      vis.mesh.quaternion.set(
        vis.body.quaternion.x, vis.body.quaternion.y,
        vis.body.quaternion.z, vis.body.quaternion.w,
      );
    }

    // Camera micro-shake (G3) — a no-op unless a shake just fired.
    this.updateCameraShake();
    this.updatePanShake();

    // Keep the box centered as the camera frame is fixed.
    this.renderer.render(this.scene, this.camera);
    if (
      this.renderer.info.render.calls > 0
      && this.renderer.domElement.dataset.gooseFrameReady !== "true"
      && rafNow - this.lastFrameHealthProbeAt >= 220
    ) {
      this.lastFrameHealthProbeAt = rafNow;
      const gl = this.renderer.getContext();
      if (webglFrameHasVisibleContent(gl, gl.drawingBufferWidth, gl.drawingBufferHeight)) {
        this.renderer.domElement.dataset.gooseFrameReady = "true";
      }
    }
    if (
      import.meta.env.VITE_DEVICE_QA === "1"
      && this.deviceQaEnabled
    ) {
      window.dispatchEvent(new CustomEvent("zhuada-e:device-qa-frame", {
        detail: { frameTimeMs: rawDt * 1_000 },
      }));
      const now = performance.now();
      if (now - this.lastDeviceQaTelemetryAt >= SCENE_MOTION.qaTelemetryMs) {
        this.lastDeviceQaTelemetryAt = now;
        let sleepingBodies = 0;
        let escapedBodies = 0;
        let maxHorizontalVelocity = 0;
        let maxVerticalVelocity = 0;
        let activeVisuals = 0;
        for (const visual of this.itemVisuals.values()) {
          if (visual.extracting) continue;
          activeVisuals += 1;
          if (visual.body.sleepState === Body.SLEEPING) sleepingBodies += 1;
          const { position, velocity } = visual.body;
          if (
            Math.abs(position.x) > this.boxHalf + 1.4
            || Math.abs(position.z) > this.boxHalf + 1.4
            || position.y < -1.5
          ) escapedBodies += 1;
          maxHorizontalVelocity = Math.max(
            maxHorizontalVelocity,
            Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z),
          );
          maxVerticalVelocity = Math.max(maxVerticalVelocity, Math.abs(velocity.y));
        }
        const info = this.renderer.info;
        window.dispatchEvent(new CustomEvent("zhuada-e:device-qa-render", {
          detail: {
            at: Date.now(),
            frameTimeMs: rawDt * 1_000,
            drawCalls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            activeVisuals,
            physicsBodies: activeVisuals,
            sleepingBodies,
            escapedBodies,
            maxHorizontalVelocity,
            maxVerticalVelocity,
            pixelRatio: this.renderer.getPixelRatio(),
            canvasWidth: this.renderer.domElement.width,
            canvasHeight: this.renderer.domElement.height,
            qualityTier: this.renderQuality.tier,
            rendererLabel: this.rendererLabel,
          },
        }));
      }
    }
  };

  // ── Resize ──────────────────────────────────────────────────────────────────

  /** Host size changed (called by ThreeGameComponent's ResizeObserver). */
  resize(width: number, height: number): void {
    if (!this.renderer || width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, true);
    this.frameCamera(this.boxHalf, this.boxHeight);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Stable pseudo-random unit used to derive rotations from the run's positions. */
function deterministicUnit(id: number, salt: number): number {
  const x = Math.sin((id + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makeItemBody(profile: ItemPhysicsProfile, material?: CannonMaterial): CannonBody {
  const body = new Body({
    mass: profile.mass,
    material,
    linearDamping: profile.linearDamping,
    angularDamping: profile.angularDamping,
  });
  for (const spec of profile.shapes) {
    const shape = cannonShapeOf(spec, profile.sizeMultiplier);
    const [ox, oy, oz] = spec.offset ?? [0, 0, 0];
    const offset = new Vec3(
      ox * profile.sizeMultiplier,
      oy * profile.sizeMultiplier,
      oz * profile.sizeMultiplier,
    );
    let orientation: CannonQuaternion | undefined;
    if (spec.kind !== "sphere" && spec.rotation) {
      orientation = new CannonQuaternion();
      orientation.setFromEuler(spec.rotation[0], spec.rotation[1], spec.rotation[2], "XYZ");
    }
    body.addShape(shape, offset, orientation);
  }
  body.allowSleep = true;
  body.sleepSpeedLimit = profile.sleepSpeedLimit;
  body.sleepTimeLimit = profile.sleepTimeLimit;
  body.updateMassProperties();
  body.updateBoundingRadius();
  return body;
}

function cannonShapeOf(spec: CollisionShapeSpec, scale = 1): Sphere | Box | Cylinder {
  switch (spec.kind) {
    case "sphere":
      return new Sphere(spec.radius * scale);
    case "box":
      return new Box(new Vec3(spec.half[0] * scale, spec.half[1] * scale, spec.half[2] * scale));
    case "cylinder":
      return new Cylinder(spec.radiusTop * scale, spec.radiusBottom * scale, spec.height * scale, 12);
  }
}

/** Two clearedFx pulses are the same event iff they list the same indices. */
function sameIndexList(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Collect every Mesh (with a material) under a group, for hint pulsing. */
function collectMeshes(obj: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) out.push(m);
  });
  return out;
}

function collectSprites(obj: THREE.Object3D): THREE.Sprite[] {
  const out: THREE.Sprite[] = [];
  obj.traverse((o) => {
    const sprite = o as THREE.Sprite;
    if (sprite.isSprite) out.push(sprite);
  });
  return out;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default ZhuaDaScene;
