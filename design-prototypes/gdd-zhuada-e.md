# 抓大鹅 (Catch the Goose) — 小游戏 GDD v3.1 (B 类 · 物理抽物版)

> 平台：neo-miniapps-platform · 类型：**B 类「物理抽物 / 托盘 3 连消除」版**（Three.js + cannon-es 真 3D 物理）
> 模式：免费本地模式（guest engine，不接链上合约，复用统一游戏框架 GameBridge）
> 文档状态：v3.1 — **与实现逐条对齐**（S1–S6 重建后全量复核：本文档中每一条可对照代码检验的声明都以 `文件:符号` 落地；§12 的 G1/G2/G3 已于 S6 实装）
> 作者：GameDesigner
> 变更记录：
> - v1.0 (2026-07-09)：A 类 Phaser 网格找物版设计稿。
> - v2.0 (2026-07-09)：改为 B 类物理抽物版；GDD 与 `apps/zhuada-e` 代码对齐。
> - v2.1 (2026-07-09)：原创低多边形模型库；道具系统（洗牌/提示/加时）；代码分割；蒙特卡洛数值调优。
> - v2.2 (2026-07-09)：合成 WebAudio 音效引擎；移动端触屏适配。
> - v2.3 (2026-07-10)：URL 实时调参 + `?debug=1` playtest 面板。
> - **v3.0 (2026-07-10)：S1–S5 重建 + 文档真实性总校对。**
>   - **S1（可玩性修复）**：修复致命拾取断链（`scenes/pick.ts` 递归射线 + 命中子 Mesh 回溯所属 Group，附 `pick-raycast.test.ts` 6 项回归）；新增 `tsconfig.json` 且 `build = tsc --noEmit && vite build`（类型门禁）；修复 Retina/DPR≥2 画布双倍尺寸裁切；物理步改为 `world.step(1/60, min(rawDt,0.1), 3)`（帧率无关）；修复 `?gravity` 负值被拒（现合法区间 [-60,-4]）；WebGL 不可用时优雅降级为错误 UI（不再崩到错误边界）；`disposeObject` 递归遍历释放 GPU 资源；`resize()` 接入 ResizeObserver。
>   - **S2（反馈与可读性）**：败因可读（超时/卡死分文案 + 手绘闹钟/挂锁盖章）；`visibilitychange` 计时暂停（切后台不再烧钟）；倒计时末 10s HUD 危险态 + 末 5s 合成滴答音；三消 pop 演出（`clearedFx` 脉冲）；触觉反馈 `logic/haptics.ts`（可关）；托盘 emoji 换原创 SVG `KindChip`；`sound.test.ts`（10 项）入库。
>   - **S4（元进度）**：6 主题场景（换肤 + 专属物品组合）；关卡选择地图；限定大鹅收藏册（`GooseChip` + `progress.ts` v2 存档，`progress.test.ts` 14 项）；本地战绩统计；guest 离线排行榜；L15 全清结算屏。
>   - **S5（平衡与文档）**：重写 `scripts/tune.mjs`（从 TS 源码提取曲线防漂移、修复随机策略 undefined 自消 bug、遮挡感知拾取池、无计时模拟、洗牌/移出/撤回策略选项、6 道自校验门）；道具里程碑改为**按关卡分数上限派生**（30%/60% + 4 连击回赠提示，`game-rules.milestonesFor` + `game-rules.test.ts` 5 项）；本文档 v3.0 真实性重写。
>   - v3.0 时点明确未实装：G1 无计时默认模式、G2 移出/撤回三件套、G3 摇一摇（当时仍是「倒计时 + 洗牌/提示/加时」规则集）。
> - **v3.1 (2026-07-10)：S6 parity 三缺口落地（G1/G2/G3 全部实装，规格见 §12）。**
>   - **G1 无计时默认**：默认不起表，卡死为唯一败因；「限时挑战」为可选开关（大厅切换、localStorage 持久化、仅限局间切换）；HUD 无计时态显示 ∞；`addTime` 道具与时间奖励仅存在于限时模式（`guest-engine` timedMode 分支 + `PlayArea` goose-timed-toggle）。
>   - **G2 原版三件套**：**移出**（托盘前 3 件 → 场边 3 格暂存位，暂存仍参与三消且**优先清暂存**，`engine-zhuada.applyRemoveToShelf/applyExtractShelf` + 纯函数测试）；**撤回**（上一次未成消抽取回堆顶重落，消除/洗牌/移出后失效，场景按「前快照缺席」识别回堆物品重生成）；托盘满且无解时若手中还有移出/撤回则进入**濒死自救态**（statusTrayRescue 文案）而非立即判负——救援耗尽才 `failLevel("trayFull")`。
>   - **G3 晃一晃**：CD 制（10s，非消耗品）按钮对全堆刚体施加封顶随机冲量 + 唤醒休眠体（围栏物理墙为无限平面，物件不可能被晃出栏外）+ 340ms 阻尼镜头微震（`prefers-reduced-motion` 下仅保留物理）+ 合成 `shake` 音效（第 12 个 cue）。
>   - 附带修复：HUD 行在 ≤390px 视口溢出（flex-wrap）；晃一晃 CD 倒计时首帧陈旧锚点；场景「新增物品」识别在抽取在途窗口误杀重生成（前快照集合判定，见 §9 坑 11）。

---

## 0. 重要声明：关于「原本的资源」

**结论：没有可合法直接复刻的正版素材，本作不使用任何正版素材。**

微信小游戏「抓大鹅」（青岛蓝飞互娱, 2024）是闭源商业产品，官方美术/音效资源没有开源，抓包提取属于侵权。本作只复刻**玩法机制**（不受版权保护），所有表现层资产全部原创：

- **3D 模型**：`src/scenes/models.ts` 用 Three.js 基础几何体组合出 12 种原创低多边形果蔬/小鱼 + 大鹅（含 5 种收藏配饰变体：草帽/贝雷帽/鸭舌帽/毛线帽/派对帽 + 围巾，`buildGoose(variant)`）。无纹理、无 GLTF、无外部资产加载。
- **2D 图形**：托盘/收藏 UI 里的物品与大鹅图形是原创 SVG（`KindChip.tsx` / `GooseChip.tsx`），**渲染 UI 中不再出现 emoji**；胜负盖章（闹钟/挂锁）是运行时 canvas 手绘矢量（`ZhuaDaScene.ts` `drawClockGlyph`/`drawLockGlyph`）。
- **音频**：`src/logic/sound.ts` 全部音效由 WebAudio 振荡器 + 滤波白噪声**实时合成**（12 种 cue，0 音频文件），静音态持久化 localStorage，首次用户手势解锁 AudioContext。
- **代码**：不从无 LICENSE 的社区仓库搬运，玩法逻辑在本仓库风格内从第一性原理实现。

---

## 1. 玩法定义（Fun Hypothesis）

**核心乐趣假设：** 一堆杂物在物理鹅栏里堆叠、互相遮挡，玩家靠「观察 + 规划托盘空间」把相同物品逐个**抽出来**摆进 7 格托盘，凑齐 3 个就咔嚓消除；把鹅栏清空就抓住捣乱的大鹅。张力全部来自「托盘快满了但差一个凑不齐」（卡死败，唯一默认败因）——可选的「限时挑战」模式额外叠加倒计时压迫（超时败）。

**一句话循环：** 看 → 点一个露出的物品抽出来 → 摆进托盘 → 凑 3 个消除 → 鹅栏更空、更深层露出来 → 清空 → 抓大鹅过关。

> 注：原版《抓大鹅》**无硬倒计时**，压力全部来自卡槽逼近满。本作自 v3.1（S6）起对齐：**默认无计时**，卡死是唯一败因；倒计时保留为可选「限时挑战」模式（时间预算按公平公式随物品数增长，见 §6.1）。

---

## 2. 设计支柱（Design Pillars）

1. **一眼就懂**：进场 3 秒内知道「点物品 → 抽到托盘 → 凑 3 个消」（大厅场景地图一键开局，无阻塞教程）。
2. **眼疾手快 + 空间规划**：核心张力来自遮挡下的观察力与 7 格托盘管理，而非数值养成。
3. **关关有目标**：HUD 实时显示关卡/分数/时间/连击 + 托盘占用；清空即抓鹅。
4. **失败可读**：两种败因分开呈现——超时 = 「时间到了」+ 手绘闹钟盖章；卡死 = 「托盘塞满卡死」+ 手绘挂锁盖章（`guest-engine.failLevel(reason)` → `messages.statusFailedTimeout/statusFailedTrayFull` + `ZhuaDaScene.playFail` 按 `failReason` 选盖章）。
5. **零挫败上手**：第 1 关数学上不可能卡死（鸽笼原理，见 §7），时间预算宽裕；难度从 L2 起明显跳档（G5 曲线形状）。

---

## 3. 核心循环（Core Loop）

### Moment-to-Moment (0–30 秒)
- **Action**: 在堆叠的鹅栏里点选一个（露出的）物品
- **Feedback**: 命中物品 press 放大 90ms + `pick` 音效 + 轻触振动 → 220ms 飞入托盘槽位
- **Reward**: 托盘凑齐 3 个同类 → pop 消除演出 + `match`/`combo` 音效 + 振动 + 计分（连击加成）

### Session Loop (1–3 分钟 / 一关)
- **Goal**: 把鹅栏抽空（三元组即时消除，托盘 + 暂存位跨区计数）
- **Tension**: 托盘仅 7 槽，凑不齐会塞满 → 濒死自救（移出/撤回）→ 救援耗尽即卡死失败；（限时挑战模式额外：倒计时末 10 秒 HUD 变红脉冲、末 5 秒滴答音）
- **Resolution**: 清空 → 大鹅跳出被抓（限时模式加时间奖励结算）；卡死/超时 → 分因失败演出 + 重来

### Long-Term Loop (15 关 · 6 主题场景 · 限定大鹅收藏)
- **Progression (G4/G5)**: 6 场景 × 2-3 关（菜园[1-2]/果园[3-5]/池塘[6-8]/农场[9-11]/雪原[12-13]/夜市[14-15]，`logic/scenes.ts`）。每场景有专属围栏配色（背景/地板/围墙/围栏亮边/环境反光，`ZhuaDaScene.applyTheme` 原地重着色）+ 专属物品组合（`kindPool` 有序切片进 `generateItems`：池塘以小鱼/鸡蛋领衔、农场以鸡蛋/玉米领衔…）。难度形状：L1 教学保底 → L2 跳档（3→5 种类、18→45 件）→ 场景内递进至 12 种类/144 件（§6.1 门 C/D/E 验证）。
- **Collection Hook (G4)**: 通关场景末关解锁该场景**限定大鹅**（3D `models.buildGoose(variant)` 与 2D `GooseChip` 共用一套 `GooseVariant` 配饰规格）。解锁时刻：胜利覆盖层展示 + 专属 `unlock` 合成音效 + 状态条祝贺；收藏册（大厅可切换）已解锁显示配饰、未解锁显示灰色剪影 + 「通关第 N 关解锁」提示。
- **Retention Hook**: 进度存 localStorage `zhuada-e:progress` **v2 schema** `{v:2, level, wins, best:{[level]:score}, geese:[sceneId]}`（v1 `{level}` 自动迁移，`logic/progress.ts` 纯函数 + 14 项 vitest）；关卡选择地图（每关最佳分数徽标 + 锁定态）；侧栏/统计卡绑定本地派生 observables（最佳分数/累计胜场/已通关数/收藏大鹅，`main.tsx` statWins/statBest/statCleared/statGeese，并镜像进 `obs.mySolves/myTotalWon` 防止共享面板读到死零）；通关 L15 = 全清结算屏（总战绩 + 6 鹅收藏回顾），非 toast。
- **Leaderboard (G6)**: 胜利分数 best-effort 提交 `app.mode.guestLeaderboard`（离线 guest 榜，失败静默、**永不阻塞本地闭环**），抽屉里显示排名。

---

## 4. 关卡与物品模型

### 物品层（12 种基础物品，原创低多边形模型 `scenes/models.ts` + 原创 SVG `KindChip`）
| id | 名称 | 2D(KindChip) | 模型(model) | 物理体(geometry) | 颜色基调 |
|----|------|--------------|-------------|------------------|----------|
| 0 | 番茄 | SVG | tomato | sphere | 红 |
| 1 | 胡萝卜 | SVG | carrot | cone | 橙 |
| 2 | 玉米 | SVG | corn | cylinder | 黄 |
| 3 | 茄子 | SVG | eggplant | icosa | 紫 |
| 4 | 苹果 | SVG | apple | sphere | 绿 |
| 5 | 西兰花 | SVG | broccoli | icosa | 深绿 |
| 6 | 蘑菇 | SVG | mushroom | cylinder | 红白 |
| 7 | 洋葱 | SVG | onion | sphere | 浅紫 |
| 8 | 辣椒 | SVG | pepper | cone | 红 |
| 9 | 西瓜 | SVG | melon | sphere | 青绿 |
| 10 | 鸡蛋 | SVG | egg | cylinder | 奶黄 |
| 11 | 小鱼干 | SVG | fish | box | 蓝 |

> 视觉 `model`（低多边形 Group 组合造型）与物理 `geometry`（简单碰撞体）解耦。**拾取注意**：组合模型的根是 `THREE.Group`（无 raycast 实现），拾取必须递归相交 + 子 Mesh 回溯根（`scenes/pick.ts`，v2.1 曾因此断链，S1 修复 + 回归测试钉死）。

### 场景层（6 主题场景，`logic/scenes.ts`）
| 场景 | 关卡 | 围栏基调 | 物品组合领衔 | 限定大鹅 |
|------|------|----------|--------------|----------|
| 菜园 | 1-2 | 嫩绿 | 番茄/胡萝卜/西兰花 | 草帽鹅（菜园鹅） |
| 果园 | 3-5 | 暖橙 | 苹果/西瓜/番茄 | 贝雷帽鹅（果园鹅） |
| 池塘 | 6-8 | 水蓝 | 小鱼/鸡蛋/西瓜 | 鸭舌帽鹅（池塘鹅） |
| 农场 | 9-11 | 土棕 | 鸡蛋/玉米/蘑菇 | 草帽红巾鹅（农场鹅） |
| 雪原 | 12-13 | 冰蓝 | 鸡蛋/蘑菇/小鱼 | 毛线帽鹅（雪原鹅） |
| 夜市 | 14-15 | 暗夜金 | 辣椒/小鱼/鸡蛋 | 派对帽鹅（夜市鹅） |

### 关卡生成规则（确定性，guest 用种子 RNG）
- 每关给定 `kinds`（种类数）与 `perKind`（每种份数），**每种物品数量 = `perKind × 3`** → 永远可被 3 整除 → **逻辑上永远可清空、无死局**（tune.mjs 门 A 每次运行验证）。
- 种类 id 从场景 `kindPool` 前 `kinds` 个抽取（`game-rules.specOf`）→ 场景味道。
- 生成：打散后从鹅栏上方逐批掉落（间隔 0.035s，未钳制 rawDt 累加防 rAF 节流卡死）。
- （限时挑战模式）倒计时**随物品数同步增长**（公式 `物品数 × 1.5s + 12s`，向上取整 5s；40s → 230s），绝不随关卡收紧；默认无计时模式不使用该表。
- ⚠️ **实现事实**：`LEVEL_CURVE.boxSize`（9→12）只是逻辑生成数据；3D 鹅栏是固定尺寸（半宽 3.0 / 壁高 4.2，`ZhuaDaScene` `BOX_HALF/BOX_HEIGHT`），引擎生成的 px/py/pz 也被场景内自己的随机落点取代。后期难度实际由**种类数 + 物品数带来的堆叠深度/遮挡**驱动，与盒尺寸无关。若要恢复「盒随关变大」需把 `buildBox` 接到 `specOf(level).boxSize`（当前未做，如实记录）。

```
Variable            | Base      | Min  | Max  | Tuning Notes
--------------------|-----------|------|------|-------------------
Tray slots          | 7         | 5    | 9    | 经典 7 槽（engine-zhuada.TRAY_SLOTS）
Kinds (k)           | 3 → 12    | 3    | 12   | 教学关 3，后期 12（LEVEL_CURVE）
Per kind copies     | 2 → 4     | 2    | 4    | 每种 = perKind×3（LEVEL_CURVE）
Level time (s)      | 40 → 230  | 40   | 230  | = 物品数×1.5s+12s 取整 5s（tune.mjs 门 F 复核）
Gravity             | -18       | -60  | -4   | [PLACEHOLDER] 手感；?gravity=-16 实时覆盖（S1 修复负值区间）
Combo window (ms)   | 2200      | 100  | 60000| [PLACEHOLDER] 连击计时（?combo= 覆盖）
Combo bonus / step  | 8         | 1    | 1000 | [PLACEHOLDER] 连击加成（?bonus= 覆盖）
```

---

## 5. 机制规格（Mechanic Specs · 9 字段）

### Mechanic: 物理掉落 (Physics Drop)
- **Purpose**: 营造「真实堆叠、晃动、有纵深遮挡」的抽取手感
- **Player Fantasy**: 「满满一栏杂物，摇摇欲坠，宝贝埋在底下」
- **Input**: 关卡开始（`dealt`）→ 物品从鹅栏上方逐批掉落
- **Output**: cannon-es 刚体在开放鹅栏内堆叠、碰撞、静止（allowSleep）；落地按撞击速度播 `land` 音效（45ms 节流防级联炸响）
- **Success**: 物品稳定堆在栏内、可被射线拾取；上层压下层形成「挖」的目标感
- **Failure**: 物品穿模/飞出 → 4 面静态墙 + 地面约束（已实现）
- **Edge Cases**:
  - 生成节奏用**未钳制 rawDt** 累加 + while 补帧，rAF 节流下不卡死
  - **物理步必须 `world.step(1/60, min(rawDt, 0.1), 3)`**（固定步长 + 真实 dt + 最多 3 子步）：帧率无关——120Hz 不双速、30fps 不慢动作；dt 钳到 0.1s 防切后台回来爆炸（S1 修复，此前单参调用随刷新率变速）
- **Tuning Levers**: 重力（`tuneGravity()`，URL 可调）、掉落初速/旋转、生成间隔 0.035s、刚体阻尼
- **Dependencies**: 关卡生成（物品列表）、射线拾取、音效

### Mechanic: 射线拾取抽取 (Raycast Extract)
- **Purpose**: 核心交互动作——从堆里「挖」出目标
- **Player Fantasy**: 「我看准了，就抓它！」——手眼合一的抓取感
- **Input**: 玩家在 canvas 上 `pointerdown`（鼠标/触屏/笔统一）
- **Output**: 屏幕坐标 → NDC → `Raycaster` **递归**命中最近子 Mesh → 回溯到所属物品 Group（`pick.ts:pickItemAt/resolveItemRoot`）→ `bridge.dispatch("extract", { itemId })`
- **Success**: 命中露出物品 → 引擎按 itemId **权威查询 kind**（不信任客户端传参，防洗牌竞态污染三消不变量）→ 物品飞入托盘
- **Failure**: 命中空白/非 `dealt` 状态 → 无操作不惩罚；**被完全遮挡的物品不可点**（three.js 最近命中优先，前面的物品必然先接住射线）
- **Edge Cases**:
  - 拾取前显式 `camera.updateMatrixWorld()` + `scene.updateMatrixWorld(true)`（防首帧矩阵过期）
  - 抽取动画中（`extracting`）的物品不计入拾取集合
  - 组合模型 Group 无 raycast：必须 `intersectObjects(roots, true)` + 命中回溯（v2.1 回归事故根因，`pick-raycast.test.ts` 6 项钉死；v2.0 时代「射线已验证」的旧结论在 v2.1 换组合模型后失效过——现结论基于 S1 修复后的真机 probe：648 次点击将 18 件抽到剩 1 件）
- **Tuning Levers**: press 放大 1.18×/90ms、飞行 220ms easeOutCubic
- **Dependencies**: 物理掉落、托盘、引擎状态机、pick.ts

### Mechanic: 托盘 3 连消除 (Tray Triple Match)
- **Purpose**: 核心消除判定与空间管理压力源
- **Player Fantasy**: 「再来一个就凑齐了！」——集齐即清空的收纳快感
- **Input**: 抽出一个物品 → 放入首个空槽（`engine-zhuada.applyExtract`）
- **Output**: 同 kind 达到 3 个 → 精确清除这 3 格并返回 `cleared` 下标 → `clearedFx` 脉冲驱动 3D pop 演出 + DOM 槽位动画；否则保留（2-of-a-kind 悬置态就是张力本体）
- **Success**: 三元组消除 + `match`/`combo` 音效 + `match` 振动 + 计分
- **Failure**: 托盘塞满且无任何 kind ≥3 → `isTrayStuck` 卡死（见 Tray Jam）
- **Edge Cases**: 抽取顺序导致临时占用高——先抽哪种是核心策略；`clearedFx` 是 200ms 瞬态脉冲（`main.tsx` 定时清空），场景按「下标集合相等」去重防重复触发
- **Tuning Levers**: 槽位数 7、pop 演出时长
- **Dependencies**: 射线拾取、计分、状态机、KindChip（DOM 托盘视觉）

### Mechanic: 倒计时 (Timer — 仅限时挑战模式，G1 后为可选)
- **Purpose**: 可选的会话层压迫感（默认模式**无计时**，见 §12 G1；此机制仅在「限时挑战」开关开启时存在）
- **Player Fantasy**: 「还剩最后十秒，快快快！」
- **Input**: 大厅「限时挑战」开关开启后，关卡 `dealt` 即起表（100ms tick，墙钟 deadline）；开关仅限局间切换、localStorage 持久化
- **Output**: 剩余时间 → HUD；**末 10 秒 HUD 危险态**（红色 + 脉冲，`PlayArea` timeDanger）；**末 5 秒每秒合成滴答音**（`guest-engine` TICK_URGENCY_MS）；归零 → `failLevel("timeout")`
- **Success**: 时间内清空 → 剩余秒 × 2 计入时间奖励
- **Failure**: 超时 → 「时间到了，大鹅溜走了」+ 闹钟盖章（与卡死明确区分）
- **Edge Cases**: **切后台暂停计时**——`visibilitychange` 监听记录隐藏时刻，恢复时把 deadline 顺延隐藏时长（S2 实装；此前 GDD 声称有、代码没有，v3.0 起为真）；`addTime` 道具直接推 deadline
- **Tuning Levers**: 每关时长（LEVEL_CURVE，公平公式见 §6.1）、加时 15s、紧迫阈值 10s/5s
- **Dependencies**: 关卡生成（时长）、道具（加时）、音效（tick）、HUD

### Mechanic: 抓大鹅过关 (Goose Catch)
- **Purpose**: 正反馈高潮 + 元进度落账时刻
- **Player Fantasy**: 「栏子空了——大鹅无处可藏，抓住！」
- **Input**: 鹅栏清空瞬间（逻辑物品数 = 0，胜利判定**先于**卡死判定）
- **Output**: 状态 → `solved`；原创低多边形大鹅（当前场景限定配饰）跳出 bob 演出 + `win` 音效 + `win` 振动；结算面板（分数/时间奖励）；`progressAfterWin` 落账（解锁下一关/胜场/最佳分/场景鹅）并持久化；分数 best-effort 提交离线榜
- **Success**: 场景末关首次通关额外触发解锁演出（`unlock` 音效 + 覆盖层大鹅卡 + 状态条祝贺）
- **Failure**: 无（清空必触发）
- **Edge Cases**: `prefers-reduced-motion` 下 bob 动画降级为静态展示；L15 通关走全清结算屏（总战绩 + 收藏回顾）而非普通 toast
- **Tuning Levers**: 大鹅演出时长 2.4s、时间奖励系数
- **Dependencies**: 状态机、进度存档、收藏、排行榜、音效/触觉

### Mechanic: 卡死失败 (Tray Jam)
- **Purpose**: 核心失败条件（空间管理失误的明确后果）
- **Player Fantasy**: 「手一滑全塞满了……这局是我自己作死的」——失败可归因
- **Input**: 托盘满（7/7）且无可消除三元组（`isTrayStuck`，胜利判定之后执行）
- **Output**: 若手中还有可用救援（移出且暂存位空 / 撤回且上一抽取可撤）→ **濒死自救态**（`statusTrayRescue` 警示，游戏不结束、无法再抽取，等待救援操作）；救援耗尽 → 状态 `expired`，`failReason="trayFull"` → 「托盘塞满卡死，大鹅溜走了」+ **手绘挂锁盖章**（与超时的闹钟区分）+ `fail` 音效/振动
- **Success**: 玩家能立刻读出「输在托盘、不是时间」→ 下局改变抽取策略；濒死态给道具真正的高光时刻
- **Failure**: 若两种败因混用同一文案/图标即违反支柱 4（v2.3 的缺陷，S2 修复）
- **Edge Cases**: 满盘但存在三元组不算卡死（放入即消除，实际到不了满盘持有三元组的状态）；满盘时 `applyExtractShelf` 拒绝落位（placed=false，不吞物品）；非 `dealt` 态 extract 双重拒绝（场景 + 引擎）
- **Tuning Levers**: 槽位数（核心旋钮）+ 救援授予量（移出/撤回，S6 起「濒死」是可运营状态）
- **Dependencies**: 托盘、状态机、败因通道（failReason observable）

### Mechanic: 道具系统 (Power-ups — 移出/撤回/洗牌 三件套 + 提示 + 加时[限时] + 晃一晃[CD])
- **Purpose**: 卡顿/失误边缘的「翻盘筹码」，限量供应 + 技巧回赠（非货币）；S6 起对齐原版三件套
- **Player Fantasy**: 「先腾出手再收拾它们」「手滑了！收回那一下」「差一点就卡死了——洗一把！」「该抽哪个？给我指条路」
- **Input**: HUD 道具栏点击 → `bridge.dispatch("removeToShelf"|"undo"|"shuffle"|"hint"|"addTime"|"shake")`
- **Output**:
  - **移出**（G2）：托盘前 3 个占用槽 → 场边 3 格暂存位；暂存物件**仍参与三消**且跨区凑齐时**优先清暂存**（`applyExtractShelf` shelf-first）。仅暂存位全空且托盘 ≥3 件时可用。
  - **撤回**（G2）：上一次**未成消**的抽取从托盘移除、回堆顶重落（同 id 同 kind，物理重新掉落）。消除/洗牌/移出会使其失效（每次抽取刷新可撤对象）。
  - **洗牌**：引擎把栏内剩余物品的 kind 重新随机分配（总数仍是每种 ×3 → 仍可解），场景收 `shuffleNonce` 清场重落。tune.mjs 显示它是后期**刚需**：贪心策略在 L11+ 每局平均动用 0.6-0.8 次（见 §6.1 策略表）。
  - **提示**：场景 `computeHintKind`（优先「托盘 2 个且栏内还有」→「托盘 1 个且栏内 ≥2」→ 栏内最多）选中 kind，对**该 kind 的一个露出物品**做 1.6s 绿色 emissive + 缩放脉冲。
  - **加时**（仅限时挑战模式）：deadline +15s；无计时模式不授予、不显示。
  - **晃一晃**（G3，CD 制非消耗品）：见独立规格 §12。
- **Resource model**: 每关开局授予 `remove:1 / undo:1 / shuffle:1 / hint:3 / addTime:1(仅限时)`（每关重置，不跨关囤积）。**里程碑回赠（S5 重推导）**：阈值按**本关基础分上限**（= kinds×perKind×10）派生——分数每破上限的 **30%** 回赠 +1 提示（早到、每关无连击也可达）；每破 **60%** 回赠 +1 加时（仅限时模式发放；中后段、时钟真正吃紧时）；**4 连击回赠 +1 提示**。旧固定阈值 100/200 在 L1（上限 60）数学上不可达，已废除。`game-rules.milestonesFor` + `game-rules.test.ts` 钉死全 15 关可达性。
- **Success**: 道具把玩家从卡死/超时边缘拉回，体验「有惊无险」；托盘满且无解时进入濒死自救态，移出/撤回获得真正的高光时刻；tune.mjs G2 预演：三件套把 L15 聪明玩法胜率 55%→78%。
- **Failure**: 道具用尽仍无法挽回 → 正常失败（不惩罚用错）。
- **Edge Cases**: 非 `dealt` 态点击直接 return 不消耗；次数 0 / 条件不满足（暂存占用、无可撤对象）按钮置灰；空栏洗牌 no-op；跨区计数恒 ≤2/种（第 3 个必消）⇒ 移出永不制造三元组、清空鹅栏必然托盘+暂存全空（`engine-zhuada.test.ts` 全程模拟钉死）；**洗牌隐性成本**——重落级联在 L15 约耗 5s（144 件 × 0.035s），限时模式下 deadline 不补偿，玩家需权衡（如实声明）。
- **Tuning Levers**: 各授予量、暂存容量 3、里程碑比例 30%/60%、连击阈值 4、加时秒数、提示脉冲参数
- **Dependencies**: 引擎 observables（powerups/shelf/undoable/shuffleNonce/hintNonce/shakeNonce/shakeReadyAt）、场景 nonce 响应、HUD 道具栏 + 暂存排、milestonesFor

### Mechanic: 计分与连击 (Scoring & Combo)
- **Purpose**: 给「消除」分层反馈——快速连续消除比稳扎稳打更「爽」，并喂养里程碑回赠
- **Player Fantasy**: 「连消三组！手感来了！」
- **Input**: 每次三消成立（`applyExtractShelf.matched`，含跨区消除）
- **Output**: 基础 +10（`SCORE_PER_MATCH`）；若距**上一次三消**（match-to-match，非任意抽取）≤ 2200ms（`COMBO_WINDOW_MS`），连击数 +1，本组额外 +8×(连击-1)（`COMBO_BONUS_PER_STEP`）；否则连击重置为 1。连击数超时（窗口无新消除）由 `comboTimer` 归零。限时挑战模式过关另加 剩余秒 × 2（`TIME_BONUS_PER_SEC`）；默认无计时模式分数纯为消除+连击（无时间维度）。
- **Success**: HUD 显示 `x{combo}`；`combo` 音效（连击 >1 时替换 `match`）；4 连击触发道具回赠
- **Failure**: 无惩罚——连击断了只是回到基础分
- **Edge Cases**: 连击窗口按**消除到消除**计时（`lastExtractAt` 只在 matched 分支更新）——中间穿插不成消的抽取不断链，这是刻意的宽松语义；单次大额得分可能一次跨过多个里程碑步长，引擎用 `while` 循环逐档补发
- **Tuning Levers**: 窗口 2200ms、加成 8、基础 10、时间奖励 2（全部 URL 实时可调 `?combo/bonus/score/timebonus`，见 §10.6）
- **Dependencies**: 托盘消除、道具里程碑、HUD、音效

### Mechanic: 关卡递进与场景主题 (Level Progression & Scenes)
- **Purpose**: 长线目标结构：G5 难度形状 + G4 场景换肤给「越走越远」的旅程感
- **Player Fantasy**: 「过了菜园是果园，夜市的栏子长什么样？」
- **Input**: 过关 → `progressAfterWin` 解锁下一关；大厅地图任选**已解锁**关卡（`startLevel` 对未解锁上限钳制）
- **Output**: `specOf(level)` = 曲线行 + 场景 kindPool 切片；进入新场景时 `applyTheme` 原地重着色围栏材质（背景/地板/围墙/亮边+自发光/半球光地色）——不重建场景、无加载顿挫
- **Success**: L1 保底（见 §7）→ L2 跳档 → 场景内单调递进（tune.mjs 门 C/D/E 每次运行验证）
- **Failure**: 曲线数据破坏「×3 整除」或时间低于公平线 → tune.mjs 门 A/F 直接红灯（防手滑改坏）
- **Edge Cases**: 击穿 L15 后 `nextLevel` 显示全清而不越界；存档 level 越界被 `parseProgress` 钳回
- **Tuning Levers**: LEVEL_CURVE（kinds/perKind/timeMs）、场景分段、kindPool 排序
- **Dependencies**: 进度存档、场景数据、tune.mjs 回归

### Mechanic: 限定大鹅收藏 (Goose Collection)
- **Purpose**: 元进度钩子——把「过关」升维成「集齐 6 只限定鹅」
- **Player Fantasy**: 「夜市的派对帽鹅还没到手」
- **Input**: 首次通关场景末关（`isSceneFinalLevel` && 未拥有）
- **Output**: `progressAfterWin` 把 sceneId 写入 `geese[]`（**一次性**，重复通关不重复触发）→ `unlockNotice` 瞬态 observable 驱动胜利覆盖层解锁卡 + `unlock` 音效；收藏册网格 6 卡（已解锁 = 彩色 GooseChip，未解锁 = 剪影 + 解锁条件）
- **Success**: 全 6 只集齐后 L15 全清屏做收藏回顾
- **Failure**: 无失败路径；localStorage 不可用时静默降级（进度不持久但本局可玩）
- **Edge Cases**: 存档里非法 sceneId/重复项被 `parseProgress` 清洗；`unlockNotice` 进关/回大厅即复位 -1
- **Tuning Levers**: 场景分段（= 解锁节奏）、配饰规格
- **Dependencies**: progress.ts、scenes.ts、GooseChip/buildGoose、胜利演出

### Mechanic: 离线排行榜 (Guest Leaderboard)
- **Purpose**: 轻竞争钩子（parity G6），零链上依赖
- **Player Fantasy**: 「我这把 300 分能排第几？」
- **Input**: 每次过关最终分（>0）
- **Output**: best-effort `guestLeaderboard.submit(score)` → 拉取 50 条本地排序取名次 → 抽屉「游客排行榜」列表；进入 app 时也刷新一次
- **Success**: 提交/拉取失败被吞掉，**绝不阻塞本地闭环**（榜单显示空态文案）
- **Failure**: 无网/无框架榜后端 → 空态「还没有成绩——快去抓鹅！」
- **Edge Cases**: 分数解析失败按 0 处理；榜单为纯展示，不回写游戏状态
- **Tuning Levers**: 拉取条数、排序口径（当前按单局最高分）
- **Dependencies**: framework `app.mode.guestLeaderboard`、胜利结算

### Mechanic: 触觉反馈 (Haptics)
- **Purpose**: 移动端打击感第三通道（视觉/听觉之外）
- **Player Fantasy**: 「消除那一下手里也『咔』了一声」
- **Input**: 拾取/三消/胜/负事件
- **Output**: `navigator.vibrate`——pick 10ms、match 30ms、win [30,50,80]、fail 100ms（`logic/haptics.ts` 固定 cue 表）
- **Success**: Android Chrome 等支持端有微振动；HUD 有独立开关（aria-pressed），关闭持久化 localStorage
- **Failure**: iOS Safari 等不支持端特性检测后**静默不动**（不报错不降级弹窗）
- **Edge Cases**: 关闭时 `vibrate(0)` 取消在途振动；手势外调用可能抛错 → try/catch 吞掉
- **Tuning Levers**: cue 时长表
- **Dependencies**: 引擎胜负/消除事件、HUD 开关

### Mechanic: 音频 (Synthesized Audio)
- **Purpose**: 零版权、零文件的全事件音效层
- **Player Fantasy**: 「界面音效很『贵』」——干脆的消除声与胜利号角
- **Input**: 全部 11 个游戏事件（v2.2 的 9 个 + S2 `tick` 滴答 + S4 `unlock` 解锁号角）
- **Output**: 振荡器 + 滤波白噪声实时合成：land（速度分级闷响）/pick/match（C 大三和弦琶音）/combo/win/fail/powerup/shuffle/click/tick/unlock（`sound.ts` cue 表，`SFX_NAMES` 编译期穷尽性校验）
- **Success**: 单例共享静音态（React UI / 引擎 / Three 场景三处调用方一致）；静音持久化；首手势解锁 AudioContext
- **Failure**: 无音频设备/未解锁 → play 静默 no-op
- **Edge Cases**: land 45ms 节流 + 撞击速度门槛 v>1.2 防级联炸响
- **Tuning Levers**: 每 cue 的频率/包络/时长
- **Dependencies**: 用户手势（解锁）、事件源（引擎/场景/UI）
- **验证**: `sound.test.ts` **已入库**（10 项：懒创建/静音门控/持久化/unlock-resume/全 cue 不抛错/land 节流；v2.2 时代「测试通过但未提交」的旧账已还清）

---

## 6. 计分与经济（本地）

```
基础分：每消除一组(3个) +10                    (SCORE_PER_MATCH)
连击：上次三消后 2200ms 内再消，每组额外 +8×(连击-1)  (COMBO_WINDOW_MS / COMBO_BONUS_PER_STEP)
过关奖励：剩余时间(秒) × 2                     (TIME_BONUS_PER_SEC)
道具里程碑（每关，按本关基础分上限 C = kinds×perKind×10 派生）：
  分数每破 max(20, C×30%) → +1 提示
  分数每破 max(40, C×60%) → +1 加时
  4 连击 → +1 提示
战绩持久化：wins / best{关卡→分} / geese[]（localStorage v2 schema）
```

里程碑阈值实例（完整表由 `node scripts/tune.mjs` 打印）：

| 关 | 基础分上限 | 提示回赠步长 | 加时回赠步长 |
|----|-----------|--------------|--------------|
| 1 | 60 | 20 | 40 |
| 2 | 150 | 45 | 90 |
| 8 | 320 | 95 | 190 |
| 15 | 480 | 145 | 290 |

> 无虚拟货币通胀问题（纯本地分数），不建模 supply/demand。后续接链上奖励时再引入积分 sinks。

### 6.1 数值调优（Monte-Carlo，脚本 `scripts/tune.mjs`，S5 重写）

**模拟器如何工作（与 v2.1 版的三大差异）：**
1. **防漂移**：LEVEL_CURVE、场景 kindPool、TRAY_SLOTS、洗牌授予量全部**运行时从 TS 源码提取**（解析失败即退出非 0），不再手工复制曲线。
2. **真实生成器输出**：试次跑在 `{id, kind}` 实例上（场景 kindPool id、×3 整除）。v2.1 版随机策略对 number[] 取 `.kind` 得 undefined 自消三连 + `splice(-1)`，其「随手通关 100%」整列是 bug 产物，已修复。
3. **遮挡感知 + 无计时**：堆按落序排列（尾 = 顶），每步只有顶层 E(n)=max(6, n^0.72) 件可拾（n=144 → 36 件）；模拟中**没有时钟**——卡死是唯一败因（与 parity 目标 G1 的失败模型一致）；时间只作为**限时模式公平下限**输出并被门 F 复核。

**策略矩阵**：`random`（露出集中乱点）；`greedy`（补三 > 推二 > 起最多露出者，留 2 空位安全边际，山穷水尽才用救援）跑四种装备——全知无救援（可解性证明）/ 遮挡无救援 / 遮挡+洗牌 ×1（**在售配置**）/ 遮挡+洗牌+移出+撤回（G2 三件套预演）。

**当次实测输出（2026-07-10，4000 主试次/关；6 门全过、退出码 0）：**

| 关 | 种类 | 份数 | 物品 | 可解性(全知) | 贪心胜率(遮挡+洗牌) | 随手胜率 | 卡死率(随手) | 推荐时间 | 上线时间 |
|----|------|------|------|--------------|----------------------|----------|--------------|----------|----------|
| 1 | 3 | 2 | 18 | 100% | 100.0% | 100.0% | 0.0% | 40s | 40s |
| 2 | 5 | 3 | 45 | 100% | 100.0% | 0.6% | 99.4% | 80s | 80s |
| 3 | 5 | 3 | 45 | 100% | 100.0% | 0.4% | 99.6% | 80s | 80s |
| 4 | 6 | 3 | 54 | 100% | 99.7% | 0.0% | 100% | 95s | 95s |
| 5 | 7 | 3 | 63 | 100% | 97.8% | 0.0% | 100% | 105s | 110s |
| 6 | 7 | 3 | 63 | 100% | 97.5% | 0.0% | 100% | 105s | 110s |
| 7 | 8 | 3 | 72 | 100% | 94.2% | 0.0% | 100% | 120s | 120s |
| 8 | 8 | 4 | 96 | 100% | 94.4% | 0.0% | 100% | 155s | 160s |
| 9 | 9 | 3 | 81 | 100% | 88.2% | 0.0% | 100% | 135s | 135s |
| 10 | 9 | 4 | 108 | 100% | 88.3% | 0.0% | 100% | 175s | 175s |
| 11 | 10 | 4 | 120 | 100% | 79.5% | 0.0% | 100% | 190s | 195s |
| 12 | 10 | 4 | 120 | 100% | 79.3% | 0.0% | 100% | 190s | 195s |
| 13 | 11 | 4 | 132 | 100% | 68.0% | 0.0% | 100% | 210s | 210s |
| 14 | 12 | 4 | 144 | 100% | 55.7% | 0.0% | 100% | 230s | 230s |
| 15 | 12 | 4 | 144 | 100% | 55.2% | 0.0% | 100% | 230s | 230s |

**救援价值（策略选项对照，节选）：**

| 关 | 贪心·无救援 | 贪心+洗牌(在售) | 贪心+三件套(G2 预演) |
|----|-------------|------------------|----------------------|
| 5 | 84.7% | 97.8% | 99.9% |
| 9 | 56.9% | 88.2% | 97.3% |
| 12 | 46.3% | 79.3% | 93.3% |
| 15 | 23.0% | 55.2% | 78.1% |

**结论（本表驱动的设计决策）：**
- **门 A（可解性）**：全知贪心全 15 关 100% —— 无死局、无数学上不可赢的关（曲线数据被改坏会当场红灯）。
- **门 B/C（教学保底 + L2 跳档）**：L1 随手都 100%（3 种类 ×2 托盘上限 = 6 < 7，鸽笼原理不可能卡死）；L2 卡死率 0% → 99.4%，跳档如设计般陡峭。
- **门 D/E（单调难度）**：场景内与场景间，贪心胜率单调下降（场景均值 100% → 99.1% → 95.4% → 85.3% → 73.7% → 55.5%）——中后期在遮挡下**即使聪明玩法也有真实失败率**，这是本品类的刻意设计（原版亦然），不是坏数据。
- **洗牌是后期刚需而非摆设**：贪心每局平均动用 0.15（L5）→ 0.78（L15）次。
- **G2 三件套价值被预演**：移出+撤回可把 L15 聪明玩法胜率 55% 拉到 78%（+23pp）——落地 G2 时无需重新猜数值。
- **门 F（公平时钟）**：上线 timeMs 全部 ≥ 推荐值（物品数 ×1.5s+12s）。时间预算给足，超时败主要惩罚犹豫而非手速极限。
- ⚠️ 遮挡窗口 E(n)=n^0.72 是**近似模型**（真实遮挡由物理堆叠决定），横向对比（关与关、策略与策略）可信，绝对胜率数值待真人 playtest 标定。

---

## 7. 新手引导（Onboarding Checklist）

- [x] 核心动词（点物品抽出来、凑 3 个消）在进入 3 秒内可见（场景地图 → 开始 → 即时发牌，无阻塞教程）
- [x] 第 1 关**卡死保底**：3 种物品、每种 6 个、18 件、40 秒——托盘数学上不可能卡死（每种最多挂 2 个 ×3 种 = 6 格 < 7 格，第 7 格必然补成三消）；时间预算 2.2s/件，模拟中随手乱点也 100% 通关
- [x] 每关物品掉落即演示物理堆叠；托盘/连击/倒计时 HUD 从 L1 起常驻可见
- [ ] **机制分关引入未做**：计时、连击、全部 3 种道具从 L1 即全量在场（仅靠 L1 的低种类数降压）。如实标注——若 playtest 显示新手过载，考虑 L1 隐藏道具栏 / L2 起显示连击
- [x] 首关结束触发「抓大鹅」演出 + 下一关按钮作为 hook
- [x] 大厅 → 免费试玩（Play free）→ 场景地图 → 开始 的入口链路完整
- [x] 里程碑道具回赠不写在规则里——作为探索式发现（道具计数悄悄 +1）

---

## 8. 平台集成方式（Three.js 版，复用统一游戏框架）

> B 类用 **Three.js + cannon-es**，不走 `BaseScene`/`PhaserGameComponent`，而是复用框架的 **`GameBridge`**（引擎无关）自写 `ThreeGameComponent` + `ZhuaDaScene`。

```
apps/zhuada-e/
├── index.html / neo-manifest.json / vite.config.ts / tsconfig.json
├── package.json            # build = tsc --noEmit && vite build（S1 起类型门禁）；test = vitest run
├── public/                 # 自绘 logo/banner（含 webp/avif 变体）
├── scripts/
│   ├── tune.mjs            # ★ S5 蒙特卡洛平衡验证（源码提取曲线 + 遮挡模拟 + 6 门自校验）
│   └── generate-art.mjs    # 自绘店面图生成
└── src/
    ├── main.tsx            # defineMiniApp：observables + actions（startLevel/extract/nextLevel/retry/enter/shuffle/hint/addTime/debugWin/debugLose）+ 本地统计镜像
    ├── manifest.ts         # 店面文案（15 关/6 场景/收藏钩子）+ 本地统计绑定（statBest/statWins/statCleared/statGeese）
    ├── ThreeGameComponent.tsx  # WebGL 宿主：GameBridge 注入、ResizeObserver→scene.resize、挂载失败错误 UI（不崩）
    ├── PlayArea.tsx / PlayArea.scss  # HUD + 道具栏 + 场景地图 + 收藏册 + 全清屏 + 排行榜抽屉 + ?debug=1 面板
    ├── KindChip.tsx        # ★ 原创 SVG 物品图形（托盘/说明，无 emoji）
    ├── GooseChip.tsx       # ★ 原创 SVG 大鹅（收藏册，锁定剪影态）
    ├── scenes/
    │   ├── ZhuaDaScene.ts  # Three.js 渲染 + cannon-es 物理 + 拾取 + 主题换肤 + 胜负演出 + 道具响应
    │   ├── models.ts       # ★ 原创低多边形模型库（12 物品 + buildGoose(variant)）
    │   ├── pick.ts         # ★ 递归射线 + Group 回溯（拾取正确性的单一事实源）
    │   └── pick-raycast.test.ts  # 6 项拾取回归（Group 命中/遮挡排序/回溯）
    └── logic/
        ├── engine-zhuada.ts     # 纯规则：ITEM_DEFS/TRAY_SLOTS/generateItems/applyExtract/isTrayStuck
        ├── game-rules.ts        # 15 关曲线 + specOf(kindPool) + 计分常数 + milestonesFor + URL 调参
        ├── game-rules.test.ts   # 5 项里程碑可达性 + 时钟公平回归
        ├── scenes.ts            # ★ 6 场景数据（palette/kindPool/GooseVariant）
        ├── progress.ts / progress.test.ts  # v2 存档纯函数 + 14 项回归
        ├── guest-engine.ts      # 本地引擎（含 visibility 暂停、败因、里程碑回赠、榜单提交）
        ├── sound.ts / sound.test.ts  # 11 cue 合成音效 + 10 项逻辑单测
        └── haptics.ts           # 4 cue 振动反馈（可关、特性检测）
```

**关键约定（必须守）：**
1. `slug=zhuada-e`，`manifest id=miniapp-zhuada-e`，`urls.entry=/miniapps/zhuada-e/index.html` —— 三处同步
2. `GameBridge` 引擎无关：`window.__phaserBridge` 注入，`on("state")/getState()/dispatch()/setDispatch()/notifyReady()` 全复用
3. 设计令牌用 `--mx2-*`，根容器 `class="… mx2 mx2-cat-game"`
4. `t("...")` 必须同步补进 `messages.ts` 的 en+zh（i18n-key-parity 测试拦截）
5. 物理步 `world.step(1/60, clampedDt, 3)`（单参 `step(1/60)` 会随刷新率变速；`fixedStep` 在 0.20.0 下不推进刚体）
6. 拾取必须走 `scenes/pick.ts`（递归 + 回溯）；拾取前显式刷新世界矩阵
7. 构建必须过 `tsc --noEmit`（v2.1 拾取断链正是 tsc 可拦截而未拦截的 Group→Mesh 赋值）

**代码分割**：入口 chunk 241.8KB / gzip 76.5KB；Three.js+cannon-es 全部在懒加载 `ZhuaDaScene` chunk（605.6KB / gzip 156.7KB），仅开局 `dealt` 时动态 import。大厅/地图/收藏即时渲染。

---

## 9. 系统交互矩阵

| 系统 A \ B | 关卡生成 | 物理掉落 | 射线拾取 | 托盘消除 | 计时器 | 计分 | 道具 | 胜负演出 | 进度/收藏 | 榜单 |
|-----------|---------|---------|---------|---------|--------|------|------|---------|-----------|------|
| 关卡生成 | — | 提供列表 | 独立 | 独立 | 设时长 | 独立 | 设里程碑 | 独立 | 读解锁关 | 独立 |
| 物理掉落 | 接受 | — | 提供 mesh | 独立 | 独立 | 独立 | 受洗牌重落 | 独立 | 独立 | 独立 |
| 射线拾取 | 独立 | 读 mesh | — | 触发 | 独立 | 独立 | 独立 | 独立 | 独立 | 独立 |
| 托盘消除 | 独立 | 独立 | 接受 | — | 读剩余 | 写分 | 触发回赠 | 触发(清空/卡死) | 独立 | 独立 |
| 计时器 | 接受时长 | 独立 | 独立 | 独立 | — | 写时间奖励 | 受加时 | 触发(超时) | 独立 | 独立 |
| 计分 | 独立 | 独立 | 独立 | 接受 | 接受 | — | 驱动里程碑 | 读(结算) | 写 best | 写提交分 |
| 道具 | 读 spec | 触发重落 | 独立 | 独立 | 推 deadline | 独立 | — | 独立 | 独立 | 独立 |
| 胜负演出 | 独立 | 独立 | 独立 | 接受 | 接受 | 读 | 独立 | — | 写(过关) | 触发提交 |
| 进度/收藏 | 提供解锁 | 独立 | 独立 | 独立 | 独立 | 接受 | 独立 | 接受 | — | 独立 |
| 榜单 | 独立 | 独立 | 独立 | 独立 | 独立 | 接受 | 独立 | 接受 | 独立 | — |

全部为「接受/提供/触发/独立」——无循环依赖；榜单/收藏均为**下游**系统，故障不回灌玩法。

---

## 10. 验证与已知问题（Verification & Known Issues）

### 端到端验证结论（S1–S5 真机 Playwright probe，截图存 scratchpad/zhuada-rebuild/）
- ✅ **真实拾取链路（S1 修复后）**：dpr=2 真 WebGL 下对物品堆连续点击，648 次点击把栏内 18 件抽到剩 1 件、托盘/分数联动（`s1-report.json`：boxNow=1, score=130, matchesCleared=5）；dpr=2/3 画布 CSS 尺寸与宿主一致（修复前放大 2 倍裁切）
- ✅ **败因可读（S2）**：强制超时 → 「Time ran out — the goose got away」；强制卡死 → 「Tray jammed — the goose got away」（`s2-report.json`）
- ✅ **visibility 暂停（S2）**：隐藏标签页期间 timeLeft 不下降，恢复后继续
- ✅ **紧迫感（S2）**：末 10s HUD 时间变 `rgb(239,68,68)` 危险态；三消 pop 演出 5 次脉冲截图取证
- ✅ **元进度全链路（S4）**：地图 6 场景卡/14 锁 → L1 过关 → 存档 v2 落账 → 菜园鹅解锁卡 → 果园换肤（背景色实测变化）→ 最佳分徽标 → 收藏册 1/6 → 侧栏统计 → 抽屉榜单 2 行 → L15 全清屏 6 鹅回顾（`s4-report.json`）
- ✅ **平衡回归（S5）**：`node scripts/tune.mjs` 6 门全过退出码 0（表格见 §6.1）
- ✅ **质量门**：ESLint 0/0（src + scripts）；`tsc --noEmit` 0 错误；生产构建通过；vitest 35 项全过（progress 14 + sound 10 + pick 6 + game-rules 5）

### 已修复的关键实现坑（务必保留）
1. **Group 拾取断链（v2.1→S1，致命）**：组合模型根是 `THREE.Group`（raycast no-op），非递归 `intersectObjects(list, false)` 恒 0 命中 → 游戏完全不可玩。修复 = 递归相交 + 命中子 Mesh 回溯所属根（`scenes/pick.ts`）+ vitest 回归 + tsc 门禁（原类型错误 tsc 本可拦截）。
2. **物理步随刷新率变速（S1）**：`world.step(1/60)` 单参调用 = 每 rAF 帧固定推进 1/60s → 120Hz 双速。改 `world.step(1/60, min(rawDt,0.1), 3)`。（`fixedStep` 在 cannon-es 0.20.0 不推进刚体，同样禁用。）
3. **DPR≥2 画布双倍裁切（S1）**：`renderer.setSize(w,h,false)` 无 CSS 约束 → Retina 上画布布局为 2 倍并裁到左上角。修复 = 尺寸约束 + `resize()` 接 ResizeObserver。
4. **`?gravity` 旋钮失效（S1）**：`readTuneNum` 的 `v>0` 门槛拒绝一切负重力。现 `tuneGravity` 合法区间 [-60,-4]，文档示例 `?gravity=-16` 真实生效（probe 面板取证）。
5. **WebGL 不可用崩溃（S1）**：挂载失败后 setState 撞未初始化字段 → 全局错误边界。现 mount 成功标记短路 + 错误 UI（「3D 鹅栏无法在此设备上启动」+ 重试）。
6. **生成节奏卡死（v2.0）**：钳制 dt + 0.04 间隔在 rAF 节流下永远到不了阈值。改未钳制 rawDt 累加 + while 补帧 + 0.035s。
7. **拾取前矩阵过期（v2.0）**：`onPointerDown` 内显式 updateMatrixWorld。
8. **关卡时间数学死局（v2.1）**：旧曲线时间收紧到 50s 但物品涨到 180 → 不可赢。时间改随物品数增长（门 F 持续复核）。
9. **随机策略模拟 bug（S5）**：tune.mjs 对 number[] 取 `.kind` → undefined 自消三连 + `splice(-1)` → 「随手 100% 通关」是假数据。修复后随手玩家 L2+ 卡死率 ≈100%（遮挡模型下），损失厌恶数值上成立。
10. **里程碑不可达（S5）**：固定 100/200 阈值在 L1（上限 60）不可达、连击回赠加时与需求反相关。改按关卡上限 30%/60% 派生 + 4 连击回赠提示。
11. **撤回重生成误杀在途抽取（S6）**：场景把「items 里存在但视觉 extracting」一律当成撤回回堆 → 正常快速连点时在途抽取被销毁重掉、幽灵视觉盖住真物品，实测点击全部失效（probe 1260 taps 分数冻结）。修复 = 只有**前一逻辑快照缺席**的 id 才算「新增」（撤回），在途窗口内的 id 跳过；托盘飞行完成回调加同一性检查防删错新视觉。

### 已知限制 / 后续
- `LEVEL_CURVE.boxSize` 与引擎生成坐标是逻辑数据，3D 鹅栏固定尺寸（§4 如实标注）；后期难度由种类数 + 堆深驱动，体验上成立，但「盒随关变大」尚未落地。
- 机制分关引入未做（§7 第 4 条）。
- 遮挡模拟是近似模型（§6.1 尾注），绝对胜率待真人标定。
- tune.mjs 的无计时/三件套模拟先于 S6 实装完成（G2 预演口径）；实装后的濒死自救语义（满盘等待救援而非立即判负）比模拟略宽松，数值只会更优，方向性结论不变；精确复算留待真人 playtest 前。
- headless 环境 rAF 受限，3D 手感仍需真机复检（probe 已覆盖逻辑链路与视觉截图）。

---

## 10.5 音频与移动端（Audio & Mobile）

### 音频系统（12 cues，全合成）
| 音效 | 触发点 | 设计意图 |
|------|--------|----------|
| `land` | 物品落栏（碰撞回调，撞速缩放响度，45ms 节流 + v>1.2 门槛） | 落地重量感 |
| `pick` | 抽出物品 | 操作确认 |
| `match` | 三消（连击 ≤1） | C 大三和弦正反馈 |
| `combo` | 连击窗口内再消 | 上行 sparkle |
| `win` | 清栏抓鹅 | 五音胜利号角 |
| `fail` | 卡死/超时 | 下行锯齿波 |
| `powerup` | 提示/加时 | 三连上行叮咚 |
| `shuffle` | 洗牌重落 | 五连方波扫频 |
| `click` | 通用 UI 点击 | 短促 tick |
| `tick` | 倒计时末 5 秒每秒（限时模式） | 紧迫滴答（S2 新增） |
| `unlock` | 限定大鹅解锁 | 收藏号角（S4 新增） |
| `shake` | 晃一晃生效 | 低频噪声嘎啦 + 下行摆音（S6 新增） |

- AudioContext 懒创建 + 首手势解锁（Start/首次点屏）；静音持久化 `zhuada-e:sound-muted`，主增益平滑切换；三调用方共享单例。
- `sound.test.ts` 10 项逻辑单测**已入库**（mock AudioContext/localStorage：懒创建、静音门控、持久化、unlock-resume、全 cue 不抛错、land 节流）。

### 移动端（触屏 + 触觉 + 自适应）
- 拾取走 `pointerdown`（鼠标/触屏/笔统一）；`touch-action:none` + 禁高亮/禁选/overscroll 收敛，落点不被滚动吞。
- 射线归一化用 `getBoundingClientRect()`，与 DPR/CSS 尺寸无关；dpr≥2 画布尺寸 S1 修复（见 §10）。
- ResizeObserver + visualViewport 监听 → `scene.resize(w,h)` 更新渲染器与相机纵横比（转屏/键盘弹出安全）。
- 触觉 `haptics.ts`（§5），HUD 双开关（音效/振动）均持久化。
- `prefers-reduced-motion`：press 放大、提示脉冲、大鹅 bob 均降级。

---

## 10.6 手感调参与真机 Playtest 支撑（Tuning & Playtest）

### 实时调参（URL 参数，无需改代码）
| 参数 | 对应常量 | 默认值 | 合法区间 | 含义 |
|------|----------|--------|----------|------|
| `?combo=` | `COMBO_WINDOW_MS` | **2200** | 100–60000 | 连击窗口 ms（物理拾取有天然间隔，1500 时连击几乎不可达，故放宽） |
| `?bonus=` | `COMBO_BONUS_PER_STEP` | **8** | 1–1000 | 每段连击额外加分（4 连一组 10+3×8=34 分，曲线更陡） |
| `?score=` | `SCORE_PER_MATCH` | 10 | 1–10000 | 单次三消基础分（里程碑步长随之等比缩放） |
| `?timebonus=` | `TIME_BONUS_PER_SEC` | 2 | 1–100 | 剩余每秒奖励分 |
| `?gravity=` | `tuneGravity()` | **-18** | **-60 – -4** | 物理重力（向下为负；S1 修复后负值真实生效，正值/越界回退不翻转） |

示例：`/miniapps/miniapp-zhuada-e?debug=1&combo=2200&bonus=8&gravity=-16`

> ⚠️ 连击窗口/加成/重力为 **[PLACEHOLDER] 级手感假设**（本文档恰好保留这 3 处待真人 playtest 的标记），最终值以真人试玩为准。

### `?debug=1` Playtest 调试面板
仅 URL 含 `?debug=1` 时渲染（正常游玩绝不出现）：实时 FPS（rAF 计数）/关卡/栏剩余/托盘占用/分数/连击/剩余时间 + 当前调参值（comboWin/bonus/gravity，确认覆盖生效）+ 快捷按钮：跳过→下关 / 强制胜利（`debugWin`）/ 强制失败（`debugLose`，可选败因）/ 重开本关——引擎钩子仅 `dealt` 态可触发。

---

## 11. 待办（实现计划 · 已完成项打勾）

- [x] 1–19. v1.0–v2.3 项（骨架/规则/引擎/场景/道具/分割/调优/音频/触屏/调参/调试面板——历史见变更记录）
- [x] 20. S1 拾取修复 + 类型门禁 + DPR + 物理步 + 重力旋钮 + WebGL 降级 + 资源释放 + resize
- [x] 21. S2 败因可读 + visibility 暂停 + 倒计时紧迫感 + 三消 pop + 触觉 + SVG 托盘 + 声音测试入库
- [x] 22. S4 场景换肤 + 关卡地图 + 大鹅收藏 + 本地统计 + 离线榜 + 全清屏（progress v2 + 14 项测试）
- [x] 23. S5 tune.mjs 重写（源码提取/遮挡/策略选项/6 门）+ 里程碑重推导（milestonesFor + 5 项测试）+ GDD v3.0 真实性重写
- [x] 24. **G1**：默认关闭倒计时（卡死为唯一败因），保留「限时挑战」开关（S6 实装，§12）
- [x] 25. **G2**：移出（前 3 → 场边暂存位，暂存仍参与三消）+ 撤回（上一抓取回栏）两道具（S6 实装，§12）
- [x] 26. **G3**：摇一摇按钮（全堆随机冲量 + CD + 镜头微震）（S6 实装，§12）
- [ ] 27. 真人 playtest：手感三 [PLACEHOLDER]（连击窗口/加成/重力）标定 + 遮挡模型绝对值校准 + 触屏命中手感
- [ ] 28. （可选）盒尺寸随关卡变化落地；机制分关引入

---

## 12. Parity 三缺口（S6 已实装）

> 以下三个机制来自 parity 基准（claudedocs/zhuada-e-parity-spec.md G1/G2/G3，原版三件套 + 摇一摇 + 无硬倒计时），**S6 全部实装**并经真机 probe 取证（scratchpad zhuada-rebuild/gate/：limit挑战 c1-c6、救援链 b1-b5、晃一晃 a7/e2）。

### Mechanic: 无计时默认模式 (Untimed Default) — G1 [已实装 S6]
- **Purpose**: 对齐原版失败模型——压力全部来自卡槽，慢想不受罚
- **Player Fantasy**: 「让我好好研究这堆东西」
- **Input**: 默认开局不起表；大厅「限时挑战」开关（`PlayArea` goose-timed-toggle → `setTimedMode` action）仅限局间切换，localStorage `zhuada-e:timed-mode` 持久化（`guest-engine.loadTimedPref`）
- **Output**: 无计时态 HUD 时间显示 **∞**（无危险态）；限时态沿用 LEVEL_CURVE.timeMs + 末 10s 危险态 + 末 5s 滴答；`failLevel("timeout")` 路径仅限时模式可达（tick 定时器只在 timed 分支启动）
- **Success**: 卡死成为唯一默认败因（gate-c probe：默认关起表 timeLeftMs=0；限时开 36.2s 起跳、超时败文案为时钟版）
- **Failure**: 无计时过关无时间奖励 → 胜利文案分流 `statusCaughtUntimed`（分数纯消除+连击，诚实呈现）
- **Edge Cases**: addTime 道具无计时模式不授予、不显示、引擎拒绝（`addTime` 先查 timedMode）；里程碑加时回赠亦只在限时模式发放；模式开关中局锁定（防限时局逃钟）
- **Tuning Levers**: 模式开关默认值（现 OFF）、限时模式时长表
- **Dependencies**: guest-engine timedMode 分支、HUD、道具栏按模式渲染

### Mechanic: 移出 (Remove-to-Shelf) — G2 [已实装 S6]
- **Purpose**: 濒死救援——把托盘前 3 件移到场边暂存位，暂存物件仍参与三消
- **Player Fantasy**: 「先腾出手，再回头收拾它们」
- **Input**: 道具按钮（每关 1 发），托盘 ≥3 件**且暂存位全空**时可用（`engine-zhuada.applyRemoveToShelf` 返回 null 即按钮置灰）
- **Output**: 前 3 个占用槽清空 → 3 件按序移入 3 格暂存排（`PlayArea` goose-shelf，KindChip 原创 SVG）；后续抽取跨区凑成 3 同款时**优先从暂存清除**（`applyExtractShelf` shelf-first；gate-b probe b3：暂存 [A,A,B] 抽 A → 暂存清两件）
- **Success**: 托盘满且无解时进入濒死自救态（statusTrayRescue）而非判负——移出是设计的救援时刻；tune.mjs G2 预演三件套把 L15 聪明玩法胜率 55%→78%
- **Failure**: 暂存位有限（3 件）且必须全空才能再移，救援耗尽即真卡死（gate-b probe b5 取证）
- **Edge Cases**: 跨区计数恒 ≤2/种（第 3 个必消）⇒ 移出**数学上不可能**制造三元组、清空鹅栏必然托盘+暂存全空（`engine-zhuada.test.ts` 不变量测试）；移出后上一抽取失效（不可撤）
- **Tuning Levers**: 每关授予量 1、暂存容量 3
- **Dependencies**: engine 跨区计数、托盘 UI 暂存排、濒死自救态

### Mechanic: 撤回 (Undo Grab) — G2 [已实装 S6]
- **Purpose**: 一步后悔药——上一次抽取的物件回到堆顶
- **Player Fantasy**: 「手滑了！让我收回那一下」
- **Input**: 道具按钮（每关 1 发），仅上一抽取**未触发三消**时可用（`undoable` observable → 按钮置灰）
- **Output**: 该件从其托盘槽移除 → 同 id/kind 回逻辑堆 + 场景从栏顶重新掉落（场景按「前一逻辑快照缺席」识别新增 id 补生成，撤回在托盘飞行 220ms 窗口内也安全——飞行取消 + 同一性检查防删错）
- **Success**: 释放 1 格托盘压力；与移出错位互补（1 格 vs 3 格）；gate-b probe b4：物品数 38→37→38 往返取证
- **Failure**: 连续手滑无法连续撤回（消除/洗牌/移出都会刷新可撤对象为空）
- **Edge Cases**: 撤回后立刻再抓同一件是合法操作；洗牌后上一抽取失效（kind 已重排）
- **Tuning Levers**: 每关授予量 1
- **Dependencies**: engine lastGrab 历史（itemId/kind/slot）、场景单件重落、undoable observable

### Mechanic: 摇一摇 (Shake) — G3 [已实装 S6]
- **Purpose**: 让埋住的物件翻上来——遮挡困局的物理解法（浏览器端用按钮代替晃手机）
- **Player Fantasy**: 「晃一晃，看看底下埋了什么」
- **Input**: 「晃一晃」按钮，CD 10s（`SHAKE_CD_MS`，`shakeReadyAt` observable；按钮倒计时标签 + 置灰，连点被引擎 CD 拦截）
- **Output**: `shakeNonce` 递增 → 场景对全堆非在途刚体 `wakeUp()` + 封顶随机冲量（水平 ±2.4 / 垂直 2.2–4.4）+ 随机角速度；340ms 阻尼镜头微震（围绕 cameraBase 衰减正弦）；合成 `shake` 音效（第 12 cue，滤波噪声嘎啦 + 低频摆音）
- **Success**: 不消耗道具次数（CD 制），提供无成本的信息解法；与洗牌（改 kind）正交（只动位置）；gate-a probe a7：nonce+1、按钮 CD 置灰、标签倒计时取证
- **Failure**: 冲量过大物件飞出栏 → 实际不可能：物理墙是**无限平面**（侧向无出口），垂直冲量封顶远低于掉落高度
- **Edge Cases**: `prefers-reduced-motion` 下镜头震动关闭、仅保留物理重落（gate-e probe：晃后 4.5s 内画面回到静止，均差 0.61）；每关进场 CD 重置为就绪
- **Tuning Levers**: 冲量大小/方向分布、CD 时长 10s、镜头震幅 0.12/时长 340ms
- **Dependencies**: cannon-es applyImpulse、场景相机、音效 `shake` cue

---

> **文档健康承诺**：本 GDD 的每个「已实现」声明都能在 `apps/zhuada-e/src` 中找到对应实现；每个未实装设计都带 [未实装] 标注。改动机制时必须同步更新本文档（版本号 + 变更记录），`scripts/tune.mjs` 的 6 道门在每次数值改动后必须重跑（退出码 0 才算过）。
