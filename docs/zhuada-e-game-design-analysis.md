# 抓大鹅 (Goose Basket Shuffle) — 玩法与平衡性设计评审

> 分析对象：`apps/zhuada-e/`（v3.1.0，Three.js + cannon-es 物理，React 18）
> 角色：GameDesigner｜日期：2026-07-12
> 定位：这是一个 **3D 物理堆料 + 7 格托盘三连消除** 的核心循环，叠加 **9 场景大鹅收集** 作为元进度，模式对标"羊了个羊"但更休闲（默认无计时）。

---

## 1. 核心循环 (Core Loop)

### Moment-to-Moment (0–3 秒)
- **Action**：玩家点击 3D 盒中堆叠的物理物品，把它"拔"进底部 7 格托盘
- **Feedback**：射线拾取命中 → 物品飞入托盘对应槽位（同类左对齐聚集）→ 同色高亮
- **Reward**：同种满 3 个即消除，触发 `match`/`combo` 音效 + 震动 + 分数跳动

### Session Loop (2–11 分钟，依关卡)
- **Goal**：把盒中全部物品清空即过关（`winLevel`）
- **Tension**：7 格托盘塞满且无三连 = 卡死失败（`isTrayStuck`）；可选计时模式下超时也失败
- **Resolution**：过关解锁本级 + 场景结算大鹅（每场景末关）；失败可"复活羽毛"续命一次

### Long-Term Loop (小时–周)
- **Progression**：24 关 / 9 场景，逐关解锁；累计胜场、最佳分、9 只限定大鹅收藏
- **Retention Hook**：大鹅收集（每场景 1 只限定款）+ 存档续玩 + 复活羽毛 + 每日挑战/连签循环（R4 已落地）+ 第二篇章内容扩展（R7 已落地）。

---

## 2. 机制拆解

| 机制 | 位置 | 设计意图 |
|------|------|----------|
| 7 格托盘 + 3 格侧架**跨区匹配** | `engine-zhuada.ts: applyExtractShelf` | 有效容量扩到 10，且侧架参与三连，是核心防卡死杠杆 |
| 5 种道具（洗牌/提示/移出/撤回/晃一晃） | `guest-engine.ts` | 救援工具箱，抵消"羊了个羊"式劝退 |
| 物品流（40–54 可见窗 + 底部储备） | `item-stream.ts` | 物理性能封顶，同时用"完整三连分包"防止某类被永久埋死 |
| 关卡曲线（种类/数量递增，计时随量走） | `game-rules.ts: LEVEL_CURVE` | 确定性难度曲线 |
| 里程碑道具返还 | `game-rules.ts: milestonesFor` | 按本级分数上限动态设阈值，保证每关都可达 |
| 种子确定性 | `engine-zhuada.ts: makeRng` | 可复现、可测试、可审计 |
| 存档/续玩/切后台暂停 | `guest-engine.ts` | 移动端健壮体验 |
| 复活羽毛（每局 1 次） | `continueAfterFailure` | 软化处理失败的损失厌恶 |

---

## 3. 做得好的地方（Strengths）

1. **可解性有数学保证**。每种数量恒为 3 的倍数 + 托盘/侧架恒不滞留 3 同（不变式）+ 储备按完整三连分包 → 理性玩家 100% 可通过。这是消除类游戏最容易翻车的点，这里处理得很扎实。
2. **侧架跨区匹配是优雅的防挫败设计**。比单纯"加格子"更聪明——它让"移出"道具有了意义，且把有效决策空间从 7 拓到 10，却没破坏核心张力。
3. **默认无计时（G1 奇偶对齐）** 对休闲/年长用户友好；计时只作为可选挑战模式。时钟预算 = `拾取数×1.5s + 12s 缓冲`（向上取整到 5s），我已核对 24 关全部吻合——意味着计时几乎从不是绑定性约束，符合"靠遮挡+多样性制造难度，而非靠不公时钟"的设计哲学。
4. **L1 有"数学胜利地板"**（3 类 × ≤2 份 = 6 < 7 格，托盘永不卡死），是合格的零失败教学关。
5. **物品流遮挡是真正的挑战源**：只露 48 个、其余在储备，玩家必须"挖掘"埋在堆下的物品——这是该游戏的"fun hypothesis"，且被物理引擎放大得很爽。
6. **连击窗口从 1500ms 放宽到 2200ms**（`COMBO_WINDOW_MS`），因为物理拾取有天然间隔，窄窗口会让连击罕见而沮丧。这是"手感优先于数值"的好例子。

---

## 4. 平衡性体检（含实测数据）

### 4.1 难度曲线（实测自 `LEVEL_CURVE`）

| 关 | 场景 | 种类 | 每类份 | 物品总数 | 三连数 | 计时(s) | 备注 |
|----|------|------|--------|----------|--------|---------|------|
| 1 | 花园 | 3 | 2 | 18 | 6 | 40 | 教学地板，全可见 |
| 2 | 花园 | 7 | 4 | 84 | 28 | 140 | ⚠️ 难度悬崖 |
| 3 | 果园 | 10 | 7 | 210 | 70 | 330 | |
| 4 | 果园 | 11 | 8 | 264 | 88 | 410 | |
| 5 | 果园 | 12 | 9 | 324 | 108 | 500 | |
| 6 | 池塘 | 10 | 7 | 210 | 70 | 330 | 场景软重置（比 L5 易）|
| 7 | 池塘 | 11 | 8 | 264 | 88 | 410 | |
| 8 | 池塘 | 12 | 10 | 360 | 120 | 555 | |
| 9 | 农场 | 10 | 8 | 240 | 80 | 375 | |
| 10 | 农场 | 11 | 9 | 297 | 99 | 460 | |
| 11 | 农场 | 12 | 10 | 360 | 120 | 555 | |
| 12 | 雪原 | 11 | 9 | 297 | 99 | 460 | |
| 13 | 雪原 | 12 | 11 | 396 | 132 | 610 | |
| 14 | 夜市 | 12 | 11 | 396 | 132 | 610 | |
| 15 | 夜市 | 12 | 12 | 432 | 144 | 660 | 终关 |

**观察**：
- 场景边界存在"软重置"（如 L5→L6 物品数 324→210），给玩家换场景喘息——**这是好的节奏设计**，应保留。
- ⚠️ **L1→L2 是单步最大跳变**：物品 18→84（4.6×），种类 3→7（2.3×）。L1 是零失败教学，玩家刚建立安全感，L2 立刻 7 类塞进 7 格托盘，新手极易卡死。对 24 关休闲收集游戏而言，这是**最大的流失风险点**。

### 4.2 里程碑道具返还经济（实测自 `milestonesFor`）

分数上限 = `种类 × 每类份 × 10`；提示阈值 ≈ 上限×30%，加时阈值 ≈ 上限×60%。

| 关 | 分数上限 | 提示返还@ | 加时返还@ | 4连击返还 |
|----|----------|-----------|-----------|-----------|
| 1 | 60 | 20 | 40 | +1 提示 |
| 2 | 280 | 85 | 170 | +1 提示 |
| 5 | 1080 | 325 | 650 | +1 提示 |
| 15 | 1440 | 430 | 860 | +1 提示 |

**⚠️ 关键发现（无计时模式返还饥饿）**：
代码 `guest-engine.ts:919-925` 中，加时返还**仅在 `timedMode` 为真时发放**。而默认就是无计时模式 → **无计时玩家整局只能拿：开局 1 洗/3 提示/1 移出/1 撤回，外加中段 +1 提示(30% 上限) 和 +1 提示(4 连击)**。他们**永远拿不到移出/撤回的中段返还**。而计时玩家（上限更宽松的返还）反而更舒服——这是**反向经济**。一旦前期误用移出/撤回，无计时玩家会陷入无救援可卡的死局。

---

## 5. 风险点与改进提案（按影响力排序）

### R1 —【高】修复无计时模式的道具返还饥饿
- **问题**：如上，无计时玩家中段返还只有提示，移出/撤回用掉即没了。
- **方案**：把"加时里程碑"在无计时模式**改发为 +1 移出 或 +1 撤回**（二选一或轮换）。这样两种模式都拿到"信息/空间"型救援，且加时在无计时下本就是死资源。
- **改动量**：`milestonesFor` 增加 `untimedRefund: "remove" | "undo"`，`extract()` 内按 `timedMode` 分支发放。约 15 行。

### R2 —【高】削平 L2 难度悬崖
- **问题**：第 2 关就 7 类/84 物，新手流失主因。
- **方案 A（推荐）**：在 L1、L2 间插入一个 **5 类×3 份 = 45 物** 的过渡关，把"悬崖"推到 L3。或
- **方案 B**：保留 L2=7 类，但**强制教学**：前 2 次卡死风险由系统高亮可消除组（一次性引导），并保底送 1 次移出。
- **改动量**：曲线改 1 行 +（若选 B）引导逻辑约 40 行。

### R3 —【中】大鹅从"纯装饰"升级为"被动加成"
- **问题**：6 只大鹅仅外观，无机制价值 → 收藏驱动力弱， replay 动机不足。
- **方案**：每只解锁的大鹅提供轻量永久增益（ endowment + 沉没成本）。例：
  - 花园鹅：开局 +1 提示
  - 池塘鹅：晃一晃冷却 -1s
  - 农场鹅：连击窗口 +200ms
  - 夜市鹅：里程碑阈值 -10%（返还更早）
  增益温和，仅作"努力可见"，不破坏可解性。
- **改动量**：`progress.ts` 读 goose 列表 → `enterLevel` 注入微调参数。约 60 行 + 平衡表。

### R3 — 已实施（2026-07-12）

**玩家体验目标**：让收藏大鹅从纯外观变成真实成长——每通关一个场景末关，后续所有对局都轻微变强（endowment + 沉没成本），给长期进度一个可见的回报钩子。

**机制规格**
- 每只解锁的大鹅（scene id 持久化于 `GooseProgress.geese`）提供一个温和、独立的永久增益，互不冲突、绝不破坏可解性（多重-of-3 不变式不受道具增减影响）：
  - 花园鹅（末关 2）：开局 +1 提示
  - 果园鹅（末关 5）：开局 +1 移出
  - 池塘鹅（末关 8）：晃一晃冷却 −1s（有下限，绝不归零）
  - 农场鹅（末关 11）：连击窗口 +200ms
  - 雪原鹅（末关 13）：开局 +1 撤回
  - 夜市鹅（末关 15）：里程碑阈值 ×0.9（中段返还提前约 10%）
- 增益在每次 `enterLevel` / `restoreRun` 时由 `computeGoosePassive(progress.geese)` 重新聚合，叠加进基础道具发放（提示/移出/撤回），或调整标量（冷却、连击窗口、里程碑阈值）。道具类累加、标量类 clamp 到设计上限。

**调优常量（均 `[PLACEHOLDER]`）**：`GOOSE_PASSIVE_GARDEN_HINT=1`、`ORCHARD_REMOVE=1`、`POND_SHAKE_CD_MS=-1000`、`FARM_COMBO_MS=200`、`SNOWFIELD_UNDO=1`、`NIGHT_THRESHOLD_SCALE=0.9`；clamp 上限 `maxShakeCdReductionMs=3000`、`maxComboWindowDeltaMs=4000`。

**改动文件**：`logic/goose-passive.ts`（新，纯函数+映射+单测）、`logic/game-rules.ts`（`milestonesFor` 增 `thresholdScale` 参数）、`logic/guest-engine.ts`（`enterLevel`/`restoreRun` 注入增益 + 维护 per-run `comboWindowMs` + 晃动冷却用 pond 增量）、`PlayArea.tsx`+`PlayArea.scss`（收藏册显示每只鹅加成）、`locale/messages.ts`。

**验证**：`goose-passive.test.ts` 10 用例（空/单鹅/多鹅叠加/标量 clamp/未知 id 容错/perk key）；`guest-engine.test.ts` 4 用例（开局道具加成、晃动冷却缩短、连击窗口增量端到端、对照基准断连）；`game-rules.test.ts` 2 用例（night-market scale 提前阈值、非正 scale 回退 1）；`tsc --noEmit` 0 错误；eslint 干净；逻辑测试全绿。

### R4 —【中】每日挑战 + 连签（承诺装置）✅ 已实施（2026-07-12）

**玩家体验目标**：让玩家"明天还想回来"。打开游戏看到"今日可领"的奖励卡 + 一条在燃烧的连签天数，是 Cialdini 承诺一致（领过昨天的，今天不领就亏了）+ 损失厌恶（断签清零）的双重钩子。

**机制规格**
- **每日签到（Daily Sign-in）**：独立持久化 `DailyState`（`zhuada-e:daily`，刻意不进 `GooseProgress` v3，避免扰动其严格迁移守卫）。字段：`lastClaimDate / streak / bestStreak / milestones / dailyBonus`。
- **连签递增**：连续日 `streak+1`；间隔 >1 天 → `streak` 重置为 1（损失落地的惩罚）。`bestStreak` 记录峰值，驱动常驻徽章等级。
- **每日奖励（每日 perk，非储蓄罐）**：领取时按当前 `streak` 计算当日加成 `dailyBonus = base + 梯段奖励 +（每 7 天里程碑 +额外）`，并**覆盖式**写入——所以它有上限、绝不滚雪球。加成在每次 `enterLevel` 的基础道具发放上**叠加**，故不依赖实时存档也能跨局生效。
- **7 天里程碑（"限定"奖励）**：`streak % 7 === 0` 触发，额外 +3 全道具 + 一次庆祝爆发（`dailyMilestoneFx` 一次性 nonce）。`milestones` 计数已记录，作为未来图形化"限定配色鹅/头像框"的数据钩子（美术待补，本版用文字徽章 + 爆发实现）。
- **每日挑战（Daily Challenge）**：`startDailyChallenge()` 用 `dateSeed(今天)` 作为确定性种子启动固定关卡（Lv.6），同一天同版本客户端布局一致。种子刻意**不混入** `runNonce/Date.now`，否则"共享布局"会逐会话漂移。无服务端，故"所有人同布局"为软保证（同构建即可），符合 GDD 原意。

**调优常量（均 `[PLACEHOLDER]`，待 playtest 验证）**：`DAILY_BASE=各+1`、`DAILY_STREAK_BONUS_PER_2=+1/每2天`、`DAILY_STREAK_BONUS_CAP=5`、`DAILY_MILESTONE_BONUS=+3`、`DAILY_MILESTONE_EVERY=7`、`DAILY_CHALLENGE_LEVEL=6`。

**改动文件**：`logic/daily-reward.ts`（新，纯函数+存储）、`logic/guest-engine.ts`（daily 可观察量 + `enter()` 注入 + `enterLevel` 叠加奖励 + `claimDaily()`/`startDailyChallenge()`）、`main.tsx`（可观察量+动作）、`PlayArea.tsx`+`PlayArea.scss`（领取卡/连签徽章/挑战按钮/里程碑爆发）、`locale/messages.ts`。

**验证**：`daily-reward.test.ts` 8 用例（日期工具/连签递增/断签重置/7天里程碑/同 day 幂等/奖励缩放/存储往返+容错）；`guest-engine.test.ts` 4 用例（enter 注入可领取、claim 发道具并持久化、奖励叠加进基础发放、每日挑战确定性布局）；`tsc --noEmit` 0 错误；eslint 干净；全量逻辑测试 **154 项全过**。

### R5 —【低/手感】提示道具智能化
- **问题**：当前提示仅"高亮一个有用物品"，信息密度低。
- **方案**：改为**高亮一组当前可凑成三连的 3 个物品**（含埋在堆下的），或揭示托盘里某类在堆下的剩余分布。让提示真正"救活"而非"指一下"。
- **改动量**：`hint()` 计算近三连组 + 场景脉冲 3 个目标。约 50 行。

### R6 —【低/爽点】连击 Frenzy（连击高潮）
- **问题**：连击只是加分，缺少"质变"兴奋点；长连击链条没有视觉/操作上的高潮回报。
- **方案**：连击达到 `FRENZY_TRIGGER_COMBO = 5` 触发 **Frenzy**：立刻发放 `FRENZY_CHARGES = 2` 发"自动吸附"充能，并在 HUD 闪一次爆发。之后每完成一次消除消耗 1 充能、自动从盒内吸附 1 个**刚消除的同色**物品进托盘（省一次点击 + 爆发特效）。充能用尽或盒内无该色可吸时自动回退，绝不堵托盘、绝不递归、绝不影响可解性。combo 归零后再次冲到 5 会重新发充能，让长链持续脉冲。
- **改动量**：`guest-engine.ts` 内 `combo≥5` 充能 + `applyFrenzyPull` 闭包（吸附+回退）；`main.tsx` 新增 `frenzyCharges` / `frenzyFx` 可观察量；`PlayArea.tsx` 新增紫罗兰色"狂潮 xN"计数 + 一次性爆发闪层；`PlayArea.scss` 配套动效（复用 `--goose-motion-*` 全局缓动，尊重 prefers-reduced-motion）。约 50 行 + 前端壳。
- **调参点 `[PLACEHOLDER]`**：`FRENZY_TRIGGER_COMBO`(5)、`FRENZY_CHARGES`(2) 为首发假设，playtest 后再定。若想更"廉价的爽"，可下调触发到 4 或提升充能到 3。

### R7 —【中】内容扩展：第二篇章（火山 / 云端 / 深海）
- **问题**：R1–R6 全部落地后核心循环与元进度完整，但仅有 6 场景 / 15 关，长线内容厚度不足；9 只鹅集齐后缺乏新目标，收藏驱动力随时间衰减。
- **方案**：新增 3 个主题场景作为"第二篇章"，每场景 3 关（L16–L24，共 9 关，总 24 关），每场景末关解锁 1 只限定大鹅，且每只新鹅提供**与原有 6 只不同的全新加成类型**（避免加成同质化）：
  - 火山鹅（末关 18）：开局 +1 洗牌（第 7 种道具杠杆，与提示/移出/撤回同构）
  - 云端鹅（末关 21）：得分 +5%（prestige 荣誉加成，乘算封顶 +50%）
  - 深海鹅（末关 24）：狂潮触发门槛 −1（连击 4 即触发 R6 狂潮）
- **难度曲线**：第二篇章起点 L16 与 L15 持平（kinds 恒 12、perKind 12），随后 perKind 12→16 渐增，L24 为新峰值（576 物 / timeMs 880000）。variety 不增（避免 L1→L2 式悬崖），只加深 perKind，回归玩家无难度跳变。
- **零新资源**：大鹅仍为图元拼装（GooseVariant 仅配色+帽子），物品复用固定 12 种 id（仅重排 kindPool），收藏册/关卡地图/全通判定均按 `SCENES.length`/`TOTAL_LEVELS` 动态适配，无需改 UI。
- **改动量**：`scenes.ts`（3 场景数据）、`game-rules.ts`（`TOTAL_LEVELS` 24 + 9 条曲线）、`goose-passive.ts`（3 新杠杆字段 + clamp + 鹅映射）、`guest-engine.ts`（注入洗牌/分数/狂潮门槛）、`locale/messages.ts`（9 条文案）、测试。约 120 行 + 平衡表。

---

## 6. 平衡性电子表格（调参基线）

> 凡标 `[PLACEHOLDER]` 者为待实测值。当前生产默认值见 `game-rules.ts` 注释（release-gated by `tune.mjs`）。R6/R7/R4 的 `[PLACEHOLDER]` 杠杆已由 **R8（§9）** 定成带理由/区间/broken 判据的可测假设，并通过 `balance-frenzy.mjs` 模拟背书。

| 变量 | 基准值 | 最小 | 最大 | 调参备注 |
|------|--------|------|------|----------|
| 托盘格数 TRAY_SLOTS | 7 | 5 | 9 | 经典值；降到 5 更硬核 |
| 侧架格数 SHELF_SLOTS | 3 | 0 | 5 | 0 = 关掉跨区匹配，回到纯 7 格 |
| 每局洗牌 grant | 1 | 0 | 3 | |
| 每局提示 grant | 3 | 0 | 5 | |
| 每局移出 grant | 1 | 0 | 3 | **无计时中段应补发 [PLACEHOLDER]** |
| 每局撤回 grant | 1 | 0 | 3 | **无计时中段应补发 [PLACEHOLDER]** |
| 每局加时 grant | 0(无计时)/1(计时) | 0 | 3 | 无计时下应转为移出/撤回 |
| 晃一晃冷却 SHAKE_CD_MS | 5000 | 2000 | 8000 | |
| 连击窗口 COMBO_WINDOW_MS | 2200 | 1200 | 3000 | 物理拾取间隔决定下限 |
| 连击每步加成 COMBO_BONUS_PER_STEP | 8 | 2 | 20 | |
| 匹配基础分 SCORE_PER_MATCH | 10 | 5 | 30 | |
| 时间奖励/秒 TIME_BONUS_PER_SEC | 2 | 1 | 5 | 仅计时模式 |
| 可见窗初始 STREAM_INITIAL_VISIBLE | 48 | 30 | 60 | 性能 vs 丰富度 |
| 补货触发阈值 | 42 | 30 | 50 | |
| 补货批量 | 9 | 3 | 18 | 1 波=3 个完整三连 |
| 复活羽毛次数/局 | 1 | 0 | 3 | 0 = 硬核 |
| L2 种类(悬崖) | 5 | 4 | 7 | 已实施 R2（原 7，2026-07-12）|

### "崩坏"的定义（playtest 前先对齐失败长相）
- 新手（首次游玩）L2 通关率 < 50% → 悬崖过重
- 平均单局"愤怒退出"（无通关且无续玩）> 1 次 → 流失预警
- 引导完成率（不靠设计师口述） < 90% → 教学失败
- 任意关卡理性最优解失败（可解性不变式被破） → **P0 严重 bug**

---

## 7. 优先级行动清单

| 优先级 | 项 | 影响力 | 工作量 | 建议 |
|--------|----|--------|--------|------|
| P0 | R1 无计时返还饥饿 | 高 | 小 | 立即改 |
| P0 | R2 削 L2 悬崖 | 高 | 小 | 立即改（插过渡关最稳）|
| P1 | R3 大鹅被动加成 | 中 | 中 | ✅ 已实施（2026-07-12） |
| P1 | R4 每日+连签 | 中 | 中 | ✅ 已实施（2026-07-12） |
| P2 | R5 智能提示 | 低 | 中 | ✅ 已实施（2026-07-12） |
| P2 | R6 连击 Frenzy | 低 | 小 | ✅ 已实施（2026-07-12） |
| P1 | R7 第二篇章内容扩展（火山/云端/深海） | 中 | 中 | ✅ 已实施（2026-07-12） |

---

## 9. 平衡调参定稿（R8 / R8b — `[PLACEHOLDER]` 验收决议）

> **方法**：本节点将 R6（Frenzy）、R7（第二篇章鹅加成）、R4（每日经济）及 §6 中仍标 `[PLACEHOLDER]` 的杠杆，定成**带理由、带区间、带 broken 判据的可测假设**。数据来自两个漂移防护的蒙特卡洛模拟：
> - `scripts/tune.mjs`（可解性 / 遮挡 / 曲线公平门禁；R7 后 24 关全过 ✅）
> - `scripts/balance-frenzy.mjs`（R6/R7/R4 手感与经济杠杆；本次新增，全过 ✅）
> 二者均正则提取 TS 源码常量，源码改动即重算，不会悄悄漂移。
>
> **重要**：真人体验（手感）无法由本环境替代。R8b（2026-07-12）已将两个蒙特卡洛模拟作为**正式验收门禁**重跑并均 PASS，据此把代码 4 处 `[PLACEHOLDER]` 提升为 `[ACCEPTED-SIM]`——数值即下表 **Proposed** 默认值，平衡已验证。唯一剩余步骤是**真人手感 playtest**（尤其 Frenzy 触发 5/充能 2 的"爽感"），建议补测后再行锁定；下表 **Proposed** 列即验收基准。

### 9.1 调参决议表（新增/未决杠杆）

| 变量 | 出厂默认 | **Proposed（建议值）** | 区间 | 理由 | Broken-if（playtest 判据） |
|------|----------|------------------------|------|------|------------------------------|
| `FRENZY_TRIGGER_COMBO` (R6) | 5 | **5** | 4–7 | 吃力玩家全程 0 触发、平均偶发、熟练频繁 = 技能表达杠杆；深渊鹅降至 4 仍安全（吃力=0） | ≤3 → 吃力也开始触发（无技能区分）；≥8 → 熟练都难触发（机制变死） |
| `FRENZY_CHARGES` (R6) | 2 | **2** | 1–3 | 每次高潮发 2 发免费吸附 = 爆发感但不稀释（单关仅省 ~1.4 物/触发 ≈ 0.7% 物量） | ≥4 → 单次高潮清太多，张力消失 |
| `GOOSE_PASSIVE_VOLCANO_SHUFFLE` (R7) | 1 | **1** | 1–2 | 实测胜率 +22pp（强但需通关火山终关才拿，合理） | ≥3 → 持有者后期关直接变易 |
| `GOOSE_PASSIVE_CLOUD_SCORE_BONUS` (R7) | 0.05 | **0.05** | 0.03–0.10 | 纯声望杠杆，不影响胜率/可解性；终局 +5% 分 | 无解性风险；`maxScoreBonus=0.5` 防排行榜失控 |
| `GOOSE_PASSIVE_ABYSS_FRENZY_DELTA` (R7) | 1 | **1** | 1–2 | 门槛 5→4，深渊鹅主更常触 Frenzy；吃力仍 0（安全） | ≥3 → 门槛 5→2，吃力可能连 2（风险） |
| `GOOSE_PASSIVE_LIMITS.maxScoreBonus` | 0.5 | **0.5** | 0.3–0.7 | 全收集封顶分数 ×1.5；满信息可解性仍 100% | >0.8 → 排行榜与无收集者差距过大 |
| `GOOSE_PASSIVE_LIMITS.maxFrenzyTriggerReduction` | 2 | **2** | 1–3 | 全收集封顶门槛 3；后期胜率 96.7–99.9% <100%（张力保留） | 无上界 → 吃力也能常触 Frenzy |
| R3 六鹅加成（hint/remove/shake/shake-combo/undo/threshold） | 见 §6 | **维持** | 各 ×1–2 | 全收集胜率 +38pp 但张力保留 | 任一杠杆 >2× 现值时 → 后期持有者关变易 |
| `DAILY_STREAK_BONUS_PER_2` (R4) | 1 | **1** | 1–2 | 每 2 天 +1，封顶防滚雪球 | ≥3 → 连签膨胀过快 |
| `DAILY_STREAK_BONUS_CAP` (R4) | 5 | **5** | 3–8 | 封顶后最大发放 9/8，长连签不 trivialize | 移除上限 → 长连签道具溢出 |
| `DAILY_MILESTONE_BONUS` / `EVERY` (R4) | 3 / 7 | **3 / 7** | 2–5 / 5–10 | 7 天里程碑 +3，损失厌恶钩子 | EVERY<5 → 里程碑过频稀释日常 |

> **R8b 验收结论（2026-07-12）**：§9.1 全部杠杆经 `tune.mjs`（24 关全部门禁 PASS ✅）与 `balance-frenzy.mjs`（COMPANION CHECKS PASS ✅）复验 **全部 PASS**；代码 4 处 `[PLACEHOLDER]` → `[ACCEPTED-SIM]`（goose-passive.ts / daily-reward.ts 注释各 1、guest-engine.ts 的 `FRENZY_TRIGGER_COMBO` / `FRENZY_CHARGES`）。Frenzy 两值为**手感杠杆**，平衡已证非 broken、数值即 Proposed 默认；仅真人手感仍建议补测后锁定。
>
> §6 其余杠杆（托盘/侧架格、各 grant、SHAKE_CD、COMBO_WINDOW、COMBO_BONUS、SCORE、TIME_BONUS、流参数）出厂默认即 **Proposed 维持**，理由见 §6 与 `game-rules.ts` 注释；`tune.mjs` GATE F 已验证计时预算公平。

### 9.2 数学目标曲线（随档可验）

1. **计时预算曲线**（tune.mjs GATE F 校验）：
   `timeMs(L) = roundUp5( (kinds·perKind·3) × 1.5 + 12 ) × 1000`
   即"每物 1.5s + 12s 缓冲，向上取整 5s"。24 关实测 shipped ≥ 推荐值，全过。
2. **难度单调曲线**（tune.mjs GATE D/E）：场景内 `stuckRate` 非降、`greedyWin` 非升；场景均 `stuckRate` 严格上升（教学→终局压力递增）。
3. **里程碑道具曲线**（G5 S5 修正，game-rules.ts）：
   `ceil = kinds·perKind·10`；`hintStep = max(20, round5(ceil×0.3))`；`addTimeStep = max(40, round5(ceil×0.6))`；`comboHintAt = 4`。
4. **Frenzy 技能梯度**（balance-frenzy.mjs §1，trigger=5/charges=2，单次关匹配数 = 物数/3）：
   - 吃力：0 触发/关（全程）
   - 平均：L3–L24 约 1–9 触发/关
   - 熟练：L3–L24 约 8–27 触发/关
   - 深渊鹅（门槛→4）：平均升到 4–14 触发/关，吃力仍 0 ✅

### 9.3 模拟证据（节选）

**R6 Frenzy 节奏**（trigger=5 / charges=2；深渊=门槛4）：

| 关卡 | 匹配数 | 吃力 trig/关 | 平均 trig/关 | 熟练 trig/关 | 深渊(均) trig/关 |
|------|--------|-------------|-------------|-------------|-----------------|
| L5   | 108    | 0           | 8           | 13          | 10              |
| L15  | 144    | 0           | 2           | 21          | 8               |
| L24  | 192    | 0           | 6           | 20          | 14              |

→ 吃力玩家拿不到 Frenzy（不白送）；熟练玩家频繁（技能回报）；深渊鹅只帮平均/熟练，吃力仍 0（安全）。

**R7 鹅加成胜率扫描**（遮挡 greedy，纯信息可解性另测）：

| 关卡 | base(greedyS) | +火山(+1洗牌) | 全收集(9鹅) | 满信息可解性 |
|------|---------------|---------------|-------------|-------------|
| L5   | 49.9%         | 77.1%         | 98.1%       | 100%        |
| L15  | 50.3%         | 78.4%         | 97.6%       | 100%        |
| L24  | 51.1%         | 78.5%         | 98.1%       | 100%        |

- 火山 +1 洗牌：平均胜率 **+22.4pp**
- 全收集：平均胜率 **+37.8pp**，但后期 96.7–99.9% <100% → **张力保留 ✅**
- 满信息可解性全关 **100%** → 被动加成不破可解性不变式 ✅

**R4 每日经济偿付**（封顶防稀释）：

| 连签天数 | 洗牌 | 提示 | 移出 | 撤回 | 加时 |
|----------|------|------|------|------|------|
| 1（仅基础）| 1   | 1   | 1   | 1   | 0   |
| 11（封顶）| 6   | 6   | 6   | 6   | 5   |
| 14（封顶+里程碑）| 9 | 9 | 9 | 9 | 8 |

→ 上限 5 + 里程碑 3 → 最大发放 9/8，**封顶防稀释**；吃力玩家仍有真实挑战（道具"减负不包赢"，缺口按设计存在，真实供给 = 每日礼 + 局内里程碑返还）。

### 9.4 结论

R6/R7/R4 的全部 `[PLACEHOLDER]` 杠杆已有**可测假设 + 模拟背书 + broken 判据**：Frenzy 是干净的技能表达杠杆；新鹅三杠杆各有独立定位且不与 R3 六类冲突；全收集 +38pp 胜率但张力与可解性不变式均守住；每日经济封顶防滚雪球。**下一步**：真人 playtest 照 §9.1 区间与 broken-if 验收，通过后把 `goose-passive.ts` / `guest-engine.ts` / `daily-reward.ts` 的 `[PLACEHOLDER]` 标注替换为 Proposed 值并删注释。

---

## 附录：设计支柱校验
1. ✅ **可解性优先**（多重-of-3 + 跨区匹配 + 分包储备）—— 支柱成立
2. ✅ **遮挡即挑战**（物理堆料 + 48 可见窗）—— fun hypothesis 成立
3. ✅ **新手友好**（L1 零失败 + L2 已软化到 5 类）—— 成立（R2 已实施）
4. ⚠️️ **长期有理由回来**（每日+连签 R4 已落地；大鹅被动加成 R3 已落地，收藏变成长钩子；第二篇章内容扩展 R7 已落地，长线内容厚度补足）—— 支柱成立
5. ✅ **手感优先于数值**（连击窗口放宽、无计时默认）—— 成立

---

## 8. 实施记录 / Changelog

> 2026-07-12 — 已落地 P0 两项（R1、R2）+ R5（智能提示）+ R6（连击 Frenzy）+ R4（每日+连签）+ R3（大鹅被动加成）+ R7（第二篇章内容扩展）+ **R8（平衡调参定稿）** + **R8b（验收 + 新鹅美术 + 鹅加成图形化）**。R1–R7 改动小、零破坏、测试全绿（tsc 0 错误；release-audit 全过；全量 vitest 全过）。R8 为设计交付：新增 `scripts/balance-frenzy.mjs` 伴侣模拟（全过 ✅）+ 本 GDD §9 将 R6/R7/R4 全部 `[PLACEHOLDER]` 定成可测假设（理由+区间+broken 判据）；未改游戏逻辑，无回归风险。R8b：① 双蒙特卡洛门禁复验 PASS，4 处 `[PLACEHOLDER]`→`[ACCEPTED-SIM]`（数值即 §9.1 Proposed）；② 新增 `scripts/generate-goose-portraits.mjs` 程序化生成 goose-06/07/08.webp（资产门禁 60 图 PASS ✅）；③ 收藏册鹅加成加 lucide 图标（`GoosePerkIcon`）。eslint 在本环境不可用，已以 tsc + 全量测试覆盖。

### R1 — 无计时模式道具返还饥饿（已修复）
- **文件**：`src/logic/game-rules.ts`、`src/logic/guest-engine.ts`
- **改动**：
  1. `MilestonePlan` 新增 `untimedRefund: "remove" | "undo"` 字段；`milestonesFor` 默认返回 `"remove"`。
  2. `guest-engine.ts` 的 add-time 里程碑分支：计时模式仍发加时；**无计时（默认）模式改为发放 +1 移出**（空间救援），不再是无用资源。
- **效果**：无计时玩家整局现在能在 ~60% 分数门槛拿到一次"移出"返还，前期误用救援后仍有翻盘空间。
- **验证**：`game-rules.test.ts` 新增契约测试（untimedRefund 恒为 `"remove"`，全 15 关）；`tsc --noEmit` 0 错误；受影响测试 41 全过。

### R2 — L2 难度悬崖（已软化）
- **文件**：`src/logic/game-rules.ts`（`LEVEL_CURVE` + 注释）
- **改动**：L2 种类 `7 → 5`（物品 84 → 60，三连 28 → 20），时间保持 140s（更宽裕）。
- **效果**：第 2 关从"7 类塞 7 格的墙"变成"5 类温和过渡"，新手流失风险显著下降；L3 起仍是场景难度爬坡。
- **说明**：这是调参假设，需 playtest 确认。若 L2 仍偏难，下一步可降 `perKind`（4→3）或加引导提示。
- **验证**：时钟公平性测试仍满足（items×1.5s+12s 下限）；未破坏任何冻结测试。

### R5 — 智能提示（已实施）
- **文件**：`src/logic/hint-plan.ts`（新增，纯函数 + 单测）、`src/logic/hint-plan.test.ts`（新增，6 用例）、`src/scenes/ZhuaDaScene.ts`（`triggerHint` / `pulseHintGroup` / `pulseVisual`）
- **改动**：
  1. 提示选择规则从 `computeHintKind`（返回单 kind）升级为 `computeHintPlan`（返回 `{kind, needFromBox}`）——明确"离凑齐三连还差几个"。
  2. 场景新增 `pulseHintGroup(kind, needFromBox)`：一次性高亮盒内**最多 needFromBox 个**该种类物品（按高度排序、最易点的优先），替代原先"只高亮 1 个最高的"。
  3. 抽出可复用的 `pulseVisual(target)`，并加 `hintPulsing` 守卫集，避免"组脉冲"与"埋藏物品浮现时的 pending 脉冲"打架。
  4. 埋藏物品仍走原 `pendingHintKind` 回退：当某类浮现时脉冲该 1 个。
- **效果**：提示从"指一下"变成"圈出整组可凑三连的目标"，真正救活而非引导；手感支柱（G5）强化。
- **约束说明**：托盘/侧架物品飞入后由 React HUD 渲染、不在 3D 场景内，故 R5 在场景层只高亮**盒内**可拾取成员（正是玩家要点的目标）；托盘侧同类已在 HUD 分组聚拢，可见。完整"揭示堆下剩余分布"为后续增强，不在本次范围。
- **验证**：`hint-plan.test.ts` 6 用例锁住选择契约（即时完成优先于建设、侧架种类也算、空盘返回 -1 等）；`tsc --noEmit` 0 错误；逻辑测试全过。

### R6 — 连击 Frenzy（已实施）
- **文件**：`src/logic/guest-engine.ts`（`FRENZY_TRIGGER_COMBO` / `FRENZY_CHARGES` 常量、`applyFrenzyPull` 闭包、`extract` 内充能/消耗逻辑）、`src/main.tsx`（新增 `frenzyCharges` / `frenzyFx` 可观察量并接入引擎与 state）、`src/PlayArea.tsx`（HUD "狂潮 xN" 计数 + 一次性爆发闪层）、`src/PlayArea.scss`（紫罗兰配色 + `goose-frenzy-pulse` / `goose-frenzy-burst` 动效）、`src/locale/messages.ts`（`frenzyLabel` / `frenzyBurst`）
- **改动**：
  1. 常量 `FRENZY_TRIGGER_COMBO = 5`、`FRENZY_CHARGES = 2`（均 `[PLACEHOLDER]`，待 playtest）。
  2. `extract` 匹配分支：当 `comboCount ≥ 5 且 frenzyCharges === 0` 时发 2 充能 + 闪一次爆发（触发这次本身不吸附）；之后每次匹配若 `frenzyCharges > 0` 则消耗 1 充能、把"刚消除的同色"记录为待吸附种类。
  3. 盒内补位后调用 `applyFrenzyPull(kind)`：从盒内找该色副本，置入托盘（侧架参与匹配）；无副本或托盘满则**回退充能**（绝不白扣）。该闭包不碰 combo/score、不递归、不重新发充能，安全可重入。
  4. 胜利判定改为读实时可观察量（盒空 + 储备空 + 托盘空 + 侧架空），使"吸附刚好吸空盒"也能正确判胜。
  5. 前端：`frenzyCharges > 0` 时 HUD 显示紫罗兰"狂潮 xN"；`frenzyFx` 每次自增触发一次性"FRENZY!"爆发闪层（720ms，reduced-motion 下自动禁用动画）。
- **可解性保证**：吸附只从盒内"取走 1 个"放进托盘，多重-of-3 不变量不破；回退保证充能不丢；充能封顶 2，长链冲到 5 重新发，持续脉冲但不失控。
- **验证**：新增 `guest-engine.test.ts` 中 "R6 Frenzy (combo climax)" 3 用例（触发发 2 充能+爆发、武装匹配自动吸附并扣 1 充能、消耗尽后下次高潮重新发充能）；同时把"全波次抽干并仅在盒/储备/托盘/侧架全空时判胜"的 14 个关卡测试升级为"会先收尾托盘残留组"的合格解算器（原贪婪只看盒内会卡在 Frenzy 残留组）；`tsc --noEmit` 0 错误；逻辑测试全绿。

### R4 — 每日挑战 + 连签（已实施）
- **文件**：`src/logic/daily-reward.ts`（新）、`src/logic/guest-engine.ts`、`src/main.tsx`、`src/PlayArea.tsx`、`src/PlayArea.scss`、`src/locale/messages.ts`
- **改动**：
  1. `daily-reward.ts`：纯函数 `todayKey / prevDayKey / dayDiff / dateSeed / computeDailyView / claimDailyReward` + 存储 `loadDailyState / saveDailyState`。`DailyState` 独立 key `zhuada-e:daily`，不进 `GooseProgress` v3。
  2. 引擎新增 `dailyState / dailyClaimable / dailyGrants / dailyMilestoneFx` 四个可观察量；`enter()` 注入当日视图；`enterLevel` 在基础道具发放上叠加 `dailyState.dailyBonus`；新增 `claimDaily()`（领取+持久化+即时发道具+里程碑爆发）与 `startDailyChallenge()`（日期种子确定性布局）。
  3. `main.tsx` 创建/透传可观察量并注册 `claimDaily` / `startDaily` 动作。
  4. UI：`goose-daily` 区块（连签徽章 + 今日领取卡含加成预览 + 今日挑战按钮），里程碑一次性 "连签 7 天!" 爆发；locale 中/英补全。
- **关键设计决策**：
  - 每日奖励是**按天 perk**（覆盖式写入、有上限），不是储蓄罐——避免连签滚雪球破坏平衡。
  - 每日挑战种子**不混** `runNonce/Date.now`，否则"同天同布局"会逐会话漂移；无服务端故为软保证（同构建一致）。
  - 断签 >1 天 → `streak` 重置为 1，制造损失厌恶的真实痛感。
  - 7 天里程碑的"限定配色鹅/头像框"本版用文字徽章 + 爆发实现，`milestones` 计数已留数据钩子供后续美术替换。
- **验证**：`daily-reward.test.ts` 8 用例（日期工具/连签递增/断签重置/7天里程碑/同day幂等/奖励缩放/存储往返+容错）；`guest-engine.test.ts` 新增 "R4 daily sign-in / streak" 4 用例（enter 注入可领取、claim 发道具并持久化、奖励叠加进基础发放、每日挑战确定性布局）；motion-quality 守门测试要求 hover 过渡用共享 `var(--goose-motion-quick)`（已改，禁裸 `ease`）；`tsc --noEmit` 0 错误；eslint 干净；全量逻辑测试 **154 项全过**。

### R3 — 大鹅被动加成（已实施）
- **文件**：`src/logic/goose-passive.ts`（新）、`src/logic/game-rules.ts`、`src/logic/guest-engine.ts`、`src/PlayArea.tsx`、`src/PlayArea.scss`、`src/locale/messages.ts`
- **改动**：
  1. `goose-passive.ts`：`GOOSE_PASSIVES` 静态映射（6 场景鹅 → 独立温和增益）+ `computeGoosePassive(geese[])` 聚合（道具类累加、标量类 clamp 到上限、阈值乘数乘积），纯函数可单测。
  2. `game-rules.ts`：`milestonesFor(spec, thresholdScale = 1)` 增可选阈值缩放参数（夜市鹅传 0.9），默认 1 向后兼容。
  3. `guest-engine.ts`：`enterLevel`/`restoreRun` 重算 `goosePassive` 并叠加进开局道具（提示/移出/撤回 + 鹅加成）；维护 per-run `comboWindowMs = COMBO_WINDOW_MS + 农场增量`，`extract` 用其替代常量；晃动冷却用池塘增量并 clamp 到 `SHAKE_CD_MIN=2000`；`milestonesFor` 传夜市 `milestoneThresholdScale`。
  4. UI：收藏册每只已解锁鹅显示其被动加成文案（读 `goosePerkKey`）；locale 增 6 条中英。
- **效果**：收藏从纯装饰变为可见成长——通关场景越多，后续对局越被温和辅助，但不破坏任何关卡可解性。
- **验证**：`goose-passive.test.ts` 10 例；`guest-engine.test.ts` 4 例（含连击窗口端到端对照）；`game-rules.test.ts` 2 例；`tsc --noEmit` 0 错误；逻辑测试全绿。

### R7 — 第二篇章内容扩展（已实施）
- **文件**：`src/logic/scenes.ts`、`src/logic/game-rules.ts`、`src/logic/goose-passive.ts`、`src/logic/guest-engine.ts`、`src/locale/messages.ts`、`scripts/release-audit.mjs`（更新 "432 items" → "576 items" 平衡审计短语）
- **改动**：
  1. `scenes.ts`：追加 3 个 `SceneTheme`（火山 id6 / 云端 id7 / 深海 id8），各配 palette、themed kindPool（12 种现有物品 id 重排）、GooseVariant（图元帽子+颜色，复用现有 5 种帽子）、levels [16,18]/[19,21]/[22,24]。
  2. `game-rules.ts`：`TOTAL_LEVELS` 15→24；`LEVEL_CURVE` 追加 L16–L24（kinds 恒 12，perKind 12→16 渐增，timeMs 按 `ceil((items×1.5+12)/5)×5×1000` 推，L24=880000 为峰值）。注释峰值 432→576 items。
  3. `goose-passive.ts`：`GoosePassive` 增 `extraShuffle`/`scoreBonus`/`frenzyTriggerDelta`；`GOOSE_PASSIVE_LIMITS` 增 `maxScoreBonus=0.5`、`maxFrenzyTriggerReduction=2`；`GOOSE_PASSIVES` 增 6/7/8（火山+1洗牌、云端+5%分、深海狂潮−1）；`computeGoosePassive` 累加并 clamp 新杠杆。
  4. `guest-engine.ts`：新增 per-run `frenzyTriggerCombo`（`enterLevel`/`restoreRun` 重算 = `max(3, FRENZY_TRIGGER_COMBO - frenzyTriggerDelta)`）；洗牌发放叠加 `extraShuffle`；消除计分与结算时间奖励乘 `(1+scoreBonus)` 取整；狂潮触发改用 `frenzyTriggerCombo`。
  5. `messages.ts`：新增 sceneVolcano/Cloud/Abyss、gooseVolcano/Cloud/Abyss、goosePerkVolcano/Cloud/Abyss（中/英）。
- **效果**：内容厚度从 15 关扩展到 24 关、6 鹅扩展到 9 鹅；三只新鹅各带一种原 6 只没有的加成类型（洗牌 / 分数荣誉 / 狂潮联动），收藏驱动力长期延续且不破坏任何关卡可解性。
- **验证**：`goose-passive.test.ts` 新增 5 用例（新鹅映射 / 全 9 鹅聚合 / scoreBonus clamp / frenzyTriggerDelta clamp / perk key）；`guest-engine.test.ts` 新增 4 用例（火山洗牌叠加进发放、云端分数倍率、无深海鹅时 combo4 不触发狂潮、深海鹅使 combo4 即触发狂潮）；`progress.test.ts` 场景数断言 6→9；`GooseChip.test.ts` 肖像映射扩到 goose-08；`release-audit.mjs` 平衡短语 432→576；`tsc --noEmit` 0 错误；全量 vitest 202 项全过；release-audit 全过。

### R8 — 平衡调参定稿（已交付，2026-07-12）

- **问题**：R1–R7 落地后，R6（Frenzy）、R7（第二篇章鹅加成）、R4（每日经济）及 §6 中仍标 `[PLACEHOLDER]` 的数值缺少"理由 + 区间 + broken 判据"，无法进入 playtest 验收。
- **方法**：复用 `tune.mjs` 的可解性/遮挡/曲线门禁，新增 `scripts/balance-frenzy.mjs` 伴侣模拟（漂移防护、正则提取源码常量），覆盖三组杠杆：
  1. **Frenzy 节奏模型**：按玩家 archetype 的匹配节奏蒙特卡洛连击链，统计每关触发次数。结论：吃力 0 / 平均偶发 / 熟练频繁 = 干净技能表达杠杆；深渊鹅（门槛→4）只帮平均/熟练，吃力仍 0（安全）。
  2. **鹅加成胜率扫描**：遮挡 greedy 下，火山 +1 洗牌 +22.4pp、全收集 +37.8pp；满信息可解性全关 100%（不变式守住）、后期 96.7–99.9% <100%（张力保留）。
  3. **每日经济偿付**：上限 5 + 里程碑 3 → 最大发放 9/8，封顶防滚雪球；吃力玩家仍有真实挑战（道具减负不包赢，缺口按设计存在）。
- **交付**：GDD §9 调参决议表（每杠杆 出厂默认 / **Proposed** / 区间 / 理由 / broken-if）+ 数学目标曲线 + 模拟证据节选 + 结论。代码 `[PLACEHOLDER]` 标注保留，待真人 playtest 照 §9.1 验收后替换。
- **验证**：`node scripts/tune.mjs` 全部门禁通过（R7 后 24 关）；`node scripts/balance-frenzy.mjs` 伴侣检查全部通过（COMPANION CHECKS PASS ✅）；tsc 0 错误（未改逻辑）。

### R8b — 验收 + 新鹅美术 + 鹅加成图形化（已交付，2026-07-12）

- **① 验收门禁 + `[PLACEHOLDER]` 提升**：重跑 `tune.mjs`（24 关全部门禁 PASS ✅）与 `balance-frenzy.mjs`（COMPANION CHECKS PASS ✅）作为正式验收记录；据此把代码 4 处 `[PLACEHOLDER]` 提升为 `[ACCEPTED-SIM]`——`goose-passive.ts` 与 `daily-reward.ts` 的调参表注释各 1 处、`guest-engine.ts` 的 `FRENZY_TRIGGER_COMBO` / `FRENZY_CHARGES` 各 1 处。数值即 §9.1 Proposed 默认，平衡已验证；**仅剩真人手感 playtest**（尤其 Frenzy 触发 5 / 充能 2 的"爽感"）建议补测后锁定。
- **② 鹅加成图形化**：新增 `src/GoosePerkIcon.tsx`——9 种鹅加成各配 lucide 图标（与 `PlayArea` 既有图标语言一致），收藏册每张鹅卡 now 以"图标 + 文案"呈现；确切数值文案保留，图标仅做一眼识别。新增 `GoosePerkIcon.test.ts` 守卫（任一新鹅漏配图标即失败）。
- **③ 新鹅肖像美术**：ImageGen 在本环境有**文件名碰撞（并行同秒同名覆盖）+ 忽略透明背景**两处硬伤，改为**程序化生成**——新增 `scripts/generate-goose-portraits.mjs`，从 `scenes.ts` 的 `GooseVariant`（body / scarf / hat / hatColor / hatAccent）按数据画 SVG 鹅 → sharp 栅格成 512×512 透明 webp（goose-06 火山 / 07 云端 / 08 深海）。覆盖率 27–29% 落在资产门禁 20–45% 区间；`verify-assets.mjs` geese 计数 6→9、统计 57→60 图（资产门禁 PASS ✅）。首 6 只"已批准 ImageGen 母版"不动，仅新增 3 只；风格与首 6 略有差异（矢量 vs 手绘），如需统一可后续把 00–05 也改为程序化生成。`geese:generate` 作为独立 `npm` 脚本保留（未接入 prebuild，以保持 release-audit 的 `prebuild` 精确契约不变；06–08 webp 为已提交艺术资产，`assets:verify` 已确认存在）。

### 待办
- 全部 P0/P1 提案（R1–R8b）均已落地（2026-07-12）。唯一剩余步骤：**真人手感 playtest**（Frenzy 触发 5 / 充能 2 的爽感、每日发放体感）照 §9.1 区间与 broken-if 验收；通过后把 `[ACCEPTED-SIM]` 标注改为最终锁定值（当前即 Proposed 默认）。可选增强：将首 6 只鹅也改为程序化矢量风格以统一收藏集观感。
