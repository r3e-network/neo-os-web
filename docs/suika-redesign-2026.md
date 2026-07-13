# 重建设计规格：fruit-funnel → Suika Orchard（合成西瓜）

> 审计来源：`docs/game-realcase-audit-2026.md` P0。原 `fruit-funnel` 是 match-2 漏斗配对游戏，与原作《合成大西瓜 / Suika Game》**零重叠**（无物理、无进化合成链、无顶部警戒线）。本规格把它重建为真正的物理下落合成游戏，使其核心玩法与原作 1:1 对齐。
>
> 版本：v1 (2026-07-13)　作者：GameDesigner　状态：实现完成（待真机物理 playtest）

---

## 1. 设计支柱（Design Pillars）

1. **物理即玩法** — 重力、碰撞、堆叠必须是真实可感的，不是动画伪装（原作灵魂）。
2. **同类合成进化** — 两个同级水果接触即合成高一级，形成 11 级进化链，这是 Suika 唯一的"进度感"来源。
3. **风险可见** — 顶部警戒线 + 缓冲宽限期让"快输了吗"始终可读，紧张感来自堆叠而非计时器。
4. **零钱包、纯本地** — 沿用平台 guest 模式，不引入链上依赖（与原作一致，也符合 `game-renderer-policy`）。

## 2. 核心循环（Core Loop）

### Moment-to-Moment (0–30 秒)
- **Action**：玩家在顶部水平拖动瞄准下一个水果，点击/松手投放。
- **Feedback**：水果受重力下落、与其它水果碰撞堆叠；两个同级接触瞬间合成升级，伴随"啵"的合并音效 + 轻微缩放弹跳（≤200ms，非 bounce 命名）。
- **Reward**：得分即时跳动；合成更高阶水果的视觉满足。

### Session Loop (5–15 分钟)
- **Goal**：在堆叠越过警戒线前，尽量合成高阶水果、刷高分。
- **Tension**：堆叠高度逼近顶部警戒线；越线且静止超过宽限期即结束。
- **Resolution**：游戏结束 → 显示本局得分与本地最佳，可一键重开。

### Long-Term Loop
- **Progression**：本地最佳分（localStorage 持久化）。
- **Retention Hook**：每次落子的"下一个"随机性带来的重开冲动；最佳分社会化展示位（框架 `stats` 可接入）。

## 3. 机制规格（Mechanic Specification）

### Mechanic: 投放（Drop）
- **Purpose**：把当前水果送入物理世界。
- **Player Fantasy**："我决定它落在哪"的精确控制感。
- **Input**：指针水平移动设 aimX；点击/松手或键盘 Space/Enter 触发投放。
- **Output**：在 `(aimX, DROP_Y)` 生成一个 `currentLevel` 的 Matter 圆形刚体；队列前移（`currentLevel = nextLevel`，`nextLevel = randLevel()`）。
- **Success Condition**：水果生成后受重力下落并参与碰撞。
- **Failure State**：aimX 越界（已在场景内 clamp，不会触发失败）。
- **Edge Cases**：
  - 投放冷却期内再次触发 → 忽略（防连点穿模）。`[PLACEHOLDER] 350ms`
  - 游戏非 playing 态 → 忽略。
- **Tuning Levers**：`DROP_Y`、`DROP_COOLDOWN_MS`、`MAX_DROPPABLE_LEVEL`(=4)。
- **Dependencies**：engine.dropFruit、scene 刚体创建、队列状态。

### Mechanic: 合成（Merge）
- **Purpose**：两个同级水果合并为高一级，是唯一的进度与得分来源。
- **Player Fantasy**："连锁反应"的爽感。
- **Input**：Matter `collisionstart` 事件，两刚体 `level` 相同且均未被标记 merging。
- **Output**：移除两刚体，在接触中点生成 `level+1` 刚体；`score += SCORE_PER_MERGE[level+1]`；若 `level+1 > MAX_LEVEL`（即两个西瓜合并）→ 移除两者、不生成新体、`score += WATERMELON_BONUS`。
- **Success Condition**：合成后新水果参与后续堆叠与连锁合成。
- **Failure State**：同帧多次碰撞导致重复合成 → 用 `merging` 标记 + id 去重防护。
- **Edge Cases**：
  - 三方同碰（A 碰 B 同时 B 碰 C）→ 逐个处理，B 标记 merging 后第二批跳过。
  - 合成瞬间新水果又碰同级 → 允许连锁（这是想要的 emerge）。
- **Tuning Levers**：`SCORE_PER_MERGE[]`、`WATERMELON_BONUS`、`MAX_LEVEL`(=10)。
- **Dependencies**：engine.mergeFruits、scene 刚体增删、score 状态。

### Mechanic: 警戒线失败（Game Over）
- **Purpose**：定义失败，制造堆叠张力。
- **Player Fantasy**："再挤一下就爆了"的临界紧张。
- **Input**：每物理帧检测任意水果 `top = y - radius < DANGER_Y` 且速度低于 `SETTLE_SPEED`。
- **Output**：该水果 `overLineSince` 计时；若持续超过 `GRACE_MS` → `engine.setGameOver()`，phase=gameover，刷新 best。
- **Success Condition**：正常游玩中水果不会在线上静止超过宽限。
- **Failure State**：误判（水果正穿过线下落中）→ 用 `SETTLE_SPEED` 阈值排除下落中水果。
- **Edge Cases**：
  - 两果叠高、下面那只静止越线但上面还在动 → 仅静止那只计时不导致误杀（任一越线静止即触发，符合原作）。
  - 暂停态不计时。
- **Tuning Levers**：`DANGER_Y`、`GRACE_MS [PLACEHOLDER 1500]`、`SETTLE_SPEED [PLACEHOLDER 0.6]`。
- **Dependencies**：engine.phase、scene 物理步、best 持久化。

## 4. 数值表（Economy / Tuning）— 全部 [PLACEHOLDER] 待 playtest

```
Variable                | Base        | Min  | Max   | Tuning Notes
------------------------|-------------|------|-------|----------------------------------
MAX_LEVEL               | 10          | 8    | 11    | 11 级=樱桃→西瓜；低于 8 太短
MAX_DROPPABLE_LEVEL     | 4           | 3    | 5     | 只掉最小的 5 种，与原作一致
FRUIT_RADII[0..10]      | 16..120     | —    | —     | 每级递增；西瓜 d≈240 需适配 350 宽
SCORE_PER_MERGE[L]      | T(L)*10     | —    | —     | 三角数 T(L)=L(L+1)/2；×10 缩放
WATERMELON_BONUS        | 100         | 50   | 200   | 两西瓜合并清除奖励 [PLACEHOLDER]
GRAVITY_Y               | 1.1         | 0.8  | 1.6   | 手感：太轻飘、太重砸 [PLACEHOLDER]
RESTITUTION             | 0.08        | 0    | 0.2   | 低弹性防弹跳穿模
FRICTION                | 0.4         | 0.2  | 0.6   | 堆叠稳定
DANGER_Y                | 150         | 120  | 200   | 警戒线高度（逻辑坐标 y）
GRACE_MS                | 1500        | 800  | 2500  | 越线静止宽限 [PLACEHOLDER]
SETTLE_SPEED            | 0.6         | 0.3  | 1.0   | 判定"静止"的速度阈值 [PLACEHOLDER]
DROP_COOLDOWN_MS        | 350         | 200  | 500   | 防连点穿模 [PLACEHOLDER]
```

## 5. 与框架契约（Policy Compliance）

- **`game-renderer-policy`**：继续使用 Phaser 3（Matter 物理，Phaser 内置，非引入 Three.js）；场景不持有"进度真相"——`SuikaEngine`（纯逻辑）是 score / phase / board 模型的唯一真相源，`SuikaScene` 仅持有 Matter 刚体并把落子/合成/越线等**转移**汇报给 engine；位置随 board 同步以支持 `restore`。
- **状态真相**：`SuikaSnapshot = { version, board:{id,level,x,y}[], currentLevel, nextLevel, score, best, phase, lastAction }`。场景在每次合成/周期(≈700ms)/暂停时 `dispatch('syncBoard', positions)` 让 engine 的 board 坐标与物理一致，保证刷新可恢复。
- **a11y / reduced-motion**：场景内键盘（←/→ 移瞄准、Space/Enter 投放、P 暂停、R 重开）；React a11y 按钮派发 `intent` 可观察量，场景 `onStateUpdate` 读取执行；`prefers-reduced-motion` 时禁用合并弹跳 tween（BaseScene 已提供 `reducedMotion` 与 `animate` 守卫）。

## 6. 实现清单（Build Order）

1. `logic/suika-engine.ts` — 纯逻辑：fresh/restore/snapshot/dropFruit/mergeFruits/syncBoard/setGameOver/isValidSuikaSnapshot + 数值常量。
2. `scenes/SuikaScene.ts` — Matter 世界、墙、警戒线、瞄准预览、投放、collisionstart 合成、update 越线检测、键盘/a11y intent。
3. `main.tsx` — 注册 `dropCurrent`/`moveAim`/`togglePause`/`restartGame` + `intent` 可观察量 + 持久化。
4. `PhaserPlayArea.tsx` — 绑定新 snapshot（score/best/currentLevel/nextLevel/phase）+ a11y 按钮。
5. `locale/messages.ts` / `manifest.ts` — 文案与标题改为合成西瓜风格。
6. `PlayArea.scss` — `.fruit-funnel` → `.suika` 根，保留 v2 令牌化。

## 7. 验证

- `sass --load-path` 真实编译通过；`tsc --noEmit` 0 错误。
- **无法在本环境跑浏览器**，故物理手感（重力/弹性/越线宽限）标 `[PLACEHOLDER]`，需真机 playtest 后锁定。
- 逻辑层（engine）纯函数，可做单元自检：fresh→drop→merge→score 增量、mergeFruits 越界保护、watermelon 双向清除。

## 8. Changelog

- 2026-07-13 — v1：初版规格，启动 P0 重建。
- 2026-07-13 — 实现完成：新增 `logic/suika-engine.ts`（纯逻辑真相源，fresh/restore/snapshot/dropFruit/mergeFruits/syncBoard/setGameOver/isValidSuikaSnapshot + 数值常量）、`scenes/SuikaScene.ts`（Matter 世界、墙、警戒线、拖拽+键盘瞄准、collisionstart 合成、update 越线检测、暂停冻结物理）、重写 `main.tsx`（SuikaEngine 接线 + dropCurrent/mergeFruits/setGameOver/syncBoard/setAim/nudgeAim/togglePause/restartGame 动作）、`PhaserPlayArea.tsx`（physics matter config + SuikaScene + a11y 控件）、`locale/messages.ts`（Suika 文案）、`manifest.ts`（Suika Orchard）、`PlayArea.scss`（绿色果园主题、删心跳死代码）。删除旧 `FruitFunnelScene.ts`/`scene-copy.ts`。**验证：tsc 0 错误、sass 编译通过。物理手感（GRAVITY_Y/RESTITUTION/FRICTION/DANGER_Y/GRACE_MS/SETTLE_SPEED/DROP_COOLDOWN_MS）标 `[PLACEHOLDER]`，需真机 playtest 后锁定。**
