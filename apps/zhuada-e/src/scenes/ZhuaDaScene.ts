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
} from "cannon-es";
import { GameBridge } from "@framework/phaser";
import type { GameState } from "@framework/phaser/types";
import {
  ITEM_DEFS,
  TRAY_SLOTS,
  type GeometryKind,
  type ItemInstance,
} from "../logic/engine-zhuada";
import { buildGoose, buildModelMesh } from "./models";
import { sound } from "../logic/sound";
import { tuneGravity } from "../logic/game-rules";

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
  mesh: THREE.Mesh;
  body: CannonBody;
  /** when true the item is being pulled to the tray (physics off). */
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
  private trayGroup!: THREE.Group;
  private traySlots: (THREE.Group | null)[] = new Array(TRAY_SLOTS).fill(null);
  private overlayGroup!: THREE.Group;

  private logicalItems: ItemInstance[] = [];
  private trayKinds: (number | null)[] = Array(TRAY_SLOTS).fill(null);
  private gameStatus = "idle";
  private level = 1;
  private lastShuffleNonce = 0;
  private lastHintNonce = 0;
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
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = "none";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(C.bg);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, BOX_HEIGHT + 4.6, BOX_HEIGHT + 5.2);
    this.camera.lookAt(0, BOX_HEIGHT * 0.35, 0);

    this.setupLights();
    this.setupWorld();
    this.buildBox(boxHalfFromBoxHeight(BOX_HEIGHT), BOX_HEIGHT);
    this.buildTray();
    this.buildOverlay();

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
    this.unsubState?.();
    this.unsubReady?.();
    this.unsubError?.();
    this.unsubDestroy?.();
    // Dispose geometry/material to avoid GPU leaks across remounts.
    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      }
    });
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.host) {
      this.host?.removeChild(this.renderer.domElement);
    }
    this.itemVisuals.clear();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe7d9c4, 0.9);
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
    // A few solver iterations is plenty for a small pile.
    (this.world.solver as { iterations: number }).iterations = 8;
  }

  private buildBox(half: number, height: number): void {
    this.boxHalf = half;
    this.boxHeight = height;
    // Visual box: floor + four thin walls (open top).
    const floorGeo = new THREE.BoxGeometry(half * 2 + 0.4, 0.4, half * 2 + 0.4);
    const floorMat = new THREE.MeshStandardMaterial({ color: C.boxFloor, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.boxMeshes.push(floor);

    const wallMat = new THREE.MeshStandardMaterial({
      color: C.boxWall, roughness: 0.9, transparent: true, opacity: 0.5,
    });
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
    // Clear old slot meshes.
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

  // ── State reconciliation ─────────────────────────────────────────────────────

  private applyState(state: GameState): void {
    if (!state || Object.keys(state).length === 0) return;
    const nextStatus = (state.gameStatus as string) ?? this.gameStatus;
    const nextLevel = Number(state.level ?? this.level) || this.level;
    const items = (state.items as ItemInstance[] | undefined) ?? this.logicalItems;
    const tray = (state.tray as (number | null)[] | undefined) ?? this.trayKinds;

    const statusChanged = nextStatus !== this.gameStatus;
    const levelChanged = nextLevel !== this.level;
    const shuffleNonce = Number(state.shuffleNonce ?? 0) || 0;
    const hintNonce = Number(state.hintNonce ?? 0) || 0;

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

    if (statusChanged || levelChanged) {
      this.gameStatus = nextStatus;
      this.level = nextLevel;
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
    this.logicalItems = items.slice();

    // Reflect tray contents in the HUD slots.
    for (let i = 0; i < TRAY_SLOTS; i += 1) this.refreshTraySlot(i);
  }

  private resetScene(): void {
    for (const vis of this.itemVisuals.values()) {
      this.scene.remove(vis.mesh);
      this.world.removeBody(vis.body);
      disposeMesh(vis.mesh);
    }
    this.itemVisuals.clear();
    this.spawnQueue = [];
    this.overlayGroup.clear();
    this.layoutTray();
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
      disposeMesh(c as THREE.Mesh);
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
    const t0 = performance.now();
    const dur = this.reducedMotion ? 1 : 220;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const e = easeOutCubic(t);
      vis.mesh.position.lerpVectors(start, target ?? new THREE.Vector3(), e);
      vis.mesh.scale.setScalar(1 - 0.7 * e);
      if (t < 1 && !this.disposed) {
        requestAnimationFrame(step);
      } else {
        this.scene.remove(vis.mesh);
        disposeMesh(vis.mesh);
        this.itemVisuals.delete(vis.id);
      }
    };
    if (!this.reducedMotion) requestAnimationFrame(step);
    else step();
  }

  // ── Win / Fail sequences ────────────────────────────────────────────────────

  private playWin(): void {
    sound.play("win");
    this.overlayGroup.clear();
    const goose = buildGoose();
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
    this.overlayGroup.clear();
    const stamp = makeEmojiSprite("⏰", 2.0);
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

  /** Pulse a box item of `kind` with a brief highlight so the player can spot it. */
  private pulseHint(kind: number): void {
    let target: ItemVisual | undefined;
    for (const v of this.itemVisuals.values()) {
      if (!v.extracting && v.kind === kind) { target = v; break; }
    }
    if (!target) return;
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
      const p = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
      meshes.forEach((m) => {
        const mm = m.material as THREE.MeshStandardMaterial;
        if (mm) { mm.emissive = tint; mm.emissiveIntensity = p * 0.9; }
      });
      target!.mesh.scale.setScalar(baseScale + p * 0.14);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
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

    const meshes = Array.from(this.itemVisuals.values())
      .filter((v) => !v.extracting)
      .map((v) => v.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return;
    // Pick the closest hit; map mesh → visual → item id.
    const hitMesh = hits[0]!.object as THREE.Mesh;
    let picked: ItemVisual | undefined;
    for (const v of this.itemVisuals.values()) {
      if (v.mesh === hitMesh) { picked = v; break; }
    }
    if (!picked || picked.extracting) return;
    // Pick SFX — immediate tactile feedback on a successful pull.
    sound.play("pick");
    // Light press feedback.
    if (!this.reducedMotion) {
      hitMesh.scale.setScalar(1.18);
      setTimeout(() => hitMesh.scale.setScalar(1), 90);
    }
    this.bridge?.dispatch("extract", { itemId: picked.id, kind: picked.kind });
  };

  // ── Render loop ─────────────────────────────────────────────────────────────

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
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

    // Step physics with a fixed timestep (cannon-es `step(dt)` with a single
    // arg runs a fixed internal step and keeps the pile stable).
    this.world.step(1 / 60);

    // Sync mesh transforms from bodies (skip extracting items).
    for (const vis of this.itemVisuals.values()) {
      if (vis.extracting) continue;
      vis.mesh.position.set(vis.body.position.x, vis.body.position.y, vis.body.position.z);
      vis.mesh.quaternion.set(
        vis.body.quaternion.x, vis.body.quaternion.y,
        vis.body.quaternion.z, vis.body.quaternion.w,
      );
    }

    // Keep the box centered as the camera frame is fixed.
    this.renderer.render(this.scene, this.camera);
  };

  // ── Resize ──────────────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(width, height, false);
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

function makeEmojiSprite(emoji: string, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "200px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 128, 140);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, size);
  return sprite;
}

function disposeMesh(obj: THREE.Object3D): void {
  const mesh = obj as THREE.Mesh;
  if (mesh.isMesh) {
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  }
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
