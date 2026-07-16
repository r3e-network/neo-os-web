# 小游戏「现实案例保真度」审计报告

> 版本：v1.0 · 日期：2026-07-13 · 审计人：GameDesigner
> 配套文档：`docs/game-ui-beauty-roadmap-2026.md`（外观美化路线图，已收口）

## 0. 目的、方法、评级口径

### 0.1 目的
以现实爆款为标杆，审计平台 **25 款小游戏**在「核心玩法」与「视觉风格」上的还原度，揪出**偏离原作核心**的地方，给出「贴回原作」的具体建议。用户原话：*「有很多游戏是有现实案例的，帮我参考现实案例审计，包括羊了个羊等等，要求能尽量接近原游戏风格和核心玩法。」*

### 0.2 方法
1. **全量普查**（Explore agent）：读 25 款游戏的 `neo-manifest.json` + `PlayArea/PhaserPlayArea.tsx` + 场景源码注释 + UI 文案，提取核心循环并初步标注现实原型。
2. **重点深读（代码核实）**：对 `sheep-solitaire`、`fruit-funnel`、`screw-sort` 三款读了引擎与 manifest，逐行确认机制——不凭普查下结论。
3. **现实案例调研**：对羊了个羊、合成大西瓜/Suika、Screw Sort 三款做了玩法调研，拿到权威核心循环与风格签名。

### 0.3 评级口径
每个游戏给两个维度评级：**核心玩法（Core）** 与 **视觉风格（Style）**，各取 S / A / B / C：

| 等级 | 含义 |
|---|---|
| **S** | 核心决策与循环几乎 1:1 还原原作 |
| **A** | 核心到位，但难度曲线 / 社交 / 复活等细节偏离 |
| **B** | 仅概念相似，关键机制与原作不同 |
| **C** | 只是借用主题，玩法本质不同 |
| **N/A** | 非游戏克隆（留存/Web3 工具类） |

> **独立轴说明**：平台的 Web3/GAS 框架（报名费、链上结算、省份榜需付费模式）是**产品决策**，不属于「玩法保真度」范畴。但免费模式若因此**丢失原作的社交/重试钩子**，会在审计中单独标注——因为这是「玩家体验」层面的偏离，正是用户要的「接近原游戏」。

### 0.4 假设与局限
- 表格中标注「**代码核实**」者基于引擎级阅读；标注「**普查推断**」者基于 manifest + 场景注释 + UI 文案，建议后续逐款点开确认。
- `zhuada-e`（抓大鹅）原作具体机制不在本审计已调研范围内，标注为「普查推断 + 需确认」。
- 美术风格评级基于 manifest 描述与主题命名，未逐帧比对原作素材。

---

## 1. 现实案例参照（核心循环 + 风格签名）

### 1.1 羊了个羊（Sheep a Sheep，2022 · 北京简游）
- **核心循环**：点击上层卡牌 → 落入底部 **7 格卡槽**；集齐 **3 张相同图案**自动消除；卡槽填满且场上无可消组合 → **本局失败**；清空全部牌 = 通关。
- **风格签名（让它爆的 5 点）**：
  1. **第一关教学超易，第二关难度指数级跃升**（官方称通关率 < 0.1%）——靠运气 + 道具 + 广告复活硬刚。
  2. **分层堆叠**，下层被完全遮挡，需提前规划消除顺序。
  3. **移出 / 撤回 / 洗牌**三类道具，每局各一次。
  4. 失败可**看广告复活**。
  5. **省份排行榜**（为本省羊群累计积分）——核心社交病毒钩。每日刷新关卡。
- **美术**：卡通小羊、明亮草场、单点触控、极简。

### 1.2 合成大西瓜 / Suika Game（原作 2021 日本；概念源自 2021 国产《合成大西瓜》）
- **核心循环**：把水果**投入容器**；两个**相同水果碰撞 → 合成更大一级**水果（11 级进化链，顶点西瓜）；水果堆过顶部**红线且超时** → 结束。原版**无时间限制**，靠物理（重力 / 滚动）。
- **风格签名**：物理合成链连锁、顶部警戒线、Next 预览、无尽模式、本地/在线排行、可爱水果 + 柔和暖色 + 弹跳手感。

### 1.3 Screw Sort / 拧螺丝分类（2023–2024 爆款）
- **核心循环**：旋转 3D 模型，点击拧下螺丝，按颜色分到对应螺栓/托盘；同色放满即打包。**多数版本无失败条件**，仅步数/效率挑战；引脚遮挡需按序拆。
- **风格签名**：3D 可旋转、从外到内拆、空位作临时缓冲、撤销/重开、**无时间压力**的解压感；立体机械、真实金属/木质材质。

---

## 2. 25 款游戏 · 映射 + 保真度总表

| 游戏 | 现实原型 | 核心 | 风格 | 关键偏差 / 备注 | 依据 |
|---|---|---|---|---|---|
| **sheep-solitaire** | 羊了个羊 | **S** | A→A+ | 机制还原；难度/社交/复活偏离（**P1 已补**：紧局生成器+免费社交/复活/每日轮换+羊主题美术，见 Changelog） | 代码核实 |
| **fruit-funnel** | 合成大西瓜 | **C** | B | ⚠️ 逻辑配对，非物理合成 | 代码核实 |
| **screw-sort** | Screw Sort | **A** | B+ | P2 已软化失败→效率星级 + 2.5D 伪3D；核心循环已 1:1，残留偏差仅 2D vs 真3D 可旋转（见 Changelog） | 代码核实 |
| flappy-dash | Flappy Bird | S | A | 点击穿管，pipe 美术 | 普查 |
| snake-bounty | 贪吃蛇 Snake | S | A | 吃食变长、避墙/自身 | 普查 |
| game-2048 | 2048 | S | A | 4×4 滑动合并 | 普查 |
| sudoku | 数独 Sudoku | S | A | 9×9 行列宫不重复 | 普查 |
| color-clash | Simon 西蒙说 | S | A | 复述渐长颜色序列 | 普查 |
| merge-kingdom | Triple Town / 合成 | A | A | 4×4 拖拽合并升级 | 普查 |
| zhuada-e | 抓大鹅 | A | A | 3D 物理三连消除 + 晃手机 | 普查* |
| jump-rush | 跳一跳 / Jump King | A | A | 蓄力跳越障、可复活 | 普查 |
| curve-arrow | 弓箭弹道 / 愤怒小鸟 | A | A | 曲线弹道命中 + 有限箭 | 普查 |
| arrow-escape | 管道工 / 连线解谜 | A | B | 依赖顺序移除箭头 | 普查 |
| bead-workshop | 串珠手工 | A | A | 同色珠移入托盘拼图 | 普查 |
| aim-master | 打靶 / Aim Lab | A | A | 移动准星时机射击 | 普查 |
| dice-game | 掷骰赌大小 | A | A | 选面下注比大小 | 普查 |
| fogplay | 抛硬币 Coin Flip | A | A | 押正/反 | 普查 |
| gas-lucky-pool | 幸运转盘 Lucky Draw | A | A | 三档抽奖开奖 | 普查 |
| gasbox | 扭蛋机 Gachapon | A | A | 投币抽 capsule | 普查 |
| red-envelope | 抢红包 | A | B | 公共链接开 GAS 红包 | 普查 |
| last-survivor | 抢椅子 / 大逃杀 | A | B | 占位生存淘汰 | 普查 |
| on-chain-tarot | 塔罗占卜 | A | A | 三张占卜仪式 | 普查 |
| pet-potion | 宠物养成 + 合成 | A | A | 喂养 + 酿药水 | 普查 |
| daily-checkin | （签到工具） | N/A | – | 留存工具，非游戏克隆 | 普查 |
| burn-league | （Web3 销毁榜） | N/A | – | gamified burn，非经典玩法 | 普查 |

> `*` `zhuada-e` 原作具体机制未在本审计调研范围，标「普查*」——核心为 3D 物理三连消除 + 晃手机翻转篮子，与原「找物消除」类接近，建议后续单独确认。

**一眼结论**：25 款里 **19 款核心玩法 A 级以上**（其中 6 款 S 级几乎 1:1）；真正需要动大手术的只有 **fruit-funnel（C，已重建为 Suika Orchard）**；**sheep-solitaire（S 但签名缺失，P1 已补）** 与 **screw-sort（原 B，P2 已软化失败+2.5D 升 A/B+）** 两例「机制对、灵魂偏」已分别收口。

---

## 3. 重点深读（代码核实）

### 3.1 sheep-solitaire = 羊了个羊　【核心 S / 风格 A】

**核实到的机制**（`sheep-engine.ts` + `game-rules.ts`）：
- 3 层层叠网格，`computeExposed()` 用 2×2 区域判定「上层遮挡下层」✅
- 七格卡槽（`MAX_SLOTS = 7`）、三连消除（`MATCH_COUNT = 3`）✅
- 道具：撤回（undo，≤3 次，每次扣 30% 奖励）、洗牌、移出三张（manifest 描述）✅
- 三难度：easy/medium/hard = 8/12/15 类符号，时限 5/8/12 分钟

**偏离原作的 5 处（这恰恰是用户要的「贴回」目标）**：
1. **难度曲线失真（最关键）**：`sheep-engine.ts` 的布局生成器是**可证明必然有解**的——每个符号的三张副本固定在**同一层**，清空顶层即露出中层、再露底层，**永不卡死、永不超 3 张占槽**。原作羊了个羊的签名是「第 2 关近乎不可能，靠运气 + 道具 + 广告复活」。平台的 hard 只是「更多符号、同样的保解结构」，**远不如原作虐**——玩家体验从「抓狂上头」变成「稳过无聊」。
2. **社交钩缺失**：省份排行榜（病毒核心）只在**付费模式**（`manifest` 标注 "unpublished"），免费模式纯本地、无分享/排行。等于把原作最会传播的那层摘掉了。
3. **复活机制**：原作失败看广告复活；平台免费模式只有 restart，没有「再试一次」的钩子。
4. **每日关卡**：原作每日刷新牌面；平台 seed 来自 beacon（`BEACON_BLOCKS = 1`），非每日轮换。
5. **美术**：符号是 wool-flower/apple 等通用物件，羊主题偏弱。

**贴回原作建议（按性价比排序）**：
- 🔴 **引入「紧局生成器」**：打破「同符号同层」约束，让同符号跨层分布、制造槽位压力；hard 应**真正需要道具与规划**而非更多符号。这是把「S 级机制」升级成「原作灵魂」的唯一关键改动。
- 🟠 免费模式加**省份/好友排行 + 战绩分享**（纯前端即可，不必等链上结算）。
- 🟠 加**复活**：看广告 / 分享复活一次（免费模式可用 mock 广告或链上结算后接入）。
- 🟡 **每日种子轮换** + 关卡图鉴 / 小羊皮肤解锁（轻养成，给长线目标）。
- 🟡 美术向小羊 / 草场卡通靠拢（与平台暖白极简不冲突，可走「明亮卡通」）。

### 3.2 fruit-funnel = 合成大西瓜？　【核心 C / 风格 B】⚠️ 最大偏离

**核实到的机制**（`fruit-engine.ts`）：
- 6 藤蔓 × 8 水果 = 48 颗；**点藤蔓释放水果 → 进 7 格漏斗（channel，FIFO）**
- 若漏斗**末两位同色 → 配对消除（match-2）**；漏斗满（7）→ 失败
- 有时限（4 分钟）、连击计分、撤销 ×5、确定性可解

**与原作本质不同**：
- ❌ **无物理**：无重力、无碰撞合成、无容器与顶部警戒线
- ❌ **无进化链**：水果不会「合成更大一级」，只是同色配对消失
- ❌ **目标不同**：原作 = 合出西瓜；本作 = 清空藤蔓 / 配对
- 它更接近 **sheep-solitaire 的 match 机制（match-2 + 藤蔓版）**，只是借了「水果」皮

**一句话**：这是「借用水果主题的另一套三消变体」，不是合成大西瓜。用户看到「果园漏斗 / Fruit Funnel」会期待物理合成，实际是顺序配对 —— **期望落差最大**。

**两条贴回路线（二选一）**：
- 🅰 **重建为真 Suika（推荐，产品卖点最强）**：引入 Phaser 物理（Arcade 或 Matter），水果下落 + 碰撞合成 + 11 级进化链 + 顶部警戒线 + Next 预览。平台已是 Phaser 3，基础设施可复用；需评估移动端物理手感与性能。
- 🅱 **诚实重命名（改动最小）**：若坚持当前逻辑配对玩法，改名为「果园配对 / Orchard Match」之类，**不再对标合成大西瓜**，避免「以为是西瓜合成、结果是配对」的落差。

> 建议走 🅰。合成大西瓜是平台目前**唯一缺失的「物理合成」品类**，补上既还原原作又填补空白。

### 3.3 screw-sort = Screw Sort　【核心 B / 风格 B】

**核实到的机制**（`screw-engine.ts`）：
- 4 盒（容量 3）+ **5 格缓冲（buffer）**；点解锁螺丝 → 进同色盒（优先同 lane）否则进缓冲；**缓冲满 → 失败**
- 分层木板 `blockedBy`（外层清完才露内层）✅ 撤销 ×3、暂停、重开、确定性可解 ✅

**偏离原作**：
1. **失败条件**：原作多数版本**无失败**，仅效率/步数挑战；平台有「缓冲满即负」的硬性失败。若想更贴原作「解压无压力」定位，可改效率评分或大幅提高缓冲。
2. **维度**：原作是 **3D 可旋转模型**；平台是 **2D 层叠木板**——立体机械解压的签名丢失。
3. ✅ 颜色→盒映射、遮挡顺序、撤销这些核心都对。

**贴回建议**：
- 🟠 评估**移除/软化失败**（改效率评分），更贴近「解压无压力」原作定位；若保留失败，缓冲应明显更大。
- 🟠 视觉加 **3D 旋转 / 透视、金属高光、拧转动效**（当前 2D）。
- 🟢 保留确定性可解（平台优势，原作也强调可解）。

> **✅ P2 已完成（2026-07-13）**：上述两条 🟠 建议全部落地——`screw-engine.ts` 移除 `lost` 状态（第 6+ 不匹配螺丝仍入缓冲并 `overflows += 1`，**永不判负**），改由 `computeStars(undosUsed + overflows → 1–3 星)` 驱动重玩（`guest-engine` 留存 `bestStars`）；`ScrewSortScene.ts` 在现有 2D 图片渲染内叠加金属高光椭圆 + 投影椭圆 + 拧出预备 wiggle + 溢出轻 shake（reduced-motion 门控），不换引擎补回「立体机械解压」签名。评级 **核心 B→A、风格 B→B+**。详见 `docs/screw-sort-redesign-2026.md`。关键数值（`STAR_DEMERIT_TWO` / `BUFFER_CAPACITY` / 动效强度）标 `[PLACEHOLDER]`，本环境无浏览器，需真机 playtest 锁定。

---

## 4. 其余游戏评分卡（普查推断，建议逐款点开确认）

以下 19 款核心玩法均 A 级以上，仅列「可进一步贴原作」的小建议：

- **flappy-dash / snake-bounty / game-2048 / sudoku / color-clash**：机制几乎 1:1，**只需美术细节靠拢原作**（管道造型、蛇头、数字块质感、色块配色）。
- **merge-kingdom**（Triple Town）：4×4 拖拽合并，核心对；可加「建筑进化树 + 地块格子」强化原作辨识度。
- **zhuada-e**（抓大鹅）：3D 物理三连消除 + 晃手机，核心对；建议确认原作具体机制并补齐「找物」层（若原作是找物消除）。
- **jump-rush / curve-arrow**：蓄力/弹道核心对；可加原作标志性障碍与镜头反馈。
- **arrow-escape**（管道工）：依赖顺序解谜，核心对；风格可更「机械/管道」化。
- **bead-workshop / aim-master / dice-game / fogplay / gas-lucky-pool / gasbox / on-chain-tarot / pet-potion**：机制与原作一致，属 S/A 级，主要做美术主题强化。
- **red-envelope（抢红包）/ last-survivor（大逃杀）**：核心 A，但 Web3 化（GAS 红包 / 链上占位）改变了原作「纯社交零成本」手感——属产品决策，标「风格 B」，非玩法 bug。
- **daily-checkin / burn-league**：非游戏克隆（留存 / Web3 销毁榜），不在「贴原作」范畴，跳过。

---

## 5. 贴回路线图（优先级）

| 优先级 | 游戏 | 动作 | 预期收益 | 工作量 |
|---|---|---|---|---|
| **P0** | fruit-funnel → **Suika Orchard** ✅ | 已走路线 🅰：重建为真 Matter.js 物理合成（下落 + 碰撞合成 + 11 级进化链 + 顶部警戒线 + Next 预览）| 消除最大期望落差，补「物理合成」品类空白 | 大（已完成） |
| **P1** | sheep-solitaire | ✅ 紧局生成器 + 免费模式社交/复活/每日轮换 + 羊主题美术 | 还原原作「虐而上头 + 病毒传播」灵魂（用户点名） | 中（已完成） |
| **P2** | screw-sort | ✅ 软化失败（效率星级替代）+ 2.5D 伪3D 视觉 | 贴合「解压无压力」原作定位（核心 B→A、风格 B→B+） | 中（已完成） |
| **P3** | 19 款 A/S 级 | ✅ Batch 1+2 完成（11 款代码改动 + 4 款标待素材替换：gas-lucky-pool/gasbox/on-chain-tarot/pet-potion）；zhuada-e/red-envelope/last-survivor 待确认 | 统一「像原作」的第一印象 | 小（分散） |
| – | daily-checkin / burn-league | 不纳入（非游戏克隆） | – | – |

> **关键判断**：fruit-funnel 是**唯一 C 级**，且用户天然会把它和合成大西瓜关联 → 优先级最高。sheep-solitaire 虽是 S 级，但用户**点名**，且其「签名难度 + 社交钩」的缺失是体验级偏离 → P1。其余 A/S 级是「锦上添花」，可放长线。

---

## 6. Changelog

- **2026-07-13** — 初版审计：全量 25 款映射现实原型 + 保真度评分卡；重点深读 sheep-solitaire / fruit-funnel / screw-sort（代码核实）；给出贴回路线图（P0 fruit-funnel、P1 sheep-solitaire、P2 screw-sort、P3 其余）。
- **2026-07-13** — **P0 完成**：`fruit-funnel` 重建为 `Suika Orchard`（真 Matter.js 物理合成）。新增 `suika-engine.ts`（纯逻辑真相源）+ `scenes/SuikaScene.ts`（Matter 世界/碰撞合成/警戒线失败/键盘+拖拽瞄准）+ 重写 `main.tsx`/`PhaserPlayArea.tsx`/`messages.ts`/`manifest.ts`/`PlayArea.scss`；删除旧 `FruitFunnelScene.ts`/`scene-copy.ts`。tsc 0 错误、sass 编译通过。**物理手感数值（重力/弹性/警戒线宽限）标 `[PLACEHOLDER]`，需真机 playtest 锁定**（详见 `docs/suika-redesign-2026.md`）。
- **2026-07-13** — **P1 完成**：`sheep-solitaire` 灵魂还原。紧局生成器（`generateTightLayout` 跨层符号交换，只换 symbol 值不动卡位，规避层容量/渲染错位）+ 可解性模拟器（`simulateSolvability`，3 策略贪心 + 死局道具代理，输出 passNoItems/minItems/maxSlot）+ 每日两关（`dailyDateSeed`/`generateDailyLevel`：L1 spread 0.12 零道具必过，L2 spread 0.82 需 1–3 道具但非死局）+ 免费复活（L2 失败续局 1 次）+ 轻量社交（省份 mock localStorage + 全清积分 +1 + 分享文案占位）+ 羊主题美术/省份选择 UI（PhaserPlayArea 首入弹窗 + HUD 省份 chip，v2 令牌 + reduced-motion 门控）+ **深层卡面美术**（15 张羊主题 SVG 图标→sharp 转 webp 替换原通用水果物件 tile，统一奶油底+金边+绿钻角标卡框模板，`ALL_SYMBOLS`/loader DRY 化，生成脚本 `scripts/generate-sheep-tiles.mjs`）。tsc 0 错误、vite build 3609 模块通过。关键数值（spread / L2 cardTypes / swapCap / variant 上限 / 复活次数）标 `[PLACEHOLDER]`，**本环境无浏览器，需真机 playtest 锁定**（详见 `docs/sheep-solitaire-redesign-2026.md`）。
- **2026-07-13** — **P2 完成**：`screw-sort` 灵魂还原（贴合 Screw Sort「解压无压力」定位）。软失败（`screw-engine.ts` 删 `lost` 状态，第 6+ 不匹配螺丝仍入缓冲并 `overflows += 1`，永不判负；`flushBuffer` 在箱体转色时回灌，顶层木板 phase 0 无遮挡永远可推进 → 无死局）+ 效率星级（`computeStars(undosUsed + overflows → 1–3 星)`，`guest-engine` 留 `bestStars` 驱动重玩，`PhaserPlayArea` 显示最佳星级）+ 2.5D 伪3D 视觉（`ScrewSortScene.ts` 在现有 2D 图片渲染内叠加金属高光椭圆+投影椭圆+拧出预备 wiggle+溢出轻 shake，reduced-motion 全部门控，不换引擎）+ 文案去失败化（`messages.ts` rulesCopy/状态词）。tsc 0 错误、vitest 26 passed、vite build 1871 模块通过。评级 **核心 B→A、风格 B→B+**。关键数值（`STAR_DEMERIT_TWO=3` / `BUFFER_CAPACITY=5` / 溢出 shake 0.003 / 拧出旋转 30°）标 `[PLACEHOLDER]`，**本环境无浏览器，需真机 playtest 锁定**（详见 `docs/screw-sort-redesign-2026.md`）。
- **2026-07-13** — **P3 启动**：19 款 A/S 级「美术细节靠拢原作」。Batch 1（6 款机制≈1:1）已完成代码改动 + tsc/vite build 全绿：sudoku（羊皮纸→清爽白网格）、color-clash（Simon 四色已对，点亮光晕增强）、game-2048（标签按调色板取字色+去奶白底框，修高阶瓦片深字看不清+更贴原作）、snake-bounty（蛇头方向感知眼睛叠加层）、arrow-escape（关节黄铜套接环，机械管道感）、flappy-dash（坠机碎屑改绿主题；管道/鸟为 webp 素材，需素材替换才能真·绿管+Flappy 鸟，已标注）。详见 §7 进度表。剩余 14 款分批推进中。
- **2026-07-13** — **P3 Batch 2**：11 款代码层美术/机制靠拢（tsc + vite build 全绿）：bead-workshop（托盘暖木 `cocoa 0x754225→0x5a3420` + `border 0xe9cfa9→0xd8b27a`）、aim-master（`RING_COLORS` 改红白交替命中闪光）、dice-game（绿绒赌桌 `FELT_GREEN/DARK` 深绿）、fogplay（绿赌桌 `felt/feltDeep`）、merge-kingdom（地块阴影矩形 + 描边 1→2 加粗）、jump-rush（镜头反馈补齐全缺：起跳 `zoomTo(1.04)` + perfect `flash` + miss `shake`，全 reduced-motion 门控）、curve-arrow（命中 bullseye `shake+flash`）。4 款主体视觉烤在 webp、代码层改不动，标「待素材替换」：gas-lucky-pool（代码层无转盘，是 OneGate vault 界面，需换 `gas-vault-stage.webp`）、gasbox（整屏 webp/React 渲染）、on-chain-tarot（牌背 webp 且 `assets:cards` 会重生成覆盖）、pet-potion（宠物/药水瓶 webp）。zhuada-e（需先确认原作机制）、red-envelope/last-survivor（Web3 产品决策改手感）待用户确认是否做。
- **2026-07-13** — **P3 素材替换管线**：4 款「待素材替换」游戏用 SVG→sharp→webp 生成真实素材并挂接（tsc + vite build 全绿）。gas-lucky-pool（新增 `public/wheel.webp` 幸运转盘 + 场景 hero 位挂接 + `revealReward` 缓动旋转，reduced-motion 门控；生成 `scripts/generate-wheel.mjs`）、gasbox（覆盖 `gasbox-capsule-machine-cutout.webp` 480×560 + `gasbox-prize-capsule-cutout.webp` 220×220；生成 `scripts/generate-machine.mjs`，初版误写目录已修正）、on-chain-tarot（覆盖 `public/cards/back.webp` 825×1425 紫金牌背；生成 `scripts/generate-card-back.mjs`，注意 deck 生成器会再覆盖）、pet-potion（覆盖 pet-egg/baby/teen/adult.webp + 新增 `potion-bottle.webp` + 场景键挂接；生成 `scripts/generate-pet-art.mjs`）。4 款 §7 进度表标 ✅。剩 zhuada-e / red-envelope / last-survivor 待确认。
- **2026-07-13** — **on-chain-tarot 补「解答」解读层（产品缺口修复）**：用户指出现有塔罗只有牌面+牌名、无解读（核心幻想未满足）。数据层 `tarot-data.ts` 新增 `TarotCardMeaning` + `CARD_MEANINGS_ZH/EN`（id 0-77 各 `essence` 短内核 ≤10字 / `reading` 1-2 句，RWS 正位标准意、玩家向自省语气）+ `getCardMeaning(id, locale)`，`localizeTarotCard` 注入 `essence/reading`。展示层 4 处：① Phaser `TarotScene` 翻牌 `meta` 显「牌名+essence」两行；② React 抽屉 `currentSpread` 的 `<em>` 翻牌显 `reading`（替原花色分类 `cardKeywords`），顶部加 `readingLeadLabel` 意图引语；③ `useTarot.getReading` 复制文案带上解读（过去/现在/未来（牌名）：解读）；④ `messages.ts` 加 `readingLeadLabel`、`PlayArea.scss` 加 `.tarot-drawer__reading-lead` + spread em 折行。验证 **tsc 0 / vitest 26 passed / vite build 全绿**；对应测试断言同步更新。牌面 webp 仍由 `assets:cards` 原管线生成，未动。
- **2026-07-13** — **on-chain-tarot 二次修复（交互+观感）**：用户反馈「牌一直浮动且模糊像掉帧」「发牌后不能点开看解析」。① 移除 `TarotScene.startAmbientMotion` 的逐卡无限 yoyo 浮动（子像素位移+抗锯齿导致模糊/掉帧感），卡牌静止落定更清晰；渲染落点整数化（buildSpread / settleMotionToState 对 `startX+gap`、`cardCenterY` 做 `Math.round`，`computeLayout` 内部保留 float 以维持 280px/micro 边界断言）。② 新增点击放大详情 `openCardDetail(index)`/`closeCardDetail()`（Phaser depth-1000 叠层：暗 backdrop + 面板 + ✕ 关闭；放大卡面 + 牌名 + essence + 完整 reading + 位置框(过去/现在/未来各一句话) + 元素对应(权杖=火/圣杯=水/宝剑=风/星币=土/大阿卡纳=—) + 关键词），reduced-motion 门控；交互路由 `cardTapEnabled` 改「已发牌即可用」、`handleCardTap` 未翻→翻牌/已翻→开详情，overlay 随牌阵变化自动关闭。文案 `messages.ts` 加 detailClose/detailPosition/detailElement/detailKeywords/detail{Past,Present,Future}Frame/element{Fire,Water,Air,Earth,None} 并经 `PhaserPlayArea` sceneText 桥接。验证 **tsc 0 / vitest 26 / vite build 全绿**。
- **2026-07-13** — **on-chain-tarot 放大面板卡牌放大**：用户反馈放大详情里卡牌太小。改 `openCardDetail` 卡面尺寸上限从 `panelH*0.34` 提到 `panelH*0.6`（并受内容宽度按塔罗比例换算、且预留 168px 文字带防矮屏/横屏溢出约束）；手机卡面宽从 ~163px 增至 ~285px，成为面板主角。牌名 18→21px、essence 13→14px 做层级。验证 **tsc 0 / vitest 26 / vite build 全绿**，HMR 已热更 5184。
- **2026-07-13** — **on-chain-tarot 酷炫特效套件（juice）**：用户要"卡牌游戏该有的酷炫效果/动画"。实现 5 项，全部 reduced-motion 门控、运行时生成贴图（无新增素材文件）：① 氛围层 `buildAmbientField()` + 改写 `startAmbientMotion`/`stopAmbientMotion`——缓慢旋转 arcane 符文环（90s linear）+ 漂移余烬（≤18 个 yoyo 飘动），depth 0 置于牌后，**非子像素牌位移故不模糊**（延续此前去浮动决策）；② 翻牌 `flipCardView(view, suit)` 加 `burstReveal`——按 suit 元素取色的径向光晕 + 白核闪光 + 扩散冲击环 + 10 火花（`elementColor`：权杖=火橙/圣杯=水蓝/宝剑=风淡蓝/星币=土绿/大阿卡纳=金）；③ 发牌 `playDealMotion` 每牌离堆时牌堆 gold 光晕 puff；④ 放大详情 `openCardDetail` 卡后 halo bloom + 12 火花；⑤ `playReadingCelebration` 火花按各牌元素色 + 一道横向光扫。新增 `ensureFxTextures`（`fx-glow` 径向/`fx-spark` 四角星纹理）、`emitSparkles`、`burstReveal`、`elementColor`。验证 **tsc 0 / vitest 26 / vite build 全绿**，HMR 已热更 5184。
- **2026-07-13** — **酷炫特效全量扩展（「都加」）：on-chain-tarot + 3 款素材替换游戏同款 juice**。用户确认把此前 on-chain-tarot 的 juice 全套铺开并加强。全部 reduced-motion 门控、运行时生成贴图（无新增素材文件），三款 Phaser 游戏复用已验证的 `ensureFxTextures`/`emitSparkles`/`beamReveal` 模式：
  - **on-chain-tarot（加强）**：① 氛围层 `startAmbientMotion` 改密改亮——符文环 `ringSize` 0.62→0.66、线宽/透明度提升、ticks 24→36、旋转 90s→72s；新增**中央呼吸光晕**（ADD 混合 `fx-glow`，alpha 0.08↔0.2）；余烬上限 18→30、更亮更大更活跃。② 翻牌爆发更夸张——`flipCardView` 加 `this.cameras.main.shake(160, 0.006)` + `beamReveal(cx, cy, color)` 元素色向上光柱（ADD 混合，`scaleX 0.18→1.35 / scaleY 0.55→3.4`，520ms）。③ 悬停金边流光——`makeCardView` 新增 `hoverGlow`（金 tint `fx-glow`，ADD，初始 alpha 0），`onHoverIn` 呼吸到 0.85（reduced-motion 下静态 0.5）、`onHoverOut` 归零；绘制顺序在 shadow 前。
  - **gas-lucky-pool**：中奖分支 `shake(180, 0.005)`；`spawnRewardBurst` 末加 `emitSparkles(DESIGN_W/2, 134, gold, 14, 900)` + `beamReveal(gold)`。
  - **pet-potion**：stage 升级分支 `evolveFx(stage)`（含 shake + 16 火花 + beam，色按 stage：0=jade/1=blue/2=gold）；药水 ready 加 `emitSparkles(fxX, fxY, gold, 12, 900)` + `beamReveal(gold)`。
  - **gasbox（纯 CSS，无 Phaser）**：`PlayArea.scss` 三组 juice——`::before` 待机呼吸光晕（`gasbox-machine-glow` 3.6s）+ `[data-state=result] ::after` 中奖金色径向爆发（`gasbox-win-burst` 720ms）+ `[data-state=result] .gasbox-scene__result::before` conic-gradient 旋转金边（`gasbox-result-rim` 2.6s linear）；全部 `prefers-reduced-motion:reduce` 门控压到 0.001ms（复用既有 `data-state=result` 基建，风险最低）。
  - 验证：**on-chain-tarot** tsc 0 / vitest 26 / build 绿；**gas-lucky-pool** tsc 0 / vitest 2 / build 绿；**pet-potion** tsc 0 / build 绿；**gasbox** tsc 0 / build 绿（CSS juice）。预览：4 dev server 在线（5180 gasbox / 5181 gas-lucky-pool / 5183 pet-potion / 5184 on-chain-tarot），guest 模式免钱包。

---

## 7. P3 进度追踪（美术细节靠拢原作）

> 范围：19 款 A/S 级（P0 fruit / P1 sheep / P2 screw 已单独收口，不在此列）。
> 验证口径：本环境无浏览器，**代码改动仅用 `tsc` + `vite build` 验证编译**；最终视觉保真度需真机/用户目检（标 ⚠️ 者）。
> 关键发现：Batch 1 的实时渲染全在 Phaser 场景内、用硬编码 hex 或 webp 素材，**未走设计令牌**；React 版 `PlayArea.tsx` 均为死代码。

| 游戏 | 原作 | 美术靠拢动作 | 状态 | 备注 |
|---|---|---|---|---|
| **sudoku** | 数独 | 羊皮纸→白纸 `0xffffff` + 浅灰细线 `0xcccccc` + 近黑粗宫线 `0x1a1a1a` | ✅ 完成 | 清爽白网格，保留蓝字 |
| **color-clash** | Simon | 四色已对；点亮光晕放大（R×1.9→2.3）+ 闪强光晕 alpha 0.12→0.22 + 按钮光晕 0.16→0.34 + 亮块 0.58→0.7 | ✅ 完成 | 仅强度增强，零结构风险 |
| **game-2048** | 2048 | 标签按 `tileColors(exp).text` 取字色（修高阶瓦片深字看不清）+ 去掉奶白底框/白影，数字直接压方块 | ✅ 完成 | `TILE_PALETTE` 本就对齐原作 |
| **snake-bounty** | 贪吃蛇 | 蛇头方向感知白眼+黑瞳叠加层（`eyeGfx`，随 `localDir` 旋转） | ✅ 完成 | 头为独立 webp，叠加不碰原图 |
| **arrow-escape** | 管道工 | 每关节黄铜套接环（描边圈 `0xc8973f`） | ✅ 完成 | additive，不改两色调 |
| **flappy-dash** | Flappy Bird | 坠机碎屑改绿主题 | 🟡 部分 | ⚠️ 管道/鸟为 webp 素材，**需素材替换**（绿管+Flappy 鸟）才能真·还原；代码层仅能做主题微调 |
| merge-kingdom | Triple Town | 地块格子阴影（`shadow` 矩形 +3,+3, boardBorder 0.3 透明）+ 描边 1→2 加粗；建筑图已是分级 webp 图标 | ✅ 完成 | 进化树连线/新障碍种类需素材，未做 |
| zhuada-e | 抓大鹅 | 确认原作机制 + 补「找物」层 | ⬜ 待确认 | 需先确认原作机制 |
| jump-rush | 跳一跳 | 镜头反馈：起跳 `zoomTo(1.04)` + perfect `flash(120,...)` + miss `shake(180,0.012)`，全 reduced-motion 门控 | ✅ 完成 | ⚠️ 弹簧/尖刺/移动障碍无素材，仅补镜头反馈 |
| curve-arrow | 愤怒小鸟 | 命中 bullseye `shake(160,0.008)` + `flash`；墙命中已有 `shake(140,0.006)` | ✅ 完成 | reduced-motion 门控；新障碍种类需素材 |
| bead-workshop | 串珠 | 托盘改暖木：`cocoa 0x754225→0x5a3420` + `border 0xe9cfa9→0xd8b27a` | ✅ 完成 | 珠子为 webp，质感需素材替换 |
| aim-master | 打靶 | `RING_COLORS` 改红白交替（命中闪光经典色） | ✅ 完成 | ⚠️ 靶面/准星为 webp，需素材替换 |
| dice-game | 掷骰 | 赌桌绿绒：`FELT_GREEN 0xa7e8ce→0x0b6b3a` + `FELT_DARK 0x78cfae→0x095a31` | ✅ 完成 | 骰子点数为 webp，需素材替换 |
| fogplay | 抛硬币 | 赌桌绿：`felt 0x39a96b→0x0b6b3a` + `feltDeep 0x208253→0x095a31` | ✅ 完成 | ⚠️ 硬币正反面为 webp，需素材替换 |
| gas-lucky-pool | 幸运转盘 | 新增车轮素材（`public/wheel.webp` 512×512，6 分区紫金/青/玫瑰交替 + 中心轮毂 + 指针）+ 场景挂接：hero 位改转盘、`revealReward` 触发缓动旋转（`angle +360*3` + 缓出）、reduced-motion 门控 | ✅ 完成 | SVG→sharp→webp 管线；生成脚本 `scripts/generate-wheel.mjs`；原 vault 界面仅作背景保留 |
| gasbox | 扭蛋机 | 替换 `src/gasbox-capsule-machine-cutout.webp`（480×560，透明球罩+机身）与 `src/gasbox-prize-capsule-cutout.webp`（220×220，彩色胶囊），纯素材替换零代码改动 | ✅ 完成 | SVG→sharp→webp；生成脚本 `scripts/generate-machine.mjs`；初版误写一层目录已修正 |
| on-chain-tarot | 塔罗 | 替换 `public/cards/back.webp`（825×1425，神秘紫金几何纹牌背，居中太阳+星点+双描边）；**另补「解答」解读层**：数据层加 78 张中英牌意（essence+reading），翻牌 meta 显牌名+essence，抽屉 currentSpread 显 reading + 顶部意图引语，复制分享带解读；**二次修复**：移除逐卡浮动模糊、点击已揭示牌放大看全解读/元素/关键词/位置框 | ✅ 完成 | SVG→sharp→webp；生成脚本 `scripts/generate-card-back.mjs`；注意现有 deck 生成器会再覆盖，已记录需改生成器。解读层 + 放大详情见 Changelog |
| pet-potion | 宠物养成 | 替换 `public/art/pet-egg/baby/teen/adult.webp`（圆润 blob 宠物+表情+渐变）并新增 `public/art/potion-bottle.webp`（玻璃瓶+液体+软木塞+高光）+ 场景挂接（`PET_ASSETS.potion`、`preload`、`potionImage` 初始键、updatePotion 改 `setTexture(PET_ASSETS.potion)`） | ✅ 完成 | SVG→sharp→webp；生成脚本 `scripts/generate-pet-art.mjs` |
| red-envelope | 抢红包 | 风格 B（Web3 化改手感） | ⬜ 待确认 | 产品决策，非玩法 bug |
| last-survivor | 大逃杀 | 风格 B（Web3 化改手感） | ⬜ 待确认 | 产品决策，非玩法 bug |

---

### 素材替换管线（SVG→webp，复用 sheep-solitaire 模式）

- **管线**：`sharp(SVG 字符串)→webp({quality:92, alphaQuality:100})`，输出到各 app 的 `public/` 或 `src/`；保留 SVG 源可二次编辑。sharp 安装在 managed node workspace（`~/.workbuddy/binaries/node/workspace`），从 app 经 root hoist 解析。
- **已生成 4 款**：
  - `gas-lucky-pool`：`public/wheel.webp`（512×512，6 分区紫金/青/玫瑰交替 + 轮毂 + 指针）+ 场景挂接（hero 位改转盘、`revealReward` 缓动旋转，reduced-motion 门控）。生成脚本 `scripts/generate-wheel.mjs`。
  - `gasbox`：覆盖 `src/gasbox-capsule-machine-cutout.webp`（480×560）+ `src/gasbox-prize-capsule-cutout.webp`（220×220）。生成脚本 `scripts/generate-machine.mjs`。⚠️ 初版误写到 `apps/gasbox/` 一层（游戏仍加载旧 `src/` 图），已修正输出路径并清理误放文件。
  - `on-chain-tarot`：覆盖 `public/cards/back.webp`（825×1425，紫金几何牌背）。生成脚本 `scripts/generate-card-back.mjs`。⚠️ 现有 deck 生成器会再覆盖牌背，长效方案需改该生成器（已记录）。
  - `pet-potion`：覆盖 `public/art/pet-egg/baby/teen/adult.webp` + 新增 `public/art/potion-bottle.webp`；场景加 `PET_ASSETS.potion` 键、`preload`、初始 `potionImage` 键、`updatePotion` 改 `setTexture(PET_ASSETS.potion)`。生成脚本 `scripts/generate-pet-art.mjs`。
- **验证**：4 款 `tsc`/`vite build` 全绿（gas-lucky-pool / pet-potion 含代码改动；gasbox / on-chain-tarot 纯素材替换）。
- **仍待确认 3 款**：zhuada-e（确认原作机制）、red-envelope / last-survivor（Web3 产品决策）。
