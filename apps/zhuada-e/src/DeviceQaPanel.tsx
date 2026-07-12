import { useEffect, useRef, useState } from "react";
import { APP_VERSION } from "./app-version";
import { sound } from "./logic/sound";
import { haptics } from "./logic/haptics";
import { ShakeDetector, type MotionPermissionState } from "./logic/device-motion";
import { gameStorageStatus } from "./logic/game-storage";
import {
  DEVICE_QA_CONTEXT_EVENT,
  DEVICE_QA_FRAME_EVENT,
  DEVICE_QA_MANUAL_CHECKS,
  DEVICE_QA_RENDER_EVENT,
  DEVICE_QA_REQUIRED_TRANSITION_EVENTS,
  DEVICE_QA_SHAKE_EVENT,
  buildDeviceQaReport,
  buildDeviceQaEvidenceChecklist,
  createDeviceQaSessionId,
  emptyManualChecks,
  summarizeFrameIntervals,
  type DeviceQaGameSnapshot,
  type DeviceQaManualChecks,
  type DeviceQaManualKey,
  type DeviceQaMotionEvidence,
  type DeviceQaRenderEvidence,
  type DeviceQaRenderSample,
  type DeviceQaRuntimeEvidence,
  type DeviceQaStabilityEvidence,
} from "./logic/device-qa";
import "./DeviceQaPanel.scss";

export interface DeviceQaPanelProps {
  motionPermission: MotionPermissionState;
  motionEnabled: boolean;
  requestMotion: () => Promise<MotionPermissionState>;
  disableMotion: () => void;
  game: DeviceQaGameSnapshot;
}

interface ShakeOutcomeDetail {
  source?: string;
  accepted?: boolean;
  strength?: string;
  intensity?: number;
  magnitude?: number;
}

const MAX_FRAME_INTERVALS = 12_000;
const MAX_TRANSITIONS = 80;

function vectorMagnitude(vector: DeviceMotionEventAcceleration | null): number {
  if (!vector) return 0;
  const x = Number.isFinite(vector.x) ? Number(vector.x) : 0;
  const y = Number.isFinite(vector.y) ? Number(vector.y) : 0;
  const z = Number.isFinite(vector.z) ? Number(vector.z) : 0;
  return Math.sqrt(x * x + y * y + z * z);
}

function entryAssets(): string[] {
  try {
    return performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(location.origin))
      .map((name) => new URL(name).pathname)
      .filter((name, index, all) => all.indexOf(name) === index)
      .slice(0, 50);
  } catch {
    return [];
  }
}

function runtimeEvidence(deviceLabel: string): DeviceQaRuntimeEvidence {
  return {
    deviceLabel,
    userAgent: navigator.userAgent,
    platform: navigator.platform || "unknown",
    language: navigator.language,
    viewport: {
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
      dpr: window.devicePixelRatio || 1,
    },
    orientation: screen.orientation?.type ?? `${window.orientation ?? "unknown"}`,
    secureContext: window.isSecureContext,
    online: navigator.onLine,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    embedded: window.self !== window.top,
    storageAccess: gameStorageStatus() === "direct"
      ? "direct"
      : gameStorageStatus() === "bridged"
        ? "bridged"
        : "blocked",
    entryAssets: entryAssets(),
  };
}

function initialMotion(permission: MotionPermissionState, enabled: boolean): DeviceQaMotionEvidence {
  return {
    permission,
    enabled,
    eventCount: 0,
    eventRateHz: 0,
    lastEventAt: null,
    lastRawMagnitude: 0,
    maxRawMagnitude: 0,
    directAccelerationEvents: 0,
    gravityIncludedEvents: 0,
    softSignals: 0,
    strongSignals: 0,
    lastSignalAt: null,
    lastSignalIntensity: 0,
    lastSignalMagnitude: 0,
    acceptedGameShakes: 0,
    cooldownRejected: 0,
  };
}

function initialRender(): DeviceQaRenderEvidence {
  return {
    latest: null,
    peakDrawCalls: 0,
    peakTriangles: 0,
    peakActiveVisuals: 0,
    peakPhysicsBodies: 0,
    peakEscapedBodies: 0,
    peakHorizontalVelocity: 0,
    peakVerticalVelocity: 0,
    contextLosses: 0,
  };
}

function initialStability(): DeviceQaStabilityEvidence {
  return {
    restartResumeCycles: 0,
    longLevel15Run: false,
    memoryTimelineEvidence: "",
    memoryTrend: "unknown",
    restartSlowdown: "unknown",
    contextLossLoop: false,
    notes: "",
  };
}

export default function DeviceQaPanel({
  motionPermission,
  motionEnabled,
  requestMotion,
  disableMotion,
  game,
}: DeviceQaPanelProps) {
  const [open, setOpen] = useState(true);
  const [deviceLabel, setDeviceLabel] = useState("");
  const [manual, setManual] = useState<DeviceQaManualChecks>(() => emptyManualChecks());
  const [stability, setStability] = useState<DeviceQaStabilityEvidence>(() => initialStability());
  const [showJson, setShowJson] = useState(false);
  const [copyState, setCopyState] = useState("");
  const [tick, setTick] = useState(0);
  const startedAtRef = useRef(new Date().toISOString());
  const sessionIdRef = useRef(createDeviceQaSessionId());
  const intervalsRef = useRef<number[]>([]);
  const motionRef = useRef(initialMotion(motionPermission, motionEnabled));
  const renderRef = useRef(initialRender());
  const motionTimesRef = useRef<number[]>([]);
  const transitionsRef = useRef<Array<Record<string, unknown>>>([]);
  const detectorRef = useRef(new ShakeDetector());
  const feedbackTestsRef = useRef({ audio: 0, haptic: 0 });

  const addTransition = (event: string, detail: Record<string, unknown> = {}): void => {
    transitionsRef.current.push({ at: new Date().toISOString(), event, ...detail });
    if (transitionsRef.current.length > MAX_TRANSITIONS) transitionsRef.current.shift();
  };

  useEffect(() => {
    motionRef.current.permission = motionPermission;
    motionRef.current.enabled = motionEnabled;
  }, [motionEnabled, motionPermission]);

  useEffect(() => {
    addTransition("game-state", { ...game });
  }, [game]);

  useEffect(() => {
    const detector = detectorRef.current;
    detector.reset();
    const onMotion = (event: DeviceMotionEvent): void => {
      const now = performance.now();
      const direct = vectorMagnitude(event.acceleration);
      const included = vectorMagnitude(event.accelerationIncludingGravity);
      const raw = direct > 0 ? direct : Math.abs(included - 9.81);
      const evidence = motionRef.current;
      evidence.eventCount += 1;
      evidence.lastEventAt = Date.now();
      evidence.lastRawMagnitude = raw;
      evidence.maxRawMagnitude = Math.max(evidence.maxRawMagnitude, raw);
      if (direct > 0) evidence.directAccelerationEvents += 1;
      else if (included > 0) evidence.gravityIncludedEvents += 1;
      motionTimesRef.current.push(now);
      while ((motionTimesRef.current[0] ?? now) < now - 2_000) motionTimesRef.current.shift();

      const signal = detector.update({
        acceleration: event.acceleration,
        accelerationIncludingGravity: event.accelerationIncludingGravity,
      }, now);
      if (!signal) return;
      if (signal.strength === "soft") evidence.softSignals += 1;
      else evidence.strongSignals += 1;
      evidence.lastSignalAt = Date.now();
      evidence.lastSignalIntensity = signal.intensity;
      evidence.lastSignalMagnitude = signal.magnitude;
      addTransition("motion-signal", {
        strength: signal.strength,
        intensity: signal.intensity,
        magnitude: signal.magnitude,
      });
    };
    window.addEventListener("devicemotion", onMotion, { passive: true });
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []);

  useEffect(() => {
    const onFrame = (event: Event): void => {
      const frameTimeMs = Number((event as CustomEvent<{ frameTimeMs?: number }>).detail?.frameTimeMs);
      if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) return;
      intervalsRef.current.push(frameTimeMs);
      if (intervalsRef.current.length > MAX_FRAME_INTERVALS) intervalsRef.current.shift();
    };
    const onRender = (event: Event): void => {
      const sample = (event as CustomEvent<DeviceQaRenderSample>).detail;
      if (!sample) return;
      const evidence = renderRef.current;
      evidence.latest = sample;
      evidence.peakDrawCalls = Math.max(evidence.peakDrawCalls, sample.drawCalls);
      evidence.peakTriangles = Math.max(evidence.peakTriangles, sample.triangles);
      evidence.peakActiveVisuals = Math.max(evidence.peakActiveVisuals, sample.activeVisuals);
      evidence.peakPhysicsBodies = Math.max(evidence.peakPhysicsBodies, sample.physicsBodies);
      evidence.peakEscapedBodies = Math.max(evidence.peakEscapedBodies, sample.escapedBodies);
      evidence.peakHorizontalVelocity = Math.max(evidence.peakHorizontalVelocity, sample.maxHorizontalVelocity);
      evidence.peakVerticalVelocity = Math.max(evidence.peakVerticalVelocity, sample.maxVerticalVelocity);
    };
    const onContext = (): void => {
      renderRef.current.contextLosses += 1;
      addTransition("webgl-context-lost");
    };
    const onShake = (event: Event): void => {
      const detail = (event as CustomEvent<ShakeOutcomeDetail>).detail;
      if (!detail || detail.source !== "device-motion") return;
      if (detail.accepted) motionRef.current.acceptedGameShakes += 1;
      else motionRef.current.cooldownRejected += 1;
      addTransition("game-shake", { ...detail });
    };
    window.addEventListener(DEVICE_QA_FRAME_EVENT, onFrame);
    window.addEventListener(DEVICE_QA_RENDER_EVENT, onRender);
    window.addEventListener(DEVICE_QA_CONTEXT_EVENT, onContext);
    window.addEventListener(DEVICE_QA_SHAKE_EVENT, onShake);
    return () => {
      window.removeEventListener(DEVICE_QA_FRAME_EVENT, onFrame);
      window.removeEventListener(DEVICE_QA_RENDER_EVENT, onRender);
      window.removeEventListener(DEVICE_QA_CONTEXT_EVENT, onContext);
      window.removeEventListener(DEVICE_QA_SHAKE_EVENT, onShake);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      while ((motionTimesRef.current[0] ?? now) < now - 2_000) motionTimesRef.current.shift();
      motionRef.current.eventRateHz = motionTimesRef.current.length / 2;
      setTick((value) => value + 1);
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  // `tick` intentionally re-renders this live report once per second while
  // all high-frequency samples stay in refs (no per-frame React updates).
  void tick;
  const report = buildDeviceQaReport({
    appVersion: APP_VERSION,
    buildId: import.meta.env.VITE_BUILD_SHA || "local-unbound",
    sessionId: sessionIdRef.current,
    startedAt: startedAtRef.current,
    generatedAt: new Date().toISOString(),
    runtime: runtimeEvidence(deviceLabel),
    frame: summarizeFrameIntervals(intervalsRef.current),
    motion: { ...motionRef.current },
    feedback: {
      audioMuted: sound.qaSnapshot().muted,
      audioContextState: sound.qaSnapshot().contextState,
      audioDecodedSamples: sound.qaSnapshot().decodedSamples,
      audioLoadingSamples: sound.qaSnapshot().loadingSamples,
      ambienceName: sound.qaSnapshot().ambienceName,
      ambiencePlaying: sound.qaSnapshot().ambiencePlaying,
      hapticsSupported: haptics.qaSnapshot().supported,
      hapticsEnabled: haptics.qaSnapshot().enabled,
      qaAudioTestCount: feedbackTestsRef.current.audio,
      qaHapticTestCount: feedbackTestsRef.current.haptic,
    },
    render: { ...renderRef.current },
    stability,
    game,
    manual,
    transitions: [...transitionsRef.current],
  });
  const json = JSON.stringify(report, null, 2);
  const evidenceChecklist = buildDeviceQaEvidenceChecklist(report);

  const setManualStatus = (key: DeviceQaManualKey, status: "pending" | "pass" | "fail"): void => {
    setManual((current) => ({
      ...current,
      [key]: { ...current[key], status },
    }));
    addTransition("manual-check", { key, status });
  };

  const copyJson = async (): Promise<void> => {
    setShowJson(true);
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("已复制；下方文本仍可作为宿主限制时的兜底。");
    } catch {
      setCopyState("宿主阻止了剪贴板，请在下方全选复制。");
    }
  };

  const downloadJson = (): void => {
    setShowJson(true);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sessionIdRef.current}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setCopyState("已请求下载；如果宿主拦截，请复制下方 JSON。");
    } catch {
      setCopyState("宿主阻止了下载，请复制下方 JSON。");
    }
  };

  const copyEvidenceChecklist = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(evidenceChecklist);
      setCopyState("证据包清单已复制。");
    } catch {
      setCopyState("宿主阻止了剪贴板，请在下方复制证据包清单。");
    }
  };

  return (
    <aside className="device-qa" data-open={open ? "true" : undefined} aria-label="Device QA evidence">
      <button className="device-qa__toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Device QA · {report.verdict.toUpperCase()}
      </button>
      {open && (
        <div className="device-qa__body">
          <p className="device-qa__privacy">
            仅本机记录，不上传。QA {APP_VERSION} · {report.buildId}
          </p>
          <label>
            真机型号 / OS / 浏览器
            <input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} placeholder="iPhone 15 / iOS 20 / Safari" />
          </label>

          <section>
            <h3>环境</h3>
            <dl>
              <div><dt>HTTPS</dt><dd>{report.runtime.secureContext ? "是" : "否"}</dd></div>
              <div><dt>入口</dt><dd>{report.runtime.embedded ? "宿主 iframe" : "Standalone"}</dd></div>
              <div><dt>存储</dt><dd>{report.runtime.storageAccess}</dd></div>
              <div><dt>视口</dt><dd>{report.runtime.viewport.width}×{report.runtime.viewport.height} @{report.runtime.viewport.dpr}</dd></div>
            </dl>
          </section>

          <section>
            <h3>真实运动传感器</h3>
            <div className="device-qa__actions">
              {!motionEnabled ? (
                <button type="button" onClick={() => void requestMotion()}>请求运动权限</button>
              ) : (
                <button type="button" onClick={disableMotion}>关闭运动输入</button>
              )}
            </div>
            <dl>
              <div><dt>权限</dt><dd>{motionPermission}</dd></div>
              <div><dt>事件</dt><dd>{report.motion.eventCount} · {report.motion.eventRateHz.toFixed(1)}Hz</dd></div>
              <div><dt>软 / 强</dt><dd>{report.motion.softSignals} / {report.motion.strongSignals}</dd></div>
              <div><dt>执行 / 冷却拒绝</dt><dd>{report.motion.acceptedGameShakes} / {report.motion.cooldownRejected}</dd></div>
              <div><dt>峰值</dt><dd>{report.motion.maxRawMagnitude.toFixed(2)}</dd></div>
            </dl>
          </section>

          <section>
            <h3>真实运行</h3>
            <dl>
              <div><dt>采样</dt><dd>{(report.frame.activeDurationMs / 1000).toFixed(1)}s</dd></div>
              <div><dt>Median FPS</dt><dd>{report.frame.medianFps.toFixed(1)}</dd></div>
              <div><dt>P95</dt><dd>{report.frame.p95FrameMs.toFixed(1)}ms</dd></div>
              <div><dt>最长帧</dt><dd>{report.frame.maxFrameMs.toFixed(1)}ms</dd></div>
              <div><dt>长帧</dt><dd>{report.frame.longFramePercent.toFixed(2)}% · burst {report.frame.worstJankBurstFrames}</dd></div>
              <div><dt>Draw calls 峰值</dt><dd>{report.render.peakDrawCalls}</dd></div>
              <div><dt>刚体 / 场上</dt><dd>{report.render.peakPhysicsBodies} / {report.render.peakActiveVisuals}</dd></div>
              <div><dt>越界</dt><dd>{report.render.peakEscapedBodies}</dd></div>
              <div><dt>当前 / 底藏</dt><dd>{game.activeCount} / {game.reserveCount}</dd></div>
              <div><dt>动作事件</dt><dd>{report.transitions.length} · {DEVICE_QA_REQUIRED_TRANSITION_EVENTS.join(" / ")}</dd></div>
            </dl>
          </section>

          <section>
            <h3>长局稳定性</h3>
            <label>
              启动/重试/退出/恢复循环次数
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={stability.restartResumeCycles}
                onChange={(event) => setStability((current) => ({
                  ...current,
                  restartResumeCycles: Math.max(0, Number(event.target.value) || 0),
                }))}
              />
            </label>
            <label>
              Memory / GPU timeline 证据路径
              <input
                value={stability.memoryTimelineEvidence}
                onChange={(event) => setStability((current) => ({
                  ...current,
                  memoryTimelineEvidence: event.target.value.slice(0, 240),
                }))}
                placeholder="evidence/stability/memory-timeline.json"
              />
            </label>
            <div className="device-qa__check">
              <p>L15 长局与重启稳定结论</p>
              <label>
                <input
                  type="checkbox"
                  checked={stability.longLevel15Run}
                  onChange={(event) => setStability((current) => ({
                    ...current,
                    longLevel15Run: event.target.checked,
                  }))}
                />
                已完成至少一次 Level 15 长局
              </label>
              <label>
                内存/GPU 趋势
                <select
                  value={stability.memoryTrend}
                  onChange={(event) => setStability((current) => ({
                    ...current,
                    memoryTrend: event.target.value as DeviceQaStabilityEvidence["memoryTrend"],
                  }))}
                >
                  <option value="unknown">待确认</option>
                  <option value="flat">无持续增长</option>
                  <option value="growing">持续增长</option>
                </select>
              </label>
              <label>
                重启/恢复是否逐渐变慢
                <select
                  value={stability.restartSlowdown}
                  onChange={(event) => setStability((current) => ({
                    ...current,
                    restartSlowdown: event.target.value as DeviceQaStabilityEvidence["restartSlowdown"],
                  }))}
                >
                  <option value="unknown">待确认</option>
                  <option value="none">无</option>
                  <option value="present">有</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={stability.contextLossLoop}
                  onChange={(event) => setStability((current) => ({
                    ...current,
                    contextLossLoop: event.target.checked,
                  }))}
                />
                观察到 WebGL context-loss 循环
              </label>
              <input
                aria-label="长局稳定性备注"
                value={stability.notes}
                onChange={(event) => setStability((current) => ({
                  ...current,
                  notes: event.target.value.slice(0, 240),
                }))}
                placeholder="设备、长局关卡、内存/GPU 观察备注"
              />
            </div>
          </section>

          <section>
            <h3>音频 / 触觉人工确认</h3>
            <div className="device-qa__actions">
              <button type="button" onClick={() => {
                sound.unlock();
                sound.play("match");
                feedbackTestsRef.current.audio += 1;
                addTransition("feedback-audio-test", { count: feedbackTestsRef.current.audio });
                setTick((value) => value + 1);
              }}>播放匹配音</button>
              <button type="button" onClick={() => {
                haptics.play("shake");
                feedbackTestsRef.current.haptic += 1;
                addTransition("feedback-haptic-test", { count: feedbackTestsRef.current.haptic, supported: haptics.supported });
                setTick((value) => value + 1);
              }}>触发颠锅触觉</button>
            </div>
            <dl>
              <div><dt>音频</dt><dd>{report.feedback.audioContextState} · {report.feedback.audioDecodedSamples}/12 samples · {report.feedback.audioMuted ? "静音" : "未静音"}</dd></div>
              <div><dt>环境音</dt><dd>{report.feedback.ambienceName} · {report.feedback.ambiencePlaying ? "播放中" : "未播放"}</dd></div>
              <div><dt>触觉</dt><dd>{report.feedback.hapticsSupported ? "支持" : "不支持"} · {report.feedback.hapticsEnabled ? "开启" : "关闭"}</dd></div>
              <div><dt>QA 测试</dt><dd>音频 {report.feedback.qaAudioTestCount} · 触觉 {report.feedback.qaHapticTestCount}</dd></div>
            </dl>
            <p>API 调用成功不能证明人耳/手感通过，请在下方人工门禁记录真实结果。</p>
          </section>

          <section>
            <h3>人工真机门禁</h3>
            <div className="device-qa__checks">
              {DEVICE_QA_MANUAL_CHECKS.map(([key, label]) => (
                <div className="device-qa__check" key={key}>
                  <p>{label}</p>
                  <div role="group" aria-label={label}>
                    {(["pending", "pass", "fail"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        data-selected={manual[key].status === status ? "true" : undefined}
                        onClick={() => setManualStatus(key, status)}
                      >
                        {status === "pending" ? "待测" : status === "pass" ? "通过" : "失败"}
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label={`${label} 备注`}
                    value={manual[key].note}
                    onChange={(event) => setManual((current) => ({
                      ...current,
                      [key]: { ...current[key], note: event.target.value.slice(0, 160) },
                    }))}
                    placeholder="可选备注"
                  />
                  <input
                    aria-label={`${label} 证据路径`}
                    value={manual[key].evidence}
                    onChange={(event) => setManual((current) => ({
                      ...current,
                      [key]: { ...current[key], evidence: event.target.value.slice(0, 240) },
                    }))}
                    placeholder="录像/trace/截图路径或编号"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="device-qa__verdict" data-verdict={report.verdict}>
            <h3>{report.verdict === "pass" ? "真机门禁通过" : report.verdict === "fail" ? "真机门禁失败" : "证据未完成"}</h3>
            {report.failures.map((failure) => <p key={failure}>失败：{failure}</p>)}
            {report.missingEvidence.slice(0, 8).map((missing) => <p key={missing}>待补：{missing}</p>)}
            {report.missingEvidence.length > 8 && <p>另有 {report.missingEvidence.length - 8} 项待补</p>}
          </section>

          <section>
            <h3>证据包清单</h3>
            <p>把 JSON、录像、trace、截图按这份清单放进同一证据包，再用离线脚本验收。</p>
            <textarea className="device-qa__bundle" readOnly value={evidenceChecklist} aria-label="Device QA 证据包清单" />
          </section>

          <div className="device-qa__actions">
            <button type="button" onClick={() => void copyJson()}>复制 JSON</button>
            <button type="button" onClick={downloadJson}>下载 JSON</button>
            <button type="button" onClick={() => setShowJson((value) => !value)}>显示 JSON</button>
            <button type="button" onClick={() => void copyEvidenceChecklist()}>复制证据包清单</button>
          </div>
          {copyState && <p role="status">{copyState}</p>}
          {showJson && <textarea className="device-qa__json" readOnly value={json} aria-label="完整 Device QA JSON" />}
        </div>
      )}
    </aside>
  );
}
