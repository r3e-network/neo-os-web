/**
 * ZhuaDaScene — Three.js + cannon-es physics scene for Catch the Goose (B-class
 * physics-extraction edition).
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
import {
  Body,
  Box,
  Cylinder,
  Plane,
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
  ITEM_DEFS,
  TRAY_SLOTS,
  type GeometryKind,
  type ItemDef,
  type ItemInstance,
} from "../logic/engine-zhuada";
import { buildGoose, buildModelMesh } from "./models";
import { pickItemAt } from "./pick";
import { sound } from "../logic/sound";
import { haptics } from "../logic/haptics";
import { tuneGravity } from "../logic/game-rules";
import { sceneOfLevel } from "../logic/scenes";

// Logical scene size (CSS pixels of the canvas host on desktop).
const SCENE_W = 400;
const SCENE_H = 580;

// Camera framing — we look slightly down into the box.
const BOX_HALF = 3.0; // half-extent of the box interior (x and z)
const BOX_HEIGHT = 4.2; // wall height
const DROP_TOP = BOX_HEIGHT + 5.5;

const C = {
  bg: 0xf7f3ec,
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
  /** when true the body is asleep / not yet spawned. */
  spawned: boolean;
}

export class ZhuaDaScene {
  private host: HTMLElement | null = null;
  private bridge: GameBridge | null = null;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: World;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();

  private itemVisuals = new Map<number, ItemVisual>();
  private boxMeshes: THREE.Object3D[] = [];
  // Themed pen materials + lights (retinted per scene, see applyTheme).
  private floorMat: THREE.MeshStandardMaterial | null = null;
  private wallMat: THREE.MeshStandardMaterial | null = null;
  private rimMat: THREE.MeshStandardMaterial | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  /** Scene id currently painted (-1 = default palette, forces first apply). */
  private themedScene = -1;
  private trayGroup!: THREE.Group;
  private traySlots: (THREE.Group | null)[] = new Array(TRAY_SLOTS).fill(null);
  private overlayGroup!: THREE.Group;

  private logicalItems: ItemInstance[] = [];
  private trayKinds: (number | null)[] = Array(TRAY_SLOTS).fill(null);
  private gameStatus = "idle";
  private level = 1;
  private lastShuffleNonce = 0;
  private lastHintNonce = 0;
  private lastShakeNonce = 0;
  /** Camera rest position — the shake offset oscillates around this. */
  private cameraBase = new THREE.Vector3();
  /** Wall-clock start of the current camera micro-shake (0 = idle). */
  private cameraShakeT0 = 0;
  /** Last clearedFx pulse consumed (dedupes repeated state pushes). */
  private lastClearedFx: number[] = [];
  /** Why the current loss happened ("timeout" | "trayFull") — drives the stamp. */
  private failReason = "";
  private spawnQueue: ItemInstance[] = [];
  private spawnTimer = 0;
  private boxHalf = BOX_HALF;
  private boxHeight = BOX_HEIGHT;

  private rafId = 0;
  private reducedMotion = false;
  private unsubState: (() => void) | null = null;
  private unsubReady: (() => void) | null = null;
  private unsubError: (() => void) | null = null;
  private unsubDestroy: (() => void) | null = null;
  private disposed = false;

  // ── ThreeSceneController contract ──────────────────────────────────────────

  mount(host: HTMLElement, bridge: GameBridge): void {
    this.host = host;
    this.bridge = bridge;

    // Reduced motion preference.
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reducedMotion = mq?.matches ?? false;

    // Renderer sized to the host element (CSS pixels).
    const w = host.clientWidth || SCENE_W;
    const h = host.clientHeight || SCENE_H;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // updateStyle=true: the canvas MUST get explicit CSS width/height, or on
    // dpr>=2 devices it lays out at its attribute size (2x the host, clipped
    // to a magnified top-left quadrant).
    this.renderer.setSize(w, h, true);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.bg);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, BOX_HEIGHT + 4.6, BOX_HEIGHT + 5.2);
    this.camera.lookAt(0, BOX_HEIGHT * 0.35, 0);
    this.cameraBase.copy(this.camera.position);

    this.setupLights();
    this.setupWorld();
    this.buildBox(boxHalfFromBoxHeight(BOX_HEIGHT), BOX_HEIGHT);
    this.buildTray();
    this.buildOverlay();
    this.applyTheme(this.level);

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

  unmount(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.renderer?.domElement.removeEventListener("pointerdown", this.onPointerDown);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.unsubState?.();
    this.unsubReady?.();
    this.unsubError?.();
    this.unsubDestroy?.();
    // Dispose geometry/material/textures to avoid GPU leaks across remounts
    // (traverse-based, so composed Groups and the emoji Sprite are covered).
    if (this.scene) disposeObject(this.scene);
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.host) {
      this.host?.removeChild(this.renderer.domElement);
    }
    this.itemVisuals.clear();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe7d9c4, 0.9);
    this.hemiLight = hemi;
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    const d = 10;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff2d8, 0.35);
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);
  }

  private setupWorld(): void {
    this.world = new World({ gravity: new Vec3(0, tuneGravity(), 0) });
    this.world.broadphase = new SAPBroadphase(this.world);
    this.world.allowSleep = true;
    // A few solver iterations is plenty for a small pile (the default World
    // solver is a GSSolver; the base Solver type just doesn't expose it).
    (this.world.solver as GSSolver).iterations = 8;
  }

  private buildBox(half: number, height: number): void {
    this.boxHalf = half;
    this.boxHeight = height;
    // Visual box: floor + four thin walls (open top).
    const floorGeo = new THREE.BoxGeometry(half * 2 + 0.4, 0.4, half * 2 + 0.4);
    const floorMat = new THREE.MeshStandardMaterial({ color: C.boxFloor, roughness: 0.95 });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.boxMeshes.push(floor);

    const wallMat = new THREE.MeshStandardMaterial({
      color: C.boxWall, roughness: 0.9, transparent: true, opacity: 0.5,
    });
    this.wallMat = wallMat;
    const wallThick = 0.3;
    const wallDefs: [number, number, number, number, number, number][] = [
      // x, y, z, sx, sy, sz
      [0, height / 2, -half - wallThick / 2, half * 2 + wallThick * 2, height, wallThick],
      [0, height / 2, half + wallThick / 2, half * 2 + wallThick * 2, height, wallThick],
      [-half - wallThick / 2, height / 2, 0, wallThick, height, half * 2 + wallThick * 2],
      [half + wallThick / 2, height / 2, 0, wallThick, height, half * 2 + wallThick * 2],
    ];
    for (const [x, y, z, sx, sy, sz] of wallDefs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMat);
      wall.position.set(x, y, z);
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.boxMeshes.push(wall);
    }

    // Bright rim at the top to read as the "pen".
    const rimGeo = new THREE.TorusGeometry(half + 0.32, 0.08, 8, 4);
    const rimMat = new THREE.MeshStandardMaterial({ color: C.boxEdge, roughness: 0.5, emissive: C.boxEdge, emissiveIntensity: 0.2 });
    this.rimMat = rimMat;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    this.scene.add(rim);
    this.boxMeshes.push(rim);

    // Physics floor.
    const floorBody = new Body({ mass: 0, shape: new Plane() });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    floorBody.position.set(0, 0, 0);
    this.world.addBody(floorBody);
    // Physics walls (4 static planes facing inward).
    const makeWall = (nx: number, nz: number, px: number, pz: number) => {
      const b = new Body({ mass: 0, shape: new Plane() });
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx, 0, nz));
      b.quaternion.set(q.x, q.y, q.z, q.w);
      b.position.set(px, 0, pz);
      this.world.addBody(b);
    };
    makeWall(0, 1, 0, -half); // -z wall normal +z
    makeWall(0, -1, 0, half); // +z wall normal -z
    makeWall(1, 0, -half, 0); // -x wall normal +x
    makeWall(-1, 0, half, 0); // +x wall normal -x
  }

  private buildTray(): void {
    this.trayGroup = new THREE.Group();
    this.scene.add(this.trayGroup);
    this.layoutTray();
  }

  private layoutTray(): void {
    // Clear old slot meshes (dispose first — every level start rebuilds the
    // 7 slots; without disposal each rebuild leaks 7x geometry+material).
    for (const child of [...this.trayGroup.children]) disposeObject(child);
    this.trayGroup.clear();
    this.traySlots = new Array(TRAY_SLOTS).fill(null);
    const gap = 0.92;
    const totalW = (TRAY_SLOTS - 1) * gap;
    const y = this.boxHeight + 1.1;
    const z = 0;
    const slotR = 0.42;
    for (let i = 0; i < TRAY_SLOTS; i += 1) {
      const x = -totalW / 2 + i * gap;
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(slotR, slotR, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: C.trayBg, roughness: 0.85, transparent: true, opacity: 0.85 }),
      );
      g.add(base);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(slotR, 0.05, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xddd4c4, roughness: 0.7 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.09;
      g.add(ring);
      this.trayGroup.add(g);
      this.traySlots[i] = g;
      this.refreshTraySlot(i);
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
  private applyTheme(level: number): void {
    const theme = sceneOfLevel(level);
    if (theme.id === this.themedScene) return;
    this.themedScene = theme.id;
    const p = theme.palette;
    this.scene.background = new THREE.Color(p.bg);
    this.floorMat?.color.set(p.floor);
    this.wallMat?.color.set(p.wall);
    if (this.rimMat) {
      this.rimMat.color.set(p.rim);
      this.rimMat.emissive.set(p.rim);
    }
    this.hemiLight?.groundColor.set(p.hemiGround);
  }

  // ── State reconciliation ─────────────────────────────────────────────────────

  private applyState(state: GameState): void {
    // Guard against pushes before (or after a failed) mount: the scene graph
    // only exists once mount() succeeded past renderer construction.
    if (!this.scene) return;
    if (!state || Object.keys(state).length === 0) return;
    const nextStatus = (state.gameStatus as string) ?? this.gameStatus;
    const nextLevel = Number(state.level ?? this.level) || this.level;
    const items = (state.items as ItemInstance[] | undefined) ?? this.logicalItems;
    const tray = (state.tray as (number | null)[] | undefined) ?? this.trayKinds;

    const statusChanged = nextStatus !== this.gameStatus;
    const levelChanged = nextLevel !== this.level;
    const shuffleNonce = Number(state.shuffleNonce ?? 0) || 0;
    const hintNonce = Number(state.hintNonce ?? 0) || 0;
    const shakeNonce = Number(state.shakeNonce ?? 0) || 0;
    this.failReason = typeof state.failReason === "string" ? state.failReason : this.failReason;

    // ── 3-match clear celebration ──
    // clearedFx is a transient pulse of the 3 tray indices that just cleared
    // (reset to [] by the shell ~200ms later). It arrives in the SAME snapshot
    // that already nulled those tray slots, so the cleared KIND must be read
    // from the PREVIOUS trayKinds before we overwrite them below.
    const clearedNow = Array.isArray(state.clearedFx) ? (state.clearedFx as number[]) : [];
    if (clearedNow.length > 0 && !sameIndexList(clearedNow, this.lastClearedFx)) {
      this.lastClearedFx = clearedNow.slice();
      const clearedKind = clearedNow
        .map((i) => this.trayKinds[i])
        .find((k): k is number => k !== null && k !== undefined) ?? null;
      this.playClearPop(clearedNow, clearedKind);
    } else if (clearedNow.length === 0 && this.lastClearedFx.length > 0) {
      this.lastClearedFx = [];
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

    // ── Power-up: HINT (pulse a helpful item) ──
    if (hintNonce !== this.lastHintNonce) {
      this.lastHintNonce = hintNonce;
      if (hintNonce > 0 && nextStatus === "dealt") {
        const kind = this.computeHintKind(tray, items);
        if (kind >= 0) this.pulseHint(kind);
      }
    }

    // ── Shake (G3 晃一晃): jolt every pile body + camera micro-shake ──
    if (shakeNonce !== this.lastShakeNonce) {
      this.lastShakeNonce = shakeNonce;
      if (shakeNonce > 0 && nextStatus === "dealt") this.applyShake();
    }

    if (statusChanged || levelChanged) {
      this.gameStatus = nextStatus;
      this.level = nextLevel;
      this.applyTheme(nextLevel);
      if (nextStatus === "dealt") {
        // New level / retry → reset visuals.
        this.resetScene();
        this.logicalItems = items.slice();
        this.queueSpawns(this.logicalItems);
      } else if (nextStatus === "solved") {
        this.playWin();
      } else if (nextStatus === "expired") {
        this.playFail();
      } else {
        // idle / lobby → clear.
        this.resetScene();
      }
      return;
    }

    // During play, reconcile removed items (the engine removes them on extract).
    const liveIds = new Set(items.map((it) => it.id));
    for (const [id, vis] of this.itemVisuals) {
      if (!liveIds.has(id)) {
        // Item was extracted — fly it to its tray slot, then remove.
        this.sendToTray(vis);
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
        this.scene.remove(vis.mesh);
        disposeObject(vis.mesh);
        this.itemVisuals.delete(it.id);
        this.spawnQueue.push(it);
      }
    }
    this.logicalItems = items.slice();

    // Reflect tray contents in the HUD slots.
    for (let i = 0; i < TRAY_SLOTS; i += 1) this.refreshTraySlot(i);
  }

  private resetScene(): void {
    for (const vis of this.itemVisuals.values()) {
      this.scene.remove(vis.mesh);
      this.world.removeBody(vis.body);
      disposeObject(vis.mesh);
    }
    this.itemVisuals.clear();
    this.spawnQueue = [];
    this.clearOverlay();
    this.layoutTray();
  }

  /** Clear the win/fail overlay, disposing its GPU resources (goose meshes,
   * emoji sprite CanvasTexture) instead of orphaning them. */
  private clearOverlay(): void {
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
    const def = ITEM_DEFS[it.kind] ?? ITEM_DEFS[0]!;
    const mesh = buildModelMesh(def.model, def.color);
    mesh.castShadow = true;
    const sx = (Math.random() * 2 - 1) * (this.boxHalf - 0.6);
    const sz = (Math.random() * 2 - 1) * (this.boxHalf - 0.6);
    mesh.position.set(sx, DROP_TOP + Math.random() * 1.5, sz);
    this.scene.add(mesh);

    const body = makeItemBody(def.geometry, this.boxHalf * 0.5);
    body.position.set(sx, DROP_TOP + Math.random() * 1.5, sz);
    body.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    body.velocity.set(0, -2, 0);
    body.angularVelocity.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    this.world.addBody(body);

    // Landing thud — volume scales with impact speed; resting jitter is filtered
    // out by the velocity threshold (set in sound.play).
    body.addEventListener("collide", (e: { contact: { getImpactVelocityAlongNormal(): number } }) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 1.2) sound.play("land", Math.min(1, v / 6));
    });

    this.itemVisuals.set(it.id, {
      id: it.id, kind: it.kind, mesh, body, extracting: false, spawned: true,
    });
  }

  // ── Tray HUD ────────────────────────────────────────────────────────────────

  private refreshTraySlot(i: number): void {
    const g = this.traySlots[i];
    if (!g) return;
    const kind = this.trayKinds[i];
    // Remove any previously placed mini-item (keep base + ring which are index 0,1).
    while (g.children.length > 2) {
      const c = g.children[g.children.length - 1]!;
      g.remove(c);
      disposeObject(c);
    }
    if (kind === null || kind === undefined) return;
    const def = ITEM_DEFS[kind] ?? ITEM_DEFS[0]!;
    const mini = buildModelMesh(def.model, def.color, 0.3);
    mini.position.y = 0.28;
    g.add(mini);
  }

  private sendToTray(vis: ItemVisual): void {
    // Find the tray slot this kind occupies (first matching slot) for the fly target.
    const slotIdx = this.trayKinds.findIndex((k) => k === vis.kind);
    const target = slotIdx >= 0 ? this.traySlots[slotIdx]?.position.clone() : new THREE.Vector3(0, this.boxHeight + 1.1, 0);
    vis.extracting = true;
    this.world.removeBody(vis.body);
    // Animate the mesh up to the tray then remove (the HUD slot is re-rendered by React state).
    const start = vis.mesh.position.clone();
    // Shrink relative to the model's current scale (base 0.62 from
    // buildModelMesh, possibly popped by press feedback) instead of stomping
    // it with an absolute value.
    const startScale = vis.mesh.scale.x;
    const t0 = performance.now();
    const dur = this.reducedMotion ? 1 : 220;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = easeOutCubic(t);
      vis.mesh.position.lerpVectors(start, target ?? new THREE.Vector3(), e);
      vis.mesh.scale.setScalar(startScale * (1 - 0.7 * e));
      if (t < 1 && !this.disposed) {
        requestAnimationFrame(step);
      } else {
        this.scene.remove(vis.mesh);
        disposeObject(vis.mesh);
        // Identity check: an undo during the fly may have already replaced
        // this id with a fresh re-dropped visual — never delete that one.
        if (this.itemVisuals.get(vis.id) === vis) this.itemVisuals.delete(vis.id);
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
    const def = ITEM_DEFS[kind] ?? ITEM_DEFS[0]!;
    for (const idx of indices) {
      const slot = this.traySlots[idx];
      if (!slot) continue;
      const origin = slot.position.clone().add(new THREE.Vector3(0, 0.28, 0));
      this.spawnPopMini(def, origin);
      this.spawnPopBurst(def.color, origin);
    }
  }

  /** Ghost mini at a cleared slot: quick scale-up + rise + fade, then dispose. */
  private spawnPopMini(def: ItemDef, origin: THREE.Vector3): void {
    const mini = buildModelMesh(def.model, def.color, 0.3);
    mini.position.copy(origin);
    this.overlayGroup.add(mini);
    const meshes = collectMeshes(mini);
    for (const m of meshes) {
      const mm = m.material as THREE.MeshStandardMaterial;
      if (mm) mm.transparent = true;
    }
    const t0 = performance.now();
    const dur = 420;
    const step = (): void => {
      if (this.disposed) return;
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = easeOutCubic(t);
      mini.scale.setScalar(0.3 * (1 + 0.9 * e));
      mini.position.y = origin.y + 0.35 * e;
      const fade = Math.max(0, 1 - t * t);
      for (const m of meshes) {
        const mm = m.material as THREE.MeshStandardMaterial;
        if (mm) mm.opacity = fade;
      }
      if (t < 1) requestAnimationFrame(step);
      else {
        this.overlayGroup.remove(mini);
        disposeObject(mini);
      }
    };
    requestAnimationFrame(step);
  }

  /** Small radial particle burst in the cleared kind's color. */
  private spawnPopBurst(color: number, origin: THREE.Vector3): void {
    const count = 10;
    const geo = new THREE.TetrahedronGeometry(0.09);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    const group = new THREE.Group();
    const parts: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[] = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(origin);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      parts.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(a) * (1.2 + Math.random() * 0.9),
          1.8 + Math.random() * 1.3,
          Math.sin(a) * (1.2 + Math.random() * 0.9),
        ),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
      });
      group.add(mesh);
    }
    this.overlayGroup.add(group);
    const t0 = performance.now();
    const dur = 550;
    let last = t0;
    const step = (): void => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = Math.min(1, (now - t0) / dur);
      for (const p of parts) {
        p.vel.y -= 7.5 * dt; // light gravity arc
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
      }
      mat.opacity = Math.max(0, 1 - t * t);
      if (t < 1) requestAnimationFrame(step);
      else {
        this.overlayGroup.remove(group);
        geo.dispose();
        mat.dispose();
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
      let t = 0;
      const bob = () => {
        t += 0.016;
        goose.position.y = this.boxHeight + 1.8 + Math.sin(t * 3) * 0.3;
        goose.rotation.y = Math.PI * 0.1 + Math.sin(t * 1.5) * 0.3;
        if (t < 2.4 && !this.disposed) requestAnimationFrame(bob);
      };
      bob();
    }
  }

  private playFail(): void {
    sound.play("fail");
    this.clearOverlay();
    // Failure is readable: the stamp names the loss. Timeout → drawn alarm
    // clock; jammed tray → drawn padlock. Both are canvas-DRAWN original
    // glyphs (no emoji / no fonts) so the art stays ours everywhere.
    const stamp = makeGlyphSprite(this.failReason === "trayFull" ? drawLockGlyph : drawClockGlyph, 2.2);
    stamp.position.set(0, this.boxHeight + 2.0, 0);
    this.overlayGroup.add(stamp);
  }

  // ── Hint logic ──────────────────────────────────────────────────────────────

  /** Pick the most useful kind to surface for a hint given tray + box state. */
  private computeHintKind(tray: (number | null)[], items: ItemInstance[]): number {
    const boxCounts = new Map<number, number>();
    for (const it of items) boxCounts.set(it.kind, (boxCounts.get(it.kind) ?? 0) + 1);
    const trayCounts = new Map<number, number>();
    for (const k of tray) if (k !== null) trayCounts.set(k, (trayCounts.get(k) ?? 0) + 1);
    // 1) a kind with 2 in tray and ≥1 still in box completes a triple now
    for (const [k, c] of trayCounts) if (c === 2 && (boxCounts.get(k) ?? 0) >= 1) return k;
    // 2) a kind with 1 in tray and ≥2 in box builds toward a triple
    for (const [k, c] of trayCounts) if (c === 1 && (boxCounts.get(k) ?? 0) >= 2) return k;
    // 3) otherwise surface the most common kind still in the box
    let best = -1;
    let bestC = 0;
    for (const [k, c] of boxCounts) if (c > bestC) { bestC = c; best = k; }
    return best;
  }

  /** Pulse a box item of `kind` with a brief highlight so the player can spot
   * it. Reduced motion: a STEADY emissive highlight for the same duration —
   * the information survives, the flashing and scale-throb do not. */
  private pulseHint(kind: number): void {
    let target: ItemVisual | undefined;
    for (const v of this.itemVisuals.values()) {
      if (!v.extracting && v.kind === kind) { target = v; break; }
    }
    if (!target) return;
    const reduced = this.reducedMotion;
    const meshes = collectMeshes(target.mesh);
    const tint = new THREE.Color(C.brand);
    const baseScale = target.mesh.scale.x;
    const t0 = performance.now();
    const dur = 1600;
    const step = (): void => {
      if (this.disposed || !this.itemVisuals.has(target!.id)) {
        meshes.forEach((m) => { const mm = m.material as THREE.MeshStandardMaterial; if (mm) mm.emissiveIntensity = 0; });
        return;
      }
      const t = (performance.now() - t0) / dur;
      if (t >= 1) {
        meshes.forEach((m) => { const mm = m.material as THREE.MeshStandardMaterial; if (mm) mm.emissiveIntensity = 0; });
        target!.mesh.scale.setScalar(baseScale);
        return;
      }
      const p = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
      meshes.forEach((m) => {
        const mm = m.material as THREE.MeshStandardMaterial;
        if (mm) { mm.emissive = tint; mm.emissiveIntensity = p * 0.9; }
      });
      if (!reduced) target!.mesh.scale.setScalar(baseScale + p * 0.14);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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
  private applyShake(): void {
    for (const vis of this.itemVisuals.values()) {
      if (vis.extracting) continue;
      vis.body.wakeUp();
      const impulse = new Vec3(
        (Math.random() * 2 - 1) * 2.4,
        2.2 + Math.random() * 2.2,
        (Math.random() * 2 - 1) * 2.4,
      );
      vis.body.applyImpulse(impulse);
      vis.body.angularVelocity.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
      );
    }
    if (!this.reducedMotion) this.cameraShakeT0 = performance.now();
  }

  /** Per-frame camera micro-shake: damped noise around the rest position. */
  private updateCameraShake(): void {
    if (this.cameraShakeT0 === 0) return;
    const SHAKE_MS = 360;
    const t = (performance.now() - this.cameraShakeT0) / SHAKE_MS;
    if (t >= 1) {
      this.cameraShakeT0 = 0;
      this.camera.position.copy(this.cameraBase);
      return;
    }
    const damp = (1 - t) * (1 - t);
    const amp = 0.12 * damp;
    this.camera.position.set(
      this.cameraBase.x + Math.sin(t * 40) * amp,
      this.cameraBase.y + Math.sin(t * 53 + 1.7) * amp * 0.6,
      this.cameraBase.z + Math.cos(t * 47 + 0.6) * amp,
    );
  }

  // ── Pointer pick ────────────────────────────────────────────────────────────

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
    const picked = pickItemAt(this.raycaster, roots);
    if (!picked) return;
    // Synchronous in-flight guard: flag the visual BEFORE the async React
    // round-trip so a same-frame double-tap can't dispatch a duplicate
    // extract (the roots filter above skips extracting visuals).
    picked.extracting = true;
    // Pick SFX + light haptic tap — immediate tactile feedback on a pull.
    sound.play("pick");
    haptics.play("pick");
    // Light press pop, relative to the model's base scale; the tray fly
    // animation (sendToTray) takes over from whatever scale this reaches.
    if (!this.reducedMotion) {
      picked.mesh.scale.multiplyScalar(1.15);
    }
    this.bridge?.dispatch("extract", { itemId: picked.id, kind: picked.kind });
  };

  // ── Render loop ─────────────────────────────────────────────────────────────

  /** Tab became visible again: throw away the delta accumulated while hidden
   * so physics + spawn pacing resume from a standstill instead of a jump. */
  private onVisibilityChange = (): void => {
    if (!document.hidden) this.clock.getDelta();
  };

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    // Hidden tab → hard pause. Most browsers stop rAF while hidden anyway;
    // this guard covers the ones that keep throttled frames alive.
    if (document.hidden) return;
    const rawDt = this.clock.getDelta();

    // Spawn queued items gradually so they cascade in. Pace with the UNCLAMPED
    // elapsed time so spawning still progresses under frame drops / throttled
    // rAF (otherwise spawnTimer can stay just below the interval forever).
    if (this.spawnQueue.length > 0) {
      this.spawnTimer += rawDt;
      const interval = 0.035;
      while (this.spawnTimer >= interval && this.spawnQueue.length > 0) {
        this.spawnTimer -= interval;
        this.spawnNext();
      }
    }

    // Variable-step physics: fixed 1/60 internal step fed with the REAL
    // elapsed time (clamped so a tab refocus can't explode the pile) and up
    // to 3 catch-up substeps. A bare step(1/60) would advance exactly one
    // fixed step per rAF, scaling game speed with the display refresh rate
    // (2x on 120Hz, slow-motion under throttling).
    this.world.step(1 / 60, Math.min(rawDt, 0.1), 3);

    // Sync mesh transforms from bodies (skip extracting items).
    for (const vis of this.itemVisuals.values()) {
      if (vis.extracting) continue;
      vis.mesh.position.set(vis.body.position.x, vis.body.position.y, vis.body.position.z);
      vis.mesh.quaternion.set(
        vis.body.quaternion.x, vis.body.quaternion.y,
        vis.body.quaternion.z, vis.body.quaternion.w,
      );
    }

    // Camera micro-shake (G3) — a no-op unless a shake just fired.
    this.updateCameraShake();

    // Keep the box centered as the camera frame is fixed.
    this.renderer.render(this.scene, this.camera);
  };

  // ── Resize ──────────────────────────────────────────────────────────────────

  /** Host size changed (called by ThreeGameComponent's ResizeObserver). */
  resize(width: number, height: number): void {
    if (!this.renderer || width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, true);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function boxHalfFromBoxHeight(h: number): number {
  return Math.max(2.4, Math.min(3.4, h * 0.72));
}

function makeItemBody(geometry: GeometryKind, half: number): CannonBody {
  let shape;
  switch (geometry) {
    case "sphere": shape = new Sphere(0.62); break;
    case "box": shape = new Box(new Vec3(0.85, 0.85, 0.85)); break;
    case "cylinder": shape = new Cylinder(0.8, 0.8, 1.6, 12); break;
    case "cone": shape = new Cylinder(0.05, 0.9, 1.7, 12); break;
    case "torus": shape = new Sphere(0.7); break; // approximate with sphere for stability
    case "icosa": shape = new Sphere(0.95); break;
    default: shape = new Sphere(0.62);
  }
  const body = new Body({ mass: 1, shape, linearDamping: 0.1, angularDamping: 0.2 });
  void half;
  return body;
}

/** Two clearedFx pulses are the same event iff they list the same indices. */
function sameIndexList(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Render an original canvas-DRAWN glyph (no fonts, no emoji) onto a sprite. */
function makeGlyphSprite(draw: (ctx: CanvasRenderingContext2D) => void, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, size);
  return sprite;
}

/** Timeout stamp: a hand-drawn alarm clock (ring + bells + hands + feet). */
function drawClockGlyph(ctx: CanvasRenderingContext2D): void {
  const red = "#ef4444";
  ctx.lineCap = "round";
  // Face.
  ctx.strokeStyle = red;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(128, 140, 82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.beginPath();
  ctx.arc(128, 140, 73, 0, Math.PI * 2);
  ctx.fill();
  // Bells (two arcs on top) + feet.
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(62, 58, 26, Math.PI * 0.75, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(194, 58, 26, Math.PI * 1.15, Math.PI * 2.25);
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(66, 210); ctx.lineTo(48, 232);
  ctx.moveTo(190, 210); ctx.lineTo(208, 232);
  ctx.stroke();
  // Hands, pointing at "time's up".
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(128, 140); ctx.lineTo(128, 88);
  ctx.moveTo(128, 140); ctx.lineTo(170, 158);
  ctx.stroke();
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.arc(128, 140, 9, 0, Math.PI * 2);
  ctx.fill();
}

/** Tray-jam stamp: a hand-drawn padlock (shackle + body + keyhole cutout). */
function drawLockGlyph(ctx: CanvasRenderingContext2D): void {
  const red = "#ef4444";
  ctx.lineCap = "round";
  // Shackle.
  ctx.strokeStyle = red;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(128, 98, 46, Math.PI, Math.PI * 2);
  ctx.moveTo(82, 98); ctx.lineTo(82, 124);
  ctx.moveTo(174, 98); ctx.lineTo(174, 124);
  ctx.stroke();
  // Body.
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.roundRect(52, 118, 152, 108, 22);
  ctx.fill();
  // Keyhole cutout (punched out of the body, not painted over it).
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(128, 158, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(120, 164, 16, 40, 8);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function disposeMaterial(mat: THREE.Material | THREE.Material[] | undefined): void {
  if (!mat) return;
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
}

/**
 * Dispose every GPU resource under `root`. Item visuals and tray minis are
 * composed Groups, so disposal MUST traverse (a root-only isMesh check
 * disposes nothing for them); Sprites need their material + CanvasTexture
 * freed explicitly (material.dispose() does not free .map).
 */
function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      disposeMaterial(mesh.material);
      return;
    }
    const sprite = obj as THREE.Sprite;
    if (sprite.isSprite) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
  });
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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default ZhuaDaScene;
