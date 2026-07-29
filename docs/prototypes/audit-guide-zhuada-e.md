# 抓大鹅 (zhuada-e) 审计指南 · Audit Guide

> 目标版本：v2.3（B 类物理抽物 / 托盘三连消除，Three.js + cannon-es，免费 guest 模式）
> 用途：一份**可逐条打勾**的审计清单，覆盖设计完整性、平衡、技术正确性、合规与可上线性。
> 用法：每一节逐条判定 **✓ Pass / △ Partial / ✗ Fail**，并记下证据（文件:行号 或 实测数值）。最后用第 10 节「Ship Gate」给结论。

---

## 0. 审计输入（开这些文件）

| 类别 | 路径 |
|------|------|
| GDD | `design-prototypes/gdd-zhuada-e.md`（v2.3，含 changelog） |
| 总览 | `docs/archive/overview.md` |
| 逻辑 | `apps/zhuada-e/src/logic/{engine-zhuada,game-rules,guest-engine,sound}.ts` |
| 场景 | `apps/zhuada-e/src/scenes/{ZhuaDaScene,models}.ts` |
| 外壳 | `apps/zhuada-e/src/{PlayArea,main,ThreeGameComponent}.{tsx,ts}` + `PlayArea.scss` |
| 平衡 | `apps/zhuada-e/scripts/tune.mjs` |
| 产物 | `apps/zhuada-e/dist/`；宿主已 stage 到 `platform/host-app/public/miniapps/zhuada-e/` |

---

## 1. 设计支柱合规（Design Pillars）

先确认本作支柱（取自 GDD 设计意图），逐条验证玩家是否真感受到：

| 支柱 | 玩家应感受到 | 审计方法 |
|------|--------------|----------|
| **能动性 Agency** | 每次点击都在「选择下一个挖出谁」 | 观察一局：点击是否始终改变局面、是否由玩家决策而非脚本 |
| **期待 Anticipation** | 托盘里「差一个就消」的 near-miss 张力 | 检查托盘是否存在 2 同色停留 → 诱发「再来一个」冲动 |
| **损失厌恶 Loss Aversion** | 倒计时 + 托盘逼近填满的压迫 | 检查 timer 与 tray-fill 是否实时可见、是否制造决策压力 |
| **原创美术诚实** | 造型可爱但不复制正版 IP | 目视 `models.ts` 12 种模型 + 大鹅，确认无 IP 素材 |
| **可上线免费模式** | 不接链也能完整体验 | 确认 guest engine 闭环（开始→胜/负→下一关），无合约依赖 |

**Pass 标准**：5 条支柱均有对应机制且玩家可感知。
**当前基线**：前 4 条机制齐备；第 5 条 free mode 已闭环（v2.3 已验证胜利链路）。**长线留存支柱缺**（见第 2 节）。

---

## 2. 核心循环完整性（Fun Hypothesis）

核心循环（GDD §3）：

```
掉落(cannon-es) → 射线拾取(pointerdown) → 入托盘(7 槽)
  → 三连消除(+分+连击) → 盒空=胜(solved) / 托盘满且无可消 或 超时=负(expired)
```

**Fun hypothesis 测试**：「从堆叠里挖出一个实体，看它啪地落进托盘、三连消失」这一刻必须爽。逐项确认三层循环都交付：

| 层级 | 检查 | Pass 标准 |
|------|------|-----------|
| 即时(0–30s) | 首控 30s 内引入核心动词「挖」 | 开局即落盒可点，无前置教学阻塞 |
| 会话(5–30min) | 一局目标=清空盒子，张力=时间/托盘 | 单局有明确胜负与后果 |
| 长线(小时–周) | 进度钩子（日奖励/赛季/社交） | **当前缺口**：仅 15 关线性递进，无 meta-progression |

**Onboarding 检查表**（GDD 规范）：
- [x] 核心动词 30s 内出现
- [x] 首胜可保底（无失败 possible in beat 1 — 第 1 关时间宽松）
- [x] 每个机制在低风险情境引入
- [ ] 至少一个机制靠**探索**发现（非文字）— 待确认是否有「隐藏可点」物
- [x] 首局结束有钩子（过关→下一关 / 全清）

**当前基线**：即时+会话循环已端到端验证（胜利 score 237 / items 0）。**长线循环为缺口**，列为 Ship-with-fixes 项。

---

## 3. 机制规格完整性（Mechanic Spec）

按 GDD 规范，**每个机制须有 8 字段规格**：Purpose / Player Fantasy / Input / Output / Success / Failure / Edge Cases / Tuning Levers / Dependencies。（9 字段，含 Dependencies）

需覆盖的机制清单：

| 机制 | GDD 章节 | 8 字段完整？ |
|------|----------|--------------|
| 射线拾取 Extract | §5 | ✓ |
| 托盘三连 Tray 3-match | §5 | ✓ |
| 胜负 Win/Lose | §5 | ✓ |
| 道具 Power-ups（洗牌/提示/加时） | §5 | ✓（含限量+里程碑回赠） |
| 计分+连击 Scoring/Combo | §6 | ✓ |
| 关卡递进 Level Progression | §3/§6.1 | ✓ |
| 音频 Audio | §10.5 | ✓ |
| 移动端拾取 Mobile Pick | §10.5 | ✓ |

**Pass 标准**：清单内每个机制在 GDD 有条目且无 ambiguous 字段。
**当前基线**：8 个机制均有 GDD 条目。部分 Tuning Levers 仍为 `[PLACEHOLDER]`（见第 9 节）——属合法待调项，不判 Fail。

---

## 4. 平衡与经济（Balance & Economy）

**4.1 可解性（必过项）**
```
cd apps/zhuada-e && node scripts/tune.mjs
```
- 期望：15 关 **greedyWin% = 100%**；randomWin% 作「宽容度」参考（越低越吃操作）。
- **当前基线**：v2.3 回归通过，15 关贪心 100% 可解。

**4.2 难度曲线**
- 种类 `kinds` 3→12、每份 `perKind` 2→4、时间 40s→230s（时间随物品数增长，已修正旧曲线不可解问题）。
- 检查：相邻关跃变是否过陡（尤其 kinds 跳变处）。

**4.3 无死锁 / 无死循环**
- 死锁：托盘满且无可消三元组 → `isTrayStuck` → `expired`（证据 `guest-engine.ts:276`）。
- 死循环：盒空即 `solved`，无无限资源。
- **Pass 标准**：两种终止态都可触发且有后果。

**4.4 道具经济（来源/ sinks）**
- 来源：开局赠送（shuffle:1/hint:3/addTime:1）+ 里程碑回赠（破 100 分+1 提示、破 200+1 加时、4 连+1 加时）。
- Sinks：使用时消耗。
- 检查：回赠速率是否会让某道具溢出无用 / 或永远不够（**本作为免费模式，鲸鱼/海豚/小鱼分层不适用**，记录即可）。

**当前基线**：可解性✓、终止态✓、经济闭环✓。

---

## 5. 技术正确性（6 大坑 + 边界）

**5.1 六大致命坑（逐个确认已实现）**

| # | 坑 | 正确做法 | 证据/检查 |
|---|----|----------|-----------|
| 1 | cannon-es 0.20.0 刚体不动 | `world.step(1/60, dt, 3)` **非** `fixedStep()` | 搜 `world.step` |
| 2 | rAF 节流下生成卡死 | 生成节奏用**未钳制 rawDt** 累加 | 搜 `spawnAccum += rawDt` |
| 3 | 射线打偏 | 拾取前 `camera/scene.updateMatrixWorld()` | 搜 `updateMatrixWorld` 在 raycast 前 |
| 4 | 触屏被吞 | canvas 包裹层 `touch-action:none`+禁选+禁高亮+overscroll | SCSS |
| 5 | 音频版权/自动播放 | 纯合成 WebAudio + 首次手势 `resume()` | `sound.ts` + `unlock()` |
| 6 | 调参需重建 | `readTuneNum()` URL 覆盖（`?combo/bonus/gravity`） | `game-rules.ts` |

**5.2 边界用例（逐条确认有处理）**

| 边界 | 期望行为 | 检查点 |
|------|----------|--------|
| 托盘满 + 无可消三元组 | `expired` | `isTrayStuck` 支线 |
| 倒计时归零 | `expired` | timeline 在 `guest-engine` |
| 盒已空时洗牌 | 无操作/重落空盒（不崩） | `shuffleNonce` 仅在 `dealt` 响应 |
| 无可消物时提示 | 高亮「盒中最多数」或空响应 | `computeHintKind` 兜底 |
| 非 dealt 状态点击 | 忽略 | `gameStatus !== "dealt"` 守卫 |
| 同帧重复拾取 | 防重入（`extracting` 标记） | 搜 `extracting` |
| 连击窗口过期 | 连击清零 | `COMBO_WINDOW_MS` 定时器 |

**当前基线**：6 坑全部实现；边界用例已接线。**注意**：本环境无浏览器自动化，5.1#3/#4 与 5.2 的真机手感需在设备用 `?debug=1` 复检（逻辑层已覆盖）。

---

## 6. 玩家反馈与打击感（Feedback & Juice）

| 通道 | 检查 | 当前基线 |
|------|------|----------|
| 音效 | 9 种 cues、静音持久化、手势解锁 | `sound.ts` 合成引擎，已接引擎/场景/HUD |
| 视觉 | 拾取按压、消除 pop、胜利大鹅动画、提示脉冲 | 场景 `playWin`/`pulseHint` 等 |
| 触觉 Haptic | 移动端振动反馈 | **缺口**：未接入 `navigator.vibrate` |

**Pass 标准**：每个关键动作（落/拾/消/胜/负/道具）至少有视觉或音效反馈。
**当前基线**：音+视齐备；**触觉为缺口**（非阻断）。

---

## 7. 移动端与无障碍（Mobile & A11y）

| 项 | 检查 | 当前基线 |
|----|------|----------|
| 触控 | `pointerdown` + `touch-action:none` + `user-select:none` + tap-highlight 透明 + `overscroll-behavior:contain` | SCSS 已设 |
| 降动效 | `prefers-reduced-motion` 关闭动画 | `PlayArea.scss` 媒体查询 |
| 语义化 | `aria-*` / `role=` | React 有覆盖（PlayArea 18 行、ThreeGameComponent 7 行） |
| 画布可访问性 | 3D canvas 键盘可操作 / 有 aria-label 兜底 | **缺口**：canvas 本身不可键盘操作，建议加 `aria-label` 或文本降级说明 |

**当前基线**：触控+降动效+语义化良好；**canvas 键盘可达性为缺口**。

---

## 8. 合规与可上线（Compliance & Shippability）

| 项 | 检查 | 当前基线 |
|----|------|----------|
| 原创美术 | `models.ts` 由基础几何体组合，无正版 IP | ✓（大鹅为 `buildGoose()`，非 emoji 🪿，v2.1 已替换） |
| 原创音频 | 合成音效，无授权文件 | ✓ |
| 构建 | `npm run build` 通过；入口 ~220KB/gzip ~70KB；场景懒加载块 | ✓（v2.3） |
| Lint | `npx eslint src` 0/0 | ✓ |
| 发布 | `stage:miniapps-dist -- zhuada-e` catalog 含 slug + lazy chunk | ✓ |
| 控制台 | 无报错（仅无关 `ranksTab` i18n 警告） | ✓ |
| 隐私 | 仅 `localStorage` 静音偏好，无 PII/遥测 | ✓ |

**Pass 标准**：原创性 + 构建 + 发布 + 隐私全部绿。
**当前基线**：全绿，可上线免费模式无合规阻碍。

---

## 9. 文档健康（Documentation Health）

- [x] GDD 已版本化（v2.3）且带 changelog
- [x] 所有 `[PLACEHOLDER]` 已追踪：**当前仅 3 处**
  - `game-rules.ts:54` 关卡曲线（「待真人试玩确认」）
  - `game-rules.ts:66` `COMBO_WINDOW_MS`（连击窗口）
  - `game-rules.ts:67` `COMBO_BONUS_PER_STEP`（连击加成）
  - 这 3 处是**合法的「假设待调」标记**，不是文档缺失，不判 Fail。
- [x] 无无理由魔法数（常量均有注释/rationale）

**Pass 标准**：版本化 + 占位符全追踪 + 无裸魔法数。

---

## 10. Ship Gate（发布闸门 · 评分卡）

为每节给 **✓ / △ / ✗**，然后按闸门判定：

| 节 | 主题 | 判定 |
|----|------|------|
| 1 | 设计支柱 | △（缺长线留存支柱） |
| 2 | 核心循环 | △（缺长线循环；onboarding 探索项待确认） |
| 3 | 机制规格 | ✓ |
| 4 | 平衡经济 | ✓ |
| 5 | 技术正确性 | ✓（真机手感待设备复检） |
| 6 | 反馈打击感 | △（缺触觉） |
| 7 | 移动/无障碍 | △（canvas 键盘可达性） |
| 8 | 合规上线 | ✓ |
| 9 | 文档健康 | ✓ |

**闸门规则**：
- **BLOCK（阻断）**：若 4 节可解性 Fail、或 5 节任一致命坑 Fail、或 8 节合规 Fail。
- **SHIP-WITH-FIXES（带修发布）**：仅非阻断项 △，且无 ✗。
- **SHIP（可发）**：全 ✓ 或仅预期内 △（如占位符待调）。

**v2.3 当前结论：SHIP-WITH-FIXES**
- 阻断项全无；可上线免费模式无障碍。
- 待办（按优先级）：
  1. **真机 playtest 校准手感**（3 个 `[PLACEHOLDER]` + 5.1#3/#4 真机复检）— 用 `?debug=1&combo=2200&gravity=-16` 现场 A/B。
  2. 长线留存循环（日奖励/赛季/社交）— 决定「小时–周」层是否成立。
  3. 触觉反馈（`navigator.vibrate`）。
  4. canvas 无障碍（`aria-label` / 文本降级）。

---

## 附录：审计快命令

```bash
# 从应用目录执行（cwd 每次调用会重置到仓库根）
cd /Users/jinghuiliao/git/r3e/neo-os-web/apps/zhuada-e

npx eslint src                              # 期望 0/0
npm run build                               # 入口 ~220KB/gzip ~70KB
node scripts/tune.mjs                       # 期望 15 关 greedy 100%
npm run stage:miniapps:dist -- zhuada-e     # 发布到宿主 public + 更新 catalog

# 真机审计（手感/触屏/音频可听感）
# 起 dev：npm run dev → 打开 /miniapps/miniapp-zhuada-e?debug=1&combo=2200&bonus=8&gravity=-16
# debug 面板：实时 FPS / 状态 / 调参值 + Force Win / Force Lose / Skip
```

> 本指南的方法论（支柱合规 + 核心循环 + 机制规格 + 平衡 + 技术坑 + 反馈 + 移动/无障碍 + 合规 + 文档 + Ship Gate）可复用于任何「物理抽物 / 托盘三连」类小游戏；对应技术坑见 `physics-pick-game` skill 的 `references/gotchas.md`。
