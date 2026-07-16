# 羊了个羊 · 灵魂还原设计文档（Sheep Solitaire — P1 Redesign）

> 版本：v1.0 · 日期：2026-07-13 · 作者：GameDesigner
> 配套：审计 `docs/game-realcase-audit-2026.md`、P0 `docs/suika-redesign-2026.md`
> 状态：**已实现（逻辑层 + 场景层 + 接线层）+ S2 牌面视觉/特效/动画还原** · 待真机 playtest 锁定手感数值

---

## 1. 设计支柱（Design Pillars）

本 P1 只做一件事：**把 S 级机制升级成原作灵魂**。任何改动都对照这四条：

1. **第一关超易，第二关指数级跃升** —— 这是羊了个羊唯一的封神机制。免费模式必须复现"第1关稳过、第2关要靠运气+道具+规划硬刚"。
2. **每日刷新、人人同款** —— 原作靠"每日两关"制造社交货币与重复登录。免费模式用确定性日期 seed，当天所有人的 L2 牌面一致。
3. **失败不是终点（复活钩子）** —— 原作失败看广告/分享复活。免费模式给一次"再试一次"，把"放弃"变成"再来亿次"。
4. **病毒来自省份归属** —— 原作省份榜是传播引擎。免费模式先用纯前端 mock 省份积分 + 战绩分享文案占位，链上结算后无缝替换。

> 审计结论：当前 `sheep-engine.ts` 的 `generateCardLayout` 把每个符号的 3 张副本**锁在同一层**，可证明必然有解（按层清永不超槽）。这是"稳过无聊"的根因。P1 用**紧局生成器**打破该约束。

---

## 2. 核心循环（Core Loop）

### Moment-to-Moment（0–30 秒）
- **Action**：点击一张 exposed 卡 → 飞入 7 格卡槽；集齐 3 张同图案自动消除（pop 动画 + 音效）。
- **Feedback**：立即落子动画 + 三连消除爆点 + 第 6 槽填充时的警告音（已有）。
- **Reward**：消除爽感 + 进度条推进；第2关时"槽位压力"本身就是多巴胺开关。

### Session Loop（5–30 分钟）
- **Goal**：第1关（教学）清空 → 进第2关（魔鬼）清空 = 当日全清。
- **Tension**：第2关跨层散布制造槽位压力；道具（撤回/洗牌/移出3 + 复活）是稀缺资源。
- **Resolution**：L2 清盘 = 全清胜利（解锁小羊皮肤 + 省份积分 +1）；L2 失败 = 复活或重来。

### Long-Term Loop（hours–weeks）
- **Progression**：每日挑战连续全清 → 小羊皮肤/徽章解锁（轻养成）；累计省份积分爬榜。
- **Retention Hook**：每日刷新牌面（date seed）+ 省份排行 + 战绩分享。

---

## 3. 现状诊断（改什么、为什么）

| 维度 | 现状 | 原作灵魂 | 缺口 |
|---|---|---|---|
| 难度曲线 | 保解生成器，3 难度都"稳过" | 第2关 0.1% 通关 | 🔴 紧局生成器 |
| 关卡结构 | 仅 difficulty 选择 | 每日两关（易→地狱） | 🔴 关卡进度 + 每日 seed |
| 复活 | 失败→回大厅 | 看广告/分享复活 | 🔴 revive 钩子 |
| 社交 | 全局 guest 榜 | 省份榜 + 分享 | 🟠 省份积分 mock + 分享文案 |
| 美术 | 羊主题 webp 已就位 | 明亮卡通 | 🟢 加 L2 强调 + v2 令牌（React 层后续） |

---

## 4. P1 机制规格

### 4.1 紧局生成器 `generateTightLayout(seed, cardTypes, opts)`

**Purpose**：打破"同符号同层"约束，制造槽位压力，同时保证是合法局（每种符号仍 3 张，每层不超容量）。

**Player Fantasy**：*"这关怎么跟上一关完全不是一个难度？"* —— 第2关的抓狂上头。

**算法**（保留 `LAYER_CONFIGS` 容量，与 `SheepScene` 渲染硬编码一致）：
1. 构造层槽位（L0=12, L1=20, L2=30，共 62 ≥ types×3）。
2. 构造 deck：每 symbol ×3。
3. **基础保解填充**：按层容量依次填（复刻原行为，作为 baseline）。
4. **跨层交换**：以 `spread` 概率执行 layer 间 symbol 交换 —— 随机挑两张不同层、不同 symbol 的卡互换位置。spread 越高，跨层越彻底（每 symbol 副本散布到 2–3 层）。层间交换不破坏容量约束。
5. 返回 `cards`（带 layer/col/row）。

**Tuning Levers**：
- `spread`：L1 ≈ `0.12`（几乎不跨层，稳过）；L2 ≈ `0.82`（深度跨层，虐）。
- 交换次数上限 `SWAP_CAP = [PLACEHOLDER]`（建议 60，按牌数缩放）。

**Dependencies**：`computeExposed`（遮挡判定不变）、`LAYER_CONFIGS`、`SheepScene`（渲染容量）。

### 4.2 可解性模拟器 `simulateSolvability(cards)`

**Purpose**：给每个生成局打分，作为"难度采样"的目标函数，确保 L1 零道具必过、L2 需道具但非纯死局。

**算法**：贪心 + 多策略（完成3连优先 / tray已有优先 / 暴露最多优先），每种策略模拟到清盘或死局：
- 死局（slots 满 7 且无 3 连）→ 允许"道具"代理（从 slots 退回 1 张，道具数+1，上限 3）；道具耗尽仍死 → `passNoItems=false`。
- 清盘 → 记录 `minItems`（最少道具数）、`maxSlot`（过程最大占用）。

**输出**：`{ passNoItems: boolean; minItems: number; maxSlot: number }`。

> 贪心非最优，但作为采样代理足够：L1 低 spread → 贪心必过（稳过保证）；L2 高 spread → 贪心需道具（虐感保证）。即使偶发误判，只造成难度波动，不影响可玩性。

### 4.3 每日两关 `generateDailyLevel(dateSeed, level, cardTypes)`

**Purpose**：还原"每日两关"——当天确定性牌面，人人同款。

**算法**：
- `dateSeed = hash(YYYYMMDD)`（本地日期，确定性）。
- L1：`spread=0.12`，目标 `passNoItems=true`（零道具必过）。
- L2：`spread=0.82`，目标 `passNoItems=false && minItems∈[1,3]`（需道具但可过）。
- 循环 `variant ∈ 0..200`：`seed = hash(dateSeed, level, variant)` → `generateTightLayout` → `simulateSolvability` → 命中目标即返回；否则 fallback 最后一局。

**Dependencies**：`generateTightLayout`、`simulateSolvability`。

### 4.4 复活钩子 `revive()`

**Purpose**：把"失败即放弃"变成"再来亿次"，还原原作广告/分享复活动机（免费模式用 mock 广告/分享）。

**Input**：L2 失败后玩家点"复活"（每日每局 1 次）。
**Output**：当前 slots 清空回 pile（等价 remove3 全清），`revivesLeft--`，回到 `dealt` 继续。
**Success**：玩家获得续局机会，继续挑战同款 L2 牌面。
**Failure**：`revivesLeft<=0` → 不可复活，只能重来第2关或回第1关。

**Edge Cases**：
- 复活后再次失败 → `revivesLeft=0`，仅剩"重来"。
- 复活不清空已用道具计数（诚实：道具仍消耗）。

### 4.5 轻量社交层（省份积分 mock + 分享）

**Purpose**：还原省份归属病毒钩，纯前端可跑，链上结算后无缝替换。

- `province`：localStorage 存玩家所选省份（首次进入引导）。
- `provinceScore`：L2 全清 → 本省积分 +1（mock 排行榜：按省份聚合）。
- 分享文案：L2 全清 result 显示"为 <省份> 羊群 +1！分享战绩"占位（真实分享 SDK 后续接入）。
- 不影响框架付费模式省份榜（unpublished）。

### 4.6 关卡进度 + 小羊皮肤解锁（轻养成）

- `dailyCleared[date]`：L2 全清标记（localStorage）。
- 连续全清 N 天 → 解锁小羊皮肤/徽章（v2 美术后续；本期先持久化计数 + result 提示）。
- 长线目标：给"每天回来"一个理由。

---

## 5. 数值表（[PLACEHOLDER] — 真机 playtest 锁定）

| Variable | Base | Min | Max | 说明 |
|---|---|---|---|---|
| L1 spread | 0.12 | 0.05 | 0.25 | 教学稳过 |
| L2 spread | 0.82 | 0.6 | 0.95 | 魔鬼难度 |
| SWAP_CAP | 60 | 20 | 120 | 跨层交换上限 |
| 模拟器策略数 | 3 | 1 | 5 | 采样稳健度 |
| 采样 variant 上限 | 200 | 50 | 500 | 命中目标重试 |
| 复活次数/局 | 1 | 0 | 3 | 免费模式 |
| L1 cardTypes | 8 | — | — | 教学 |
| L2 cardTypes | 15 | 12 | 15 | 魔鬼（原作第2关满符号）|
| 每日种子窗口 | 1 天 | — | — | date seed |

> 所有数值标 `[PLACEHOLDER]`：本环境无浏览器，需真机 playtest 验证 L2 是否"难但可过"，并微调 spread / SWAP_CAP。

---

## 6. 状态机 / 失败态 / 边界

**新增状态 observable**（guest-engine + main）：`level (1|2)`、`dailyDate`、`revivesLeft`、`mode ("daily"|"practice")`。

**startGame 签名兼容**：`startGame(arg: number | StartOpts)` —— number 当 practice difficulty（向后兼容 main/scene）；object 当 `{ mode, level?, difficulty? }`。

**关卡流转**：
```
lobby → [今日挑战] → L1(dealt) → win → [进入第2关] → L2(dealt)
L2 → win  → [今日全清 + 分享] → 省份积分+1 / 皮肤解锁
L2 → fail → [复活(revivesLeft>0)] → L2(dealt 续局)
L2 → fail (无复活) → [重来第2关 / 回第1关]
```

**边界**：
- 刷新恢复：`SavedGuestRun` 加 `level/dailyDate/mode/revivesUsed`，恢复后回到正确关卡。
- 每日 seed 确定性：同一天同款 L2（含跨刷新），保证"每日两关"社交货币。
- 紧局容量：生成器强制每层 ≤ `LAYER_CONFIGS` 容量，否则抛错（与渲染一致）。

---

## 7. 与现有契约的兼容性

- **引擎 owns truth**：`guest-engine` 仍是免费模式唯一真相源；`SheepScene` 只渲染 + 派发（不变）。
- **actions 契约**：保留 `startGame/pickCard/useUndo/useShuffle/useRemove3/submitRun/returnToLobby/expireGame`；新增 `advanceLevel/revive`（main 注册，scene 派发）。
- **shuffle 改全局重排**：紧局下符号跨层，原"层内 triple 完整"校验不再适用 → 改为全局打乱 pile 的 symbol（保留位置/层归属），仍是合法局。
- **reduced-motion / a11y**：全部保留（场景动画已 gate）。

---

## 8. 验证计划（真机 playtest 目标）

- [ ] L1 连续 10 局：玩家无道具零失败（稳过验证）。
- [ ] L2 连续 10 局：至少 7 局需要道具/复活（虐感验证）；0 局纯死局（可过验证）。
- [ ] 复活：L2 失败→复活→续局可正常完成。
- [ ] 每日：同一天两次进入 L2 牌面一致；跨天变化。
- [ ] 刷新恢复：L2 中途刷新回到正确关卡与牌面。
- [ ] tsc 0 错误 + sass 编译通过（本环境已验证逻辑层编译；场景/React 需构建）。

---

## 9. P2 — 风格与结构重造（Layout Model v2 契约）

> 2026-07-14 用户验收反馈定调：现版是"网页应用感"（奶油面板 + 路线卡列表 + 浅塔），
> 与原版"整屏游戏感"差距过大；且难度曲线未呈现"第1关秒过、第2关地狱"的招牌反差。
> P2 以此为北星做结构与画风重造。合规红线不变：只复刻机制与风格，全部美术原创。

### 9.1 CardData v2（引擎/场景共享契约）

```ts
export type BoardZone = "grid" | "stackL" | "stackR";

export interface CardData {
  id: number;
  symbol: number;
  /** grid: 0 = 最顶层 … N-1 = 最底层（沿用现有语义，上限从 3 层扩到 5 层）。stack: 恒 0。 */
  layer: number;
  /** grid: 层内列/行。stack: col = row = 0（位置由 zone + stackIndex 决定）。 */
  col: number;
  row: number;
  /** 区位：中央塔 | 左暗堆 | 右暗堆。旧数据缺省视为 "grid"。 */
  zone: BoardZone;
  /** stackL/stackR 内的埋深：0 = 最底 … n-1 = 最顶（唯一可点）。grid: 0。 */
  stackIndex: number;
}
```

### 9.2 统一细网格与遮挡几何（半格错位，引擎/渲染同式）

- 每层相对上一层做半格错位。定义统一细网格（半格 = 1 单位）：
  `unitX = col * 2 + offX(layer)`，`unitY = row * 2 + offY(layer)`，
  其中 `offX/offY(layer) = layer % 2`（奇数层错半格）。
- **遮挡判定**（引擎唯一真相）：更上层卡 A 遮住卡 B ⇔
  `A.layer < B.layer && |unitX_A − unitX_B| < 2 && |unitY_A − unitY_B| < 2`。
- **渲染坐标**（场景唯一公式）：`px = boardOriginX + unitX * (tileW / 2)`（y 同理）。
  引擎与场景共用同一 unit 公式 ⇒ 视觉未压住 = 逻辑可点，根除"幽灵锁"。
- stack 区曝光：`stackIndex === 该 zone 现存最大` ⇔ 可点；其余埋牌渲染为重叠露边
  （正面朝上、露 ~22% 边缘、加深压暗），对齐原版底部横条只有最外一张可点的观感。

### 9.3 关卡预设（难度反差是产品本体）

| 预设 | 结构 | 规模 | 难度目标 |
| --- | --- | --- | --- |
| L1（每日第1关） | 仅 grid 2 层 | ~6 种 × 3 = 18 张 | 零道具 100% 可清，体感 <30 秒 |
| L2（每日第2关） | grid 5 层稠密塔 + 左右暗堆各 ~9 张 | 14-15 种、总 ~90 张（∑ ≡ 0 mod 3，每种 ×3） | 模拟器保证非死局；无道具大概率失败 |
| 练习三档 | 沿用 8/12/15 种（重皮） | 现规模 | 不变 |

- GameFi 路径 `generateCardLayout`（TEE/预言机契约）**冻结不动**；v2 仅落在 guest 每日/练习生成器。

### 9.4 画风令牌（原创重绘的风格靶）— v2，依据用户提供的 5 张原版实机截图校准

> 2026-07-14 用户贴出原版首页/L1/L2/每日一关实机截图，据此修正此前凭记忆的偏差。
> 截图仅作风格参考；所有资产仍由我们原创绘制（羊主题图标集保留，换描边/配色语言）。

- **总体气质：贴纸/手绘风**——所有元素中等粗**黑描边** + **硬偏移黑投影**（2-4px 无模糊），
  纯平色块、零渐变。~~麻将牌质感~~（记忆错误，原版是纸贴感）。
- **背景**：**平涂浅青柠绿**（≈#B7E389），稀疏两笔式手绘草簇涂鸦（中绿色、极低密度）；
  ~~饱和草地纹理/树影斑块/小花~~（记忆错误，原版背景极素）。零奶油面板、零网页卡片。
- **牌面**：奶油白面（≈#F8F6E8）圆角方牌、细近黑描边、底缘露灰绿"厚度"条；
  **被压牌 = 整牌罩深灰绿色调**（图案仍隐约可辨但明显压暗），暴露牌亮奶油白——对比狠、一眼可分。
- **暗堆（stackL/stackR）**：渲染为**罗纹压缩块**（竖向棱条 = 一摞牌的侧边），灰绿色，
  最外端一张完整正面朝上可点；位于塔身下方左右两侧。~~22% 露边挨个排~~（原版是棱条块）。
- **卡槽托盘**：棕色木槽（圆角、深棕描边），**前缘带一排栅栏桩**（原版签名细节）；
  槽内素面深棕，**无 7 格分隔线**（牌进槽后自然排列）。贴屏底停靠。
- **道具排**：托盘正下方 3 枚**天蓝圆角方钮**（黑描边 + 硬投影），**黄色图标**
  （移出槽/撤回箭头/洗牌交叉箭头）；一局一次，用毕变灰（不做原版的广告"+"角标）。
- **顶部 HUD**：左上**蓝色方形齿轮钮**（设置/静音）；每日模式顶中**黑色圆角药丸**白字
  （「每日挑战 · 第1关/第2关」）。
- **首页**：青柠绿场 + **黑描边白字大 Logo**「小羊接龙」（原版式厚圆角字 + 黑投影）+
  3-4 只原创卡通羊（云朵卷毛身、深色脸，造型/姿态与原版区分：保留我们的绿铃铛小羊基因）+
  **白色贴纸大按钮**「开始游戏」（波浪/锯齿黑描边框 + 硬投影）+ 小入口「自由练习」。
- **L1 观感**：~3×3 疏松簇、每簇 2 层（下层露灰绿埋边），大量留白绿地——"秒过"要一眼看出来。
- **IA 反转**：进游戏即首页 → 一键进 L1 → 过关插页 → L2。路线卡列表退居"自由练习"二级入口。

---

## 10. Changelog

- **2026-07-13** — v1.0 初版：定义 P1 四支柱 + 紧局生成器/模拟器/每日两关/复活/轻量社交 + 数值 [PLACEHOLDER] + 验证计划。
- **2026-07-13** — 实现：新增 `generateTightLayout`/`simulateSolvability`/`generateDailyLevel`/`dailyDateSeed`（sheep-engine.ts）；guest-engine 加 `level/dailyDate/revivesLeft/mode` + `advanceLevel/revive` + 全局 shuffle；main.tsx 加 observable + action；SheepScene 加"今日挑战"入口 + L2 进阶/复活/全清分享；messages.ts 加文案。tsc 0 错误、sass 通过。
- **2026-07-13** — P1 收口：省份选择 UI（PhaserPlayArea 首入弹窗 + HUD 省份 chip，`setProvince` action → `guest.setProvince`；`PROVINCE_NAMES` 34 省）+ 省份/每日文案（messages.ts）+ 羊主题样式（PlayArea.scss，v2 令牌 + reduced-motion 门控）。vite build 3609 模块通过。
- **2026-07-13** — P1 深层美术：15 张羊主题 SVG 图标（羊脸/小羊毛球/铃铛/蹄印/胡萝卜/三叶草/花/奶瓶/栅栏/太阳/云朵/星星/爱心/蝴蝶）→ sharp 转 webp 替换原通用水果物件 tile。统一卡框模板（奶油底+金边+绿钻角标）。`ALL_SYMBOLS`/`SYMBOL_LABELS` 重命名，loader 改 DRY 循环。生成脚本 `scripts/generate-sheep-tiles.mjs` 可复用。ATTRIBUTION.md 更新。tsc+vite build 均绿。
- **2026-07-14** — **S2 牌面视觉/特效/动画还原（SheepScene.ts，羊了个羊手感）**：此前文档在牌面表现层投入不足，本期补齐。① 遮挡还原——每张牌加暖色圆角投影（`sheep-fx-cardshadow`），暴露牌明亮可点、被压牌保持不透明但套一层暖色遮罩（`sheep-fx-panel` tint）并压暗色调，解决"被压牌融进奶油底看不见"的核心可读性问题；②拾取动画——点击牌先弹起（scale pop），幽灵牌沿抛物线弧线飞入卡槽、缩放到槽位大小、落地压扁回弹（`tweens.addCounter` 手写弧线）；③三连消——新增横扫绿光确认 + 星爆/火花 + 连击 combo 音效；④卡槽张力——第5槽起空槽转琥珀警告、第6槽末空槽转红并托盘染红 + 越入危险区触发托盘抖动 + 第6槽警告音（保留）；⑤胜负仪式——胜利结算加小羊吉祥物弹跳 + 五彩纸屑 + 星爆（"全清"文案已有），失败保留红闪/抖动并露出复活入口，结算副标题加 wordWrap 防溢出；⑥大厅路线卡预览图标加白色底片 + 投影提升清晰度。全部动画走 `this.tween`/`reducedMotion` 门控；新文案 `matchCleared`/`matchCombo` 走 messages.ts（en+zh）经 loc 桥接。tsc/eslint/vite build 全绿；`test/sheep-solitaire*` 71 项 + game-experience.audit 羊面 + game-motion-baseline 羊面全绿（真机 playwright 探针实拍：发牌遮挡 / 5-6 槽张力 / 全清仪式 / Game Over，桌面+移动双视口）。
- **2026-07-14** — 测试对齐 P1 引擎面。guest-engine 测试 harness 补齐新 observable（`level/dailyDate/revivesLeft/mode`，缺失导致每次发牌 `undefined.set` 抛错）并把确定性布局 mock 从已退役的 `generateCardLayout` 改挂到发牌真正走的 `generateTightLayout`。退役"同层三连必解"断言（紧局按 `spread` 跨层散布、练习模式不再零道具保解）改为断言真正的新契约：练习局仅保证合法 3-per-symbol 牌面；**每日 L1 零道具端到端可清**（真机引擎跑 400 个日期种子验证不 flaky）；shuffle 改断全局重排后的合法骨架（位置/层不变、每符号 ×3）。engine/playarea 测试的旧水果 `ALL_SYMBOLS`/`symbolAsset` 断言改为羊主题原图键。`apps/shared` 全部 `test/sheep-solitaire*`（71 项）绿；app tsc 0 错误、vite build 绿。
