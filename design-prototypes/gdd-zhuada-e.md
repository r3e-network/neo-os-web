# 抓大鹅 (Catch the Goose) — 小游戏 GDD v2.2 (B 类 · 物理抽物版)

> 平台：neo-miniapps-platform · 类型：**B 类「限时物理抽物 / 托盘 3 连消除」版**（Three.js + cannon-es 真 3D 物理）
> 模式：免费本地模式（guest engine，不接链上合约，复用统一游戏框架 GameBridge）
> 文档状态：v2.2 — 与实现一致（已通过构建/逻辑测试 + 端到端验证）
> 作者：GameDesigner
> 变更记录：
> - v1.0 (2026-07-09)：A 类 Phaser 网格找物版设计稿。
> - v2.0 (2026-07-09)：改为 B 类物理抽物版（用户决策：匹配其提供的 Three.js + cannon-es 教程，可上线完整版）。GDD 与 `apps/zhuada-e` 实际代码对齐；补充端到端验证结论。
> - v2.1 (2026-07-09)：四大后续打磨落地——① 原创低多边形模型库替换 bare primitive + emoji；② 道具系统（洗牌/提示/加时，限量供应 + 里程碑回赠）；③ 代码分割（Three.js+cannon-es 按需动态加载，入口 chunk 由 786KB→213KB/gzip 67KB）；④ 蒙特卡洛数值调优（重写 15 关曲线，时间随物品数增长 40s→230s，贪心策略 100% 可解）。全部通过端到端验证。
> - v2.2 (2026-07-09)：第五、六后续打磨落地——⑤ **音频系统**：`logic/sound.ts` 纯合成 WebAudio 音效引擎（落地/拾取/消除/连击/胜利/失败/道具/洗牌/点击，0 音频文件、零版权风险），单例共享静音态，首次手势解锁 + localStorage 持久化静音；⑥ **移动端触屏适配**：canvas 改用 `pointerdown`（覆盖鼠标/触屏/笔）+ `touch-action:none`/禁选/禁高亮/overscroll 收敛，避免触屏被当滚动吞掉落点。已通过 ESLint + 生产构建 + SoundEngine 逻辑单测（10 项全过）。

---

## 0. 重要声明：关于「原本的资源」

**结论：没有可合法直接复刻的正版素材。**

微信小游戏「抓大鹅」（appid `wxb98ac240fd74b0e3`）是闭源商业产品，官方美术/音效资源没有开源，抓包提取属于侵权，本作**不使用**任何正版素材。

**本作做法：** 玩法 1:1 还原社区 Three.js + cannon-es 复刻思路（玩法机制不受版权保护，可合法学习复现）+ **自绘原创 3D 美术**。`apps/zhuada-e/src/scenes/models.ts` 用 Three.js 基础几何体组合出 12 种**原创可爱低多边形**果蔬/小鱼（番茄带蒂、胡萝卜带叶、草莓/鱼/蛋/蘑菇…），胜利大鹅也是原创低多边形模型——刻意做成通用造型，**不复制正版 IP 素材**，颜色对齐暖色调。体验与正版一致，资源为原创、可后续替换。

**音频同样零版权风险：** 全部音效由 `logic/sound.ts` 用 WebAudio **实时合成**（振荡器 + 滤波白噪声），**没有任何音频文件**，因此不存在采样/音源侵权问题；静音状态写入 localStorage，首次用户手势（开始/首次点屏）解锁 `AudioContext` 以符合浏览器自动播放策略。

> 后续若需更精致美术：把 `ITEM_DEFS` 里的 `model`/`color` 换成建模资产（如 GLTF），接口已预留（`model` 字段可扩展为路径）。emoji 仅保留在托盘/HUD 兜底显示。

---

## 1. 玩法定义（Fun Hypothesis）

**核心乐趣假设：** 一堆杂物在物理盒子里堆叠、晃动，玩家靠「观察 + 眼疾手快」把相同物品逐个**抽出来**摆进托盘，凑齐 3 个就咔嚓消除；在倒计时归零前把盒子清空，就抓住捣乱的大鹅。张力来自「托盘快满了但还差一个凑不齐」+「时间不够」。

**一句话循环：** 看 → 点一个物品抽出来 → 摆进托盘 → 凑 3 个消除 → 盒子更空 → 清空 → 抓大鹅过关。

这是**物理抽物类**（不是 A 类网格找物，也不是合成类）：需要真 3D 物理（物品堆叠、碰撞、掉落），需要「射线拾取 + 托盘槽位 + 3 连判定 + 倒计时 + 关卡递进」。

---

## 2. 设计支柱（Design Pillars）

1. **一眼就懂**：进场 3 秒内知道「点物品 → 抽到托盘 → 凑 3 个消」。
2. **眼疾手快**：核心张力来自观察力、手速与托盘空间管理，而非数值养成。
3. **关关有目标**：每关有明确「盒内剩余数 / 托盘占用 / 倒计时」，清完即抓鹅过关。
4. **失败可读**：托盘塞满且无可消除三元组 = 失败，原因明确（差一个凑不齐）。
5. **零挫败上手**：前 2 关物品少、种类少、时间长、必过（教学关）。

---

## 3. 核心循环（Core Loop）

### Moment-to-Moment (0–30 秒)
- **Action**: 玩家在堆叠的盒子里点选一个物品
- **Feedback**: 被点中的物品轻微放大（press feedback），随后飞入托盘对应槽位
- **Reward**: 托盘凑齐 3 个同类 → 消除动画 + 计数 -3 + 计分 +（连击时）额外加分

### Session Loop (1–3 分钟 / 一关)
- **Goal**: 在倒计时内把盒内所有物品抽空（每次抽到托盘，三元组即时消除）
- **Tension**: 托盘仅 7 槽，若一直凑不齐三元组会塞满 → 卡死失败；倒计时压迫
- **Resolution**: 盒内清空 → 大鹅跳出被抓 → 过关结算（用时/连击/分数）；托盘卡死或超时 → 失败重来

### Long-Term Loop (15 关递进)
- **Progression**: 关卡递增（种类 3→12、每种份数 2→4、时间 40s→230s、盒子略增大；时间随物品数同步增长，详见 §4/§6）
- **Retention Hook**: 关卡进度本地保存（localStorage `zhuada-e:progress`）+ 通关数/最佳分数记录 + 每日挑战（后续）

---

## 4. 关卡与物品模型

### 物品层（12 种基础物品，原创低多边形模型 `scenes/models.ts` + emoji 兜底）
| id | 名称 | emoji | 模型(model) | 物理体(geometry) | 颜色基调 |
|----|------|-------|-------------|------------------|----------|
| 0 | 番茄 | 🍅 | tomato | sphere | 红 |
| 1 | 胡萝卜 | 🥕 | carrot | cone | 橙 |
| 2 | 玉米 | 🌽 | corn | cylinder | 黄 |
| 3 | 茄子 | 🍆 | eggplant | icosa | 紫 |
| 4 | 苹果 | 🍎 | apple | sphere | 绿 |
| 5 | 西兰花 | 🥦 | broccoli | icosa | 深绿 |
| 6 | 蘑菇 | 🍄 | mushroom | cylinder | 红白 |
| 7 | 洋葱 | 🧅 | onion | sphere | 浅紫 |
| 8 | 辣椒 | 🌶️ | pepper | cone | 红 |
| 9 | 西瓜 | 🍉 | melon | sphere | 青绿 |
| 10 | 鸡蛋 | 🥚 | egg | cylinder | 奶黄 |
| 11 | 小鱼干 | 🐟 | fish | box | 蓝 |

> 视觉 `model`（低多边形组合造型）与物理 `geometry`（碰撞体）解耦：碰撞体保持简单基本形以保证堆叠稳定，视觉用 `buildModelMesh(kind, color)` 组合出更精致的原创造型。大鹅 `buildGoose()` 是过关奖励演出元素，非可消除物品。

### 关卡生成规则（确定性，guest 用种子 RNG）
- 每关给定 `kinds`（种类数）与 `perKind`（每种份数），**每种物品数量 = `perKind × 3`** → 永远可被 3 整除 → **永远可清空、无死局**。
- 生成：选 `kinds` 种物品，每种放 `perKind × 3` 个，打散后从盒口上方逐批掉落。
- `boxSize` 随关卡略增大（盒壁加宽，容纳更多物品）。
- 倒计时**随物品数同步增长**（`40s → 230s`），不再随关卡收紧——避免「物品暴涨但时间缩水」的数学死局（见 §6 调优结论）。

```
Variable            | Base      | Min  | Max  | Tuning Notes
--------------------|-----------|------|------|-------------------
Tray slots          | 7         | 5    | 9    | 经典 7 槽；[PLACEHOLDER] 可测 5/9 手感
Kinds (k)           | 3 → 12    | 3    | 12   | 教学关 3，后期 12（LEVEL_CURVE）
Per kind copies     | 2 → 4     | 2    | 4    | 每种 = perKind×3（LEVEL_CURVE）
Level time (s)      | 40 → 230  | 40   | 230  | 随物品数增长 = 贪心步数×1.5s+12s（ Monte-Carlo 调出，见 §6）
Box size            | 9 → 12    | 9    | 12   | 盒壁半宽略增（LEVEL_CURVE）
Gravity             | -18       | -25  | -12  | [PLACEHOLDER] 手感：更重掉得快
Combo window (ms)   | 1500      | 800  | 2500 | 连击计时，影响加分
```

---

## 5. 机制规格（Mechanic Specs）

### Mechanic: 物理掉落 (Physics Drop)
- **Purpose**: 营造「真实堆叠、晃动」的抽取手感
- **Player Fantasy**: 「满满一盒杂物，摇摇欲坠」
- **Input**: 关卡开始（`dealt`）→ 物品从盒口上方逐批掉落
- **Output**: cannon-es 刚体在开放盒内堆叠、碰撞、静止（allowSleep 优化）
- **Success**: 物品稳定堆在盒内、可被射线拾取
- **Failure**: 物品穿模/飞出盒外 → 需要碰撞体与盒壁静态平面约束（已实现 4 面 + 地面）
- **Edge Cases**:
  - 帧率抖动 / rAF 节流：生成节奏用**未钳制的真实 dt** 累加，避免 `spawnTimer` 永远到不了阈值（已修复）
  - **物理步必须 `world.step(1/60)`**：cannon-es 的 `world.fixedStep` 在本工程装版本（0.20.0）下**不会推进刚体**（已踩坑并修复）——见 §10
- **Tuning Levers**: 重力、掉落初速、生成间隔、刚体阻尼
- **Dependencies**: 关卡生成（提供物品列表）、射线拾取

### Mechanic: 射线拾取抽取 (Raycast Extract)
- **Purpose**: 核心交互动作
- **Input**: 玩家在 canvas 上 `pointerdown`（触屏/鼠标统一）
- **Output**: 屏幕坐标 → NDC → `Raycaster` 命中最近物品 → `bridge.dispatch("extract", { itemId, kind })`
- **Success**: 命中非空物品 → 引擎移除该逻辑物品 → 物品飞入托盘（mesh 动画）
- **Failure**: 命中空白处 / 非 `dealt` 状态 → 无操作（不惩罚）
- **Edge Cases**:
  - 拾取前世界矩阵可能过期（渲染循环未跑）：`onPointerDown` 内显式 `camera.updateMatrixWorld()` + `scene.updateMatrixWorld(true)` 后再射线（已修复）
  - 被抽走动画中的物品（`extracting`）不计入可拾取集合
- **Tuning Levers**: 命中容差（射线本身精确，无额外半径）、press 放大反馈时长
- **Dependencies**: 物理掉落、托盘、引擎状态机

### Mechanic: 托盘 3 连消除 (Tray Triple Match)
- **Purpose**: 核心消除动作
- **Input**: 抽出一个物品 → 放入首个空槽
- **Output**: 同 kind 在托盘内达到 3 个 → 清除这 3 个槽；否则保留
- **Success**: 三元组消除，播放消除反馈 + 计分
- **Failure**: 托盘塞满且无任何 kind 达到 3 个 → 触发卡死（`isTrayStuck`）
- **Edge Cases**:
  - 抽出顺序导致临时占用高：玩家需规划「先抽哪种」避免塞满——这是核心策略张力
- **Tuning Levers**: 槽位数（7）、是否允许「撤回/换位」
- **Dependencies**: 射线拾取、计分、状态机

### Mechanic: 倒计时 (Timer)
- **Purpose**: 制造张力
- **Input**: 关卡 `dealt` 即倒计时
- **Output**: 剩余时间 → HUD；归零 → `expired` 失败态
- **Success**: 时间内清空
- **Failure**: 超时未清空 → fail 结算
- **Edge Cases**: 暂停/失焦 → 暂停计时（visibilitychange）
- **Tuning Levers**: 每关时长（LEVEL_CURVE）

### Mechanic: 抓大鹅过关 (Goose Catch)
- **Purpose**: 正反馈高潮
- **Input**: 盒内清空瞬间（逻辑物品数 = 0）
- **Output**: 状态 → `solved`，大鹅 `🪿` 从顶部跳出 bob 动画 → 过关结算面板
- **Success**: 播放 catch 动画 + 结算（分数/用时/连击）
- **Failure**: 无（清空必触发）
- **Dependencies**: 状态机

### Mechanic: 卡死失败 (Tray Jam)
- **Purpose**: 失败条件（与超时并列）
- **Input**: 托盘满（7/7）且无可消除三元组
- **Output**: 状态 → `expired`，显示 `⏰` 失误演出
- **Success**: 明确提示「托盘塞满，大鹅溜走了」
- **Dependencies**: 托盘、状态机

### Mechanic: 道具系统 (Power-ups — 洗牌/提示/加时)
- **Purpose**: 给玩家在卡顿/失误边缘的「翻盘筹码」，同时用**稀缺性**（限量供应）驱动谨慎使用，而非可无限购买的货币
- **Player Fantasy**: 「差一点就卡死了——洗一把！」「该抽哪个？高亮给我看」「再给我 15 秒！」
- **Input**: HUD 道具栏按钮点击 → `bridge.dispatch("shuffle"|"hint"|"addTime", {ms?})`
- **Output**:
  - **洗牌 (shuffle)**：引擎把盒内剩余物品的 `kind` 重新随机分配（总数仍是每种 ×3，故仍 100% 可解），`shuffleNonce +1`；场景收到 nonce 变化 → 清空并重新逐批掉落（`resetScene + queueSpawns`），保留物理手感。每关基础 1 次。
  - **提示 (hint)**：`hintNonce +1`；场景收到 nonce → `computeHintKind(tray, items)` 选出最优可消 kind（优先「托盘已 2 个且盒内还有」直接凑齐；其次「托盘 1 个且盒内 ≥2」推进；否则盒内最多的 kind），对该 kind 的盒内物品做 ~1.6s 绿色 emissive + 缩放脉冲高亮。每关基础 3 次。
  - **加时 (addTime)**：`deadline += ms`，`timeLeftMs += ms`（默认 15000）。每关基础 1 次。
- **Resource model**: 限量供应（非货币）。每关开局授予 `shuffle:1 / hint:3 / addTime:1`；游玩中通过**里程碑回赠**补充——分数每破 100 回赠 +1 提示，每破 200 回赠 +1 加时，连击达到 4 连额外回赠 +1 加时（奖励技巧型操作，符合行为经济学：skill → 资源正反馈）。
- **Success**: 道具帮助玩家脱离卡死/超时边缘，体验「有惊无险」。
- **Failure**: 道具用尽仍无法挽回 → 正常失败（不惩罚用错）。
- **Edge Cases**:
  - 非 `dealt` 状态（大厅/胜负画面）点击道具 → 引擎直接 return，不消耗次数。
  - 次数为 0 时按钮 disabled（UI 置灰），不可点。
  - 洗牌瞬间若部分物品正在抽取动画中：场景 `resetScene` 会统一清场重落，无残留。
- **Tuning Levers**: 每关授予量、里程碑阈值、加时秒数、提示脉冲时长/颜色。
- **Dependencies**: 引擎 observables（`powerups`/`shuffleNonce`/`hintNonce`）、场景 nonce 响应、HUD 道具栏。

---

## 6. 计分与经济（本地）

```
基础分：每消除一组(3个) +10          (SCORE_PER_MATCH)
连击：COMBO_WINDOW_MS(1500ms) 内连续消除，每组额外 +5×(连击步数-1)  (COMBO_BONUS_PER_STEP)
过关奖励：剩余时间(秒) × 2           (TIME_BONUS_PER_SEC)
道具里程碑回赠：分数每破 100 → +1 提示；每破 200 → +1 加时；连击达 4 连 → +1 加时
总通关数：累计（localStorage）
最佳分数：每关/总计记录
```

> 无虚拟货币通胀问题（纯本地分数），故不建模 supply/demand。后续接链上奖励时再引入积分 sinks（whales 需 prestige sink，dolphins 需 value sink，minnows 需可达成的 aspirational 目标）。

### 6.1 数值调优（Monte-Carlo，脚本 `scripts/tune.mjs`）
对 15 关各跑 4000 次模拟，两个策略：
- **greedyBest**（会思考的玩家：优先凑齐/推进托盘三元组）——验证**逻辑可解性**，必须 100%。
- **random**（随手点的玩家）——估计「粗心」难度下限（注：真实游戏靠物理遮挡制造难度，比 random 更难，故 random 100% 仅说明机制宽容、失败来自遮挡+时间）。

**结论（驱动了 LEVEL_CURVE 重写）：**
- greedy 全 15 关 **100% 通关** → 每关都逻辑可解、无死局。
- 旧曲线 `timeMs` 随关卡**收紧到 50s** 但物品数涨到 180 → 数学上不可赢。新曲线让时间**随物品数增长**：推荐 `= 贪心步数(=物品总数) × 1.5s + 12s 缓冲`，取整到 5s → L1≈40s，L15≈230s。
- 难度只通过**种类(3→12) + 份数(2→4)** 上升，绝不靠不公平计时。

| 关 | 种类 | 份数 | 物品数 | 贪心通关 | 随手通关 | 推荐时间 |
|----|------|------|--------|----------|----------|----------|
| 1 | 3 | 2 | 18 | 100% | 100% | 40s |
| 5 | 5 | 3 | 45 | 100% | 100% | 80s |
| 9 | 7 | 4 | 84 | 100% | 100% | 140s |
| 12 | 10 | 4 | 120 | 100% | 100% | 190s |
| 15 | 12 | 4 | 144 | 100% | 100% | 230s |

> ⚠️ 模拟为「任意可取」抽象模型（不含物理遮挡）。真实难度来自遮挡（埋住的物品点不到）+ 计时；调优后的时间预算已为专注玩家留足余量。首次 playtest 后可用 `scripts/tune.mjs` 复算。

---

## 7. 新手引导（Onboarding Checklist）

- [x] 核心动词（点物品抽出来、凑 3 个消）在进入 3 秒内可见（大厅「准备抓鹅？」→ 开始）
- [x] 第 1 关保证成功：3 种物品、每种 6 个（2×3）、120s，必过
- [x] 每个新机制（倒计时、连击、托盘）在低压力关卡引入
- [x] 首关结束触发「抓大鹅」演出作为 hook
- [x] 大厅 → 免费试玩 → 开始 的入口链路完整（DOM 覆盖层 start/next/retry，复用 GameBridge）

---

## 8. 平台集成方式（Three.js 版，照搬统一游戏框架）

> ⚠️ 与 v1.0(A 类 Phaser) 不同：B 类用 **Three.js + cannon-es**，不走 `BaseScene`/`PhaserGameComponent`，而是复用框架的 **`GameBridge`**（引擎无关）自写 `ThreeGameComponent` + `ZhuaDaScene`。

新建 `apps/zhuada-e/`，文件结构：

```
apps/zhuada-e/
├── index.html              # <div id="app"> + main.tsx
├── neo-manifest.json       # id: miniapp-zhuada-e, urls.entry: /miniapps/zhuada-e/index.html
├── package.json            # deps: three, cannon-es, @types/three；dev/build = vite
├── vite.config.ts          # createReactAppConfig(__dirname)（@shared/@framework 别名 + manifest 拷贝）
├── public/
│   ├── logo.png / banner.png   # 自绘占位（已生成）
│   └── art/                # 预留美术资源目录
└── src/
    ├── main.tsx            # defineMiniApp({ items, tray, powerups, shuffleNonce, hintNonce observables; actions: startLevel/extract/nextLevel/retry/enter + 道具 shuffle/hint/addTime })
    ├── manifest.ts         # MiniAppManifest（详情页 tabs，含物理抽物文案）
    ├── ThreeGameComponent.tsx  # ★ 宿主 Three.js WebGLRenderer，复用 GameBridge（window.__phaserBridge），移动端尺寸 + 清理
    ├── PlayArea.tsx        # ★ React 布局：HUD(关卡/分数/时间/连击) + 道具栏 + canvas 包裹 + 开始/下一关/重来 覆盖层；**场景按需动态 import**（代码分割）
    ├── PlayArea.scss       # @use @shared/styles/v2/tokens + mx2 mx2-cat-game；含道具栏样式
    ├── scenes/ZhuaDaScene.ts   # ★ 主场景：Three.js 渲染 + cannon-es 物理 + 射线拾取 + 托盘 HUD + 胜负演出 + 道具 nonce 响应(洗牌重落/提示高亮)
    ├── scenes/models.ts        # ★ 原创低多边形模型库（12 种果蔬/小鱼 + 大鹅），buildModelMesh/buildGoose
    └── logic/
        ├── engine-zhuada.ts     # 纯函数：ITEM_DEFS(model/geometry/color)、TRAY_SLOTS、generateItems、applyExtract、isTrayFull、isTrayStuck、remainingInBox
        ├── game-rules.ts        # TOTAL_LEVELS=15、LEVEL_CURVE(调优后)、specOf、计分常数、seedFor
        └── guest-engine.ts      # 纯本地模式（observables: items/tray/score/combo/timeLeft/level/isPlaying/clearedFx/powerups/shuffleNonce/hintNonce；extract/enter/startLevel/nextLevel/retry + 道具 shuffle/hint/addTime）
scripts/tune.mjs                 # 蒙特卡洛平衡模拟（纯逻辑，复刻 engine 规则，输出可解率/失败率/推荐时间）
```

**关键约定（来自架构分析，必须守）：**
1. `slug=zhuada-e`，`manifest id=miniapp-zhuada-e`，`urls.entry=/miniapps/zhuada-e/index.html` —— 三处同步
2. `GameBridge` 引擎无关：通过 `window.__phaserBridge` 注入，`on("state")` / `getState()` / `dispatch(action, ...args)` / `setDispatch(fn)` / `notifyReady()` 全部复用
3. 设计令牌用 `--mx2-*`，根容器 `class="… mx2 mx2-cat-game"`
4. `t("...")` 必须同步补到 `messages.ts`（否则 i18n-key-parity 测试失败）
5. 物理步用 `world.step(1/60)`（**不要用 `world.fixedStep`**）—— 见 §10
6. 拾取前显式刷新世界矩阵 —— 见 §10

---

## 9. 系统交互矩阵

| 系统 A \ B | 关卡生成 | 物理掉落 | 射线拾取 | 托盘消除 | 计时器 | 计分 | 胜负演出 | 进度存档 |
|-----------|---------|---------|---------|---------|--------|------|---------|----------|
| 关卡生成 | — | 提供列表 | 独立 | 独立 | 设时长 | 独立 | 独立 | 读当前关 |
| 物理掉落 | 接受 | — | 提供 mesh/body | 独立 | 独立 | 独立 | 独立 | 独立 |
| 射线拾取 | 独立 | 读 mesh | — | 触发(dispatch) | 独立 | 独立 | 独立 | 独立 |
| 托盘消除 | 独立 | 独立 | 接受 | — | 读剩余 | 写分 | 触发(清空) | 独立 |
| 计时器 | 设时长 | 独立 | 独立 | 读 | — | 独立 | 触发(超时) | 独立 |
| 计分 | 独立 | 独立 | 独立 | 写 | 独立 | — | 读(奖励) | 独立 |
| 胜负演出 | 独立 | 独立 | 独立 | 触发 | 触发 | 读 | — | 写(过关/失败) |
| 进度存档 | 读 | 独立 | 独立 | 独立 | 独立 | 独立 | 写 | — |

全部为「接受/依赖/独立/触发」——无冲突项，无隐藏 bug 风险。

---

## 10. 验证与已知问题（Verification & Known Issues）

### 端到端验证结论（v2.1，2026-07-09，浏览器 agent-browser 驱动）
- ✅ **完整胜利链路**：`bridge.dispatch("extract")` 驱动 → 状态 `solved`，`score: 237`，`itemsLeft: 0`，托盘清空（18 物品 → 6 组消除）
- ✅ **关卡递进**：点「下一关」→ `level: 2`，`status: dealt`，物品重生
- ✅ **真实射线拾取链路（canvas 点击 → 抽出）**（v2.0 已证）：强制生成 + 物理步进后 `pointerdown` 投影点击 → `items` 18→8，托盘三元组正确消除
- ✅ **道具全链路验证**（v2.1 新增）：开局 `powerups={shuffle:1,hint:3,addTime:1}`；
  - 提示 → `hint` 3→2、`hintNonce 1`（场景脉冲高亮）
  - 加时 → `addTime` 1→0、`timeLeftMs` +15000（35897→50797）
  - 洗牌 → `shuffle` 1→0、`shuffleNonce 1`、物品数不变但 `kind` 已重排（场景重落）
  - 里程碑回赠：得分破 100 时 `hint` 回赠 +1（验证到 3）
- ✅ **代码分割验证**（v2.1 新增）：入口 `index` chunk **213KB / gzip 67KB**（原 786KB/gzip 215KB）；Three.js+cannon-es 拆为独立 `ZhuaDaScene` 异步 chunk（599KB/gzip 155KB），仅在开局 `dealt` 时动态加载。大厅/HUD 即时渲染。
- ✅ **ESLint 0 error / 0 warning**；**生产构建通过**（chunk 体积警告为信息性，因 three 体积大但已懒加载）
- ✅ **Staging 通过**：`npm run stage:miniapps:dist -- zhuada-e` → `platform/host-app/public/miniapps/zhuada-e/`（含懒加载场景块；catalog 已含 zhuada-e）

### 已修复的关键实现坑（务必保留）
1. **`world.fixedStep` 不推进刚体（致命）**：cannon-es 0.20.0 下 `world.fixedStep(1/60, dt)` 不会移动刚体 → 物品悬在盒口、射线瞄错坐标。改为 `world.step(1/60)` 后正常掉落（验证：`y0:9.28 → y1:0.77`）。
2. **生成节奏卡死**：`dt` 被钳制到 `1/30` 但生成间隔 `0.04`，rAF 节流下 `spawnTimer` 永远不到阈值 → 盒子永远空。改用未钳制 `rawDt` 累加 + 间隔降到 `0.035`。
3. **拾取前矩阵过期**：headless / 首帧前 `camera.matrixWorld`  stale → 射线瞄偏。在 `onPointerDown` 内先 `updateMatrixWorld()` 再射线。
4. **关卡时间曲线数学死局（v2.1）**：旧 `timeMs` 随关卡收紧到 50s 但物品数涨到 180 → 不可能赢。蒙特卡洛调优后改为时间随物品数增长（40s→230s），贪心策略全 15 关 100% 可解。

### 已知限制 / 后续
- headless 环境（agent-browser）会暂停 `requestAnimationFrame`，导致渲染循环（生成 mesh、mesh↔body 同步）不自动跑；真实射线拾取链路已在 v2.0 用调试钩子验证，调试钩子已移除。3D 物理掉落需在真实浏览器（rAF 正常）中肉眼复检。
- 美术为原创低多边形组合造型（非原版拟物风）；如需更精致可替换 `ITEM_DEFS` 的 `model` 资产或采购 CC 授权素材。
- 调优模拟为「任意可取」抽象模型，未含物理遮挡；真实难度来自遮挡+计时，首次 playtest 后可用 `scripts/tune.mjs` 复算并微调。

---

## 10.5 音频与移动端（Audio & Mobile, v2.2）

### 音频系统（Sound）
- **引擎**：`apps/zhuada-e/src/logic/sound.ts` —— 一个**单例 WebAudio 合成音效引擎**，9 种音效全部由振荡器 + 滤波白噪声实时合成，**零音频文件、零版权风险**。
- **音效表**：

| 音效 | 触发点 | 设计意图 |
|------|--------|----------|
| `land` | 物品落入盒中（`cannon-es` 碰撞回调，按撞击速度缩放响度，<45ms 节流防级联炸响） | 物理落地的「咚」感，强化重量 |
| `pick` | 玩家点中并抽出物品 | 轻快「啵」声，确认操作成功 |
| `match` | 托盘凑齐 3 个同类（连击数 ≤1） | 明亮 C 大三和弦琶音，正反馈 |
| `combo` | 连击窗口内再次消除（连击数 >1） | 上行 sparkle，奖励快速连续消除 |
| `win` | 盒清空、抓到大鹅 | 上行五音胜利号角 |
| `fail` | 托盘塞满 / 超时 | 下行锯齿波，明示失败 |
| `powerup` | 提示/加时使用 | 三连上行叮咚 |
| `shuffle` | 洗牌重落 | 五连方波扫频 |
| `click` | 通用 UI 点击（开始/下一关/重来/道具等） | 短促方波 tick |

- **静音与生命周期**：
  - `AudioContext` **懒创建**（首次 `unlock()`/`play()` 才 new），初始 `suspended`。
  - `unlock()` 在用户手势内调用（`PlayArea.runGameAction` 每次点击 + `ZhuaDaScene.onPointerDown` 首次点屏），满足浏览器自动播放策略。
  - `muted` 写入 `localStorage["zhuada-e:sound-muted"]`，主增益 `master.gain` 平滑切换（0↔0.5，时间常数 20ms），HUD 右上角 `📢/🔇` 按钮切换。
  - 三个调用方（React UI / guest engine / Three 场景）共用同一 `sound` 单例，静音态全局一致。
- **验证**：无浏览器音频设备的环境下，用 Node + mock `AudioContext`/`localStorage` 跑了 10 项逻辑单测（懒创建、静音门控、持久化、unlock-resume、各音效均不抛错、land 节流生效），全部通过。

### 移动端触屏适配（Touch）
- **拾取事件**：`ZhuaDaScene` 监听 `pointerdown`（覆盖鼠标 / 触屏 / 笔三类输入），射线路由与桌面一致；移除 `pointerdown` 监听在 `unmount` 时执行，无泄漏。
- **CSS 手势收敛**（`.goose-canvas-wrap` / `.goose-three-canvas`）：
  - `touch-action: none` —— 关键：让 canvas 独占所有触摸手势，避免触屏「点击落点」被浏览器当成页面滚动/缩放而吞掉或延迟 300ms。
  - `-webkit-tap-highlight-color: transparent` + `user-select: none` —— 去掉蓝色点击高亮与误选。
  - `overscroll-behavior: contain` —— 防止 canvas 内下拉触发页面级 pull-to-refresh。
- **命中精度**：射线归一化用 `getBoundingClientRect()`（与 DPR / CSS 尺寸无关），触屏坐标 `clientX/clientY` 直接可用，无需额外换算。
- **已知限制**：真机触屏命中手感（尤其小目标被遮挡时）需真机 playtest 复检；逻辑层已保证事件链路正确。

---

## 11. 待办（实现计划 · 已完成项打勾）

- [x] 1. 建 `apps/zhuada-e/` 骨架（manifest/package/vite/index.html）
- [x] 2. 写 `logic/engine-zhuada.ts`（纯函数，可单测）
- [x] 3. 写 `logic/game-rules.ts`（15 关曲线 + 计分常数）
- [x] 4. 写 `logic/guest-engine.ts`（本地模式 observables）
- [x] 5. 写 `main.tsx` + `manifest.ts` + `messages.ts`
- [x] 6. 写 `ThreeGameComponent.tsx` + `PlayArea.tsx` + `PlayArea.scss`（HUD、开始/下一关/重来覆盖层）
- [x] 7. 写 `scenes/ZhuaDaScene.ts`（Three.js 渲染 + cannon-es 物理 + 射线拾取 + 托盘 HUD + 胜负演出）
- [x] 8. `npm run dev` 自测核心循环 → 修复 world.step / 生成节奏 / 矩阵过期 三坑
- [x] 9. 端到端验证（胜利 / 递进 / 真实射线抽取 / 失败）
- [x] 10. `npm run build` + `stage:miniapps:dist` + 宿主验证
- [x] 11. 补全占位 logo/banner（自绘 PNG，已随 staging 拷贝）
- [x] 12. 美术升级：`scenes/models.ts` 原创低多边形模型库（12 果蔬/小鱼 + 大鹅），替换 bare primitive + emoji
- [x] 13. 道具系统：洗牌/提示/加时（限量供应 + 里程碑回赠），引擎 powerups/shuffleNonce/hintNonce + 场景 nonce 响应 + HUD 道具栏
- [x] 14. 代码分割：PlayArea 按需动态 import 场景，入口 chunk 213KB/gzip 67KB，three+cannon 拆为懒加载块
- [x] 15. 数值调优：`scripts/tune.mjs` 蒙特卡洛模拟 → 重写 15 关曲线（时间随物品数增长），贪心 100% 可解
- [x] 16. 音频系统：`logic/sound.ts` 纯合成 WebAudio 音效引擎（9 种音效，零文件零版权）+ 单例共享静音 + 首次手势解锁 + localStorage 持久化；引擎/场景/HUD 三处接入
- [x] 17. 移动端触屏适配：`pointerdown` 拾取 + `touch-action:none`/禁选/禁高亮/overscroll 收敛，避免落点被滚动吞掉

> 数值全部以 `[PLACEHOLDER]` 标注处需首测后用 paper simulation + 手感测试调（重力、连击窗口、托盘槽数、关卡时间曲线，后者已用 `scripts/tune.mjs` 初调）。
> **后续真人 playtest 项**（需真机/真人，非 headless 可证）：① 关卡「好不好玩」手感校准（蒙特卡洛只保证可解，不保证好玩）；② 真机触屏命中手感与遮挡场景。
