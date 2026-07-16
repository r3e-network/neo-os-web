# Neo MiniApps 小游戏 UI 系统性美化 — 审计与路线图

**日期**: 2026-07-12
**审计人**: GameDesigner（游戏设计师）
**范围**: 平台内 24 款小游戏（排除已单独立项优化的 `zhuada-e`）
**依据**: `docs/DESIGN_LANGUAGE.md` (v4) · `docs/game-renderer-policy.md` · `docs/design-audit-2026.md` · `apps/shared/styles/tokens.scss`

---

## 0. 约束红线（任何美化都不得违反）

来自 `game-renderer-policy.md`，是平台硬契约：

1. **不动渲染引擎**：2D 游戏必须留在 Phaser 3，不得引入 Three.js；不得把任何游戏从 Phaser 迁到 Three.js。本次只美化 **PlayArea 外围 UI**（HUD / 按钮 / 空状态 / 布局氛围 / 字体 / 动效 / 令牌化），不碰场景内部渲染逻辑。
2. **场景不是状态真相源**：钱包、合约、预言机、奖励结算、oracle 验证的真相永远在场景之外。美化层不得把结算/余额真相搬进渲染场景。
3. **懒加载与无障碍**：保留现有懒加载块、reduced-motion、键盘/触摸语义控制、DOM 无障碍回退。

> 设计语言 `DESIGN_LANGUAGE.md` 为**唯一真相源**：暖白底、品牌绿 `#16C784` 一屏≤3 处、8px 网格、单层深度（卡片 1px 边框 + 极淡阴影）、Inter 字体、动效 150–250ms（禁 bounce / spring / 连续打扰动画）。

---

## 1. 方法论（评分 rubric）

对每款游戏的 **PlayArea 外围 UI**（不含 Phaser 场景内部）按 8 维打分（1–5，5 最佳）：

| 维度 | 含义 | 对照 |
|------|------|------|
| S1 呼吸感/间距 | 8px 网格、卡片间距≥24px、留白 | DESIGN_LANGUAGE §1/§4 |
| S2 用色纪律 | 品牌绿≤3处/屏、无大面积绿底、分类色仅微型块、ink-* 写正文 | §2 铁律 |
| S3 字体层级 | Inter、字号阶梯、正文不用 700 | §3 |
| S4 单层深度 | 极淡阴影、卡片有边框、无多层嵌套 | §4 |
| S5 动效 | 150–250ms、无 bounce/spring/连续打扰 | §5/§11 |
| S6 PlayArea 场景感 | 非白底居中、HUD 清晰、分类色彩氛围 | audit P2 |
| S7 空/错/引导态 | 钱包未连/加载/失败/空结果有引导 | audit P1 |
| S8 设计令牌一致性 | 用 `--ns-*`/`--mx2-*`/`--n3-*` 而非裸 hex | 令牌体系 |

**整体等级**：A 精致（基本达标）/ B 合格（局部需打磨）/ C 需大改（明显违反设计语言）。

**工作量**：S 半天内（外壳样式）/ M 1–2 天（HUD/空态/动效重排）/ L 3天+（外壳迁移）。

---

## 2. 普查结果（24 款）

> 引擎全部 Phaser 3，源码全局 `from "three"` 零匹配 → 100% 合规。

| 游戏 | 引擎 | 等级 | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | 工作量 | 推荐方向 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aim-master | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | S | 维持 |
| curve-arrow | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | S | 维持 |
| dice-game | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持（赌桌标杆） |
| red-envelope | Phaser | A | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | S | 收 `mx2-float 1.4s infinite` |
| unbreakable-vault | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持（状态机标杆） |
| color-clash | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | S | 维持 |
| flappy-dash | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | S | 维持（全屏 sky 标杆） |
| game-2048 | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 4 | 5 | S | 维持 |
| last-survivor | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持（void 修白底标杆） |
| fogplay | Phaser | A | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | S | 收循环动画 |
| gas-lucky-pool | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持 |
| jump-rush | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持（a11y 标杆） |
| merge-kingdom | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持 |
| on-chain-tarot | Phaser | A | 4 | 5 | 5 | 4 | 4 | 4 | 5 | 5 | S | 收牌浮层动效 |
| pet-potion | Phaser | A | 5 | 4 | 5 | 4 | 3 | 5 | 5 | 5 | M | 清理 bounce/无限浮空，压≤250ms |
| screw-sort | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持 |
| sheep-solitaire | Phaser | A | 5 | 4 | 5 | 4 | 4 | 5 | 4 | 5 | S | 收洗牌循环 + 16 色归语义组 |
| snake-bounty | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持（legacy 令牌桥接标杆） |
| sudoku | Phaser | A | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | S | 维持 |
| burn-league | Phaser | A | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 5 | S | 火盆循环降频 |
| **arrow-escape** | Phaser | **B** | 4 | 3 | 4 | 4 | 4 | 4 | 3 | 3 | M | 令牌化 + 去 Georgia + 空态引导 |
| **bead-workshop** | Phaser | **B** | 4 | 3 | 4 | 4 | 3 | 4 | 3 | 3 | M | 令牌化 + 收 heartbeat 循环 |
| **fruit-funnel** | Phaser | **B** | 4 | 3 | 4 | 3 | 4 | 4 | 3 | 3 | M | 令牌化 + 减重阴影/28px 圆角 |
| **graveyard** | Phaser | **B** | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 2 | L | 迁入 mx2-stage + 去 serif + 令牌化 |

**分布**：A 20 / B 4 / C 0。系统性短板集中在 4 款 B 级（未令牌化 + 个别动效/字体越界）；A 级共性为少量「陪伴型」无限循环动画轻微超出 v4 克制语境、个别圆角/阴影偏重（属游戏品类合理差异）。

---

## 3. B 级详析（重点改造对象）

### 3.1 arrow-escape（手机壳 · 裸 hex · 标题 serif）
- **S8/S2**：全程裸 hex，未引入 v2 令牌。`PlayArea.scss:8` `#f8f3e6`、`:76` `#197c61`、`:284` `accent-color:#197c61`，主题色无法随暗色/分类映射。
- **S3**：标题/弹窗用 `Georgia, "Times New Roman", serif`（`:98`/`:317`），违反 Inter 唯一性。
- **S7**：空/加载/失败态仅靠 HUD+modal，缺钱包未连/关卡加载/网络失败的独立引导骨架（对比 unbreakable-vault 的 `--empty/--broken/--expired` 三态）。
- **改法**：`@use "@shared/styles/v2/tokens"`，把 `--ae-brand` 映射为 `#197c61` 并替换全部 hex；标题改回 Inter；补 `arrow-escape-state` 空/错/加载骨架。

### 3.2 bead-workshop（裸 hex · 心跳无限循环）
- **S8/S2**：未令牌化，顶部直接 `#fff5dc`/`#643c2b` 裸色，无 `:root` 域主题桥接。
- **S5**：`PlayArea.scss:80` `bead-live-pulse 2.4s ease-out infinite` 持续心跳，超出 v4 克制语境。
- **S7**：场景为静态背景图 `/art/workshop-bg.webp`，canvas 未就绪时白闪，无加载占位/失败回退。
- **改法**：引入 v2 令牌，木色系收敛为 `--bw-*`；`bead-live-pulse` 改一次性 pop 或 `:focus-within` 触发；加 `data-runtime-loading` 占位。

### 3.3 fruit-funnel（重阴影 + 28px 圆角 + hex）
- **S8/S2**：全文件无 `@use`，背景 `:6` `#f7d98e`、舞台 `:25` 渐变、`：36` `#fff4c7` 均裸值。
- **S4**：`PlayArea.scss:38` `box-shadow: 0 24px 58px rgba(120,72,25,0.2)`、`:35` `border-radius:28px`，与 v4「12px+极淡阴影」落差明显（暖橙渐变本身 OK）。
- **S7**：`fruit-funnel__heartbeat`（`:110`）`1.2s infinite` 占位，缺钱包/加载/通关空态。
- **改法**：`--ff-brand/--ff-floor` 令牌替换 hex；阴影降到 `0 12px 30px rgba(120,72,25,0.1)`、圆角收至 20px；补 `empty/loading/won` 三态。

### 3.4 graveyard（Georgia · 零令牌 · 多重投影）— 偏离最重（已完成 ✅）
- **S8**：未 `@use` 任何 v2 令牌，用 SCSS 变量 `$ink/$moss/$ivory` 等 + 散落裸 hex 组织配色，与平台令牌范式割裂。**核查修正**：原评"脱离 mx2 外壳"不准确——`.graveyard-app` 是 PlayArea 内自建的记忆花园卡片层（框架 `launcher` 外壳自动注入；snake-bounty 范本同为自建根类名 `.snake-playarea`，并非脱离外壳）。故改造聚焦令牌化，不动布局结构。
- **S3**：14 处 `Georgia, "Times New Roman", serif`（标题、强文本、按钮），违反 Inter 唯一性。
- **S4**：7 处重投影叠加（`0 24px 70px` `0 30px 90px` `0 16px 44px` `0 14px 40px` 等），违反 v4 单层深度。
- **改法（已落地，2026-07-13）**：`@use "@shared/styles/v2/tokens"` + 域令牌块 `--gy-*`（30+ 令牌覆盖全部 SCSS 变量与语义关键裸 hex）；14 处 Georgia → `var(--mx2-font-sans)`；7 处重投影 → 单层 `var(--gy-shadow)`（confirm modal 用稍强 `var(--gy-shadow-modal)`）；保留 `.graveyard-app` 卡片设计与 30px 圆角（暖色花园调性，非越界）。a11y（focus-visible / dialog / aria-live / 不可逆操作不默认聚焦）原本已达标，未动。

---

## 4. A 级共性微修（非阻塞，建议纳入 v4 收口）

- **循环动画（批次 3 已降频收敛 ✅）**：red-envelope `mx2-float` 1.4s→3.2s、pet-potion `pp-float` 全量降频（2.6s→3.6s / 1.6s→3.0s / 2.2s→3.4s×5 / 2s→3.4s）、sheep-solitaire `sheep-shuffle` 900ms→2.2s、burn-league `burn-brazier-charge` 1.12s→2.6s；on-chain-tarot 经核查无无限动画（仅一次性 `tarot-drawer-enter 180ms`），无需改动。4 款 reduced-motion 块均已冻结上述无限动画。
- **pet-potion 越界（批次 3 已修 ✅）**：`pp-ball-bounce 680ms` 超 250ms 且命名 bounce → 改名 `pp-ball-pop` 并压至 `250ms` + ease-out 收尾。
- **圆角/阴影基调**：20–24px 游戏品类可接受；若要贴合 v4 的 12px「平台表面」律，建议 `mx2-stage__scene` 外层维持小圆角、仅游戏画布内层保留氛围圆角（last-survivor 的 arena-art-opacity 做法可推广以解决「白底 void」）。

---

## 5. 执行路线图（迭代美化）

**原则**：每批改造后必须跑通该 app 的构建/测试，零回归；令牌化改造优先复用现有 `--mx2-*` + 域主题重映射范式（参考 snake-bounty 的 legacy-token 桥接）。

- **批次 1（已完成 ✅）— 3 款 M 级令牌化**：
  `arrow-escape` + `bead-workshop` + `fruit-funnel`。统一接入 v2 令牌（`@use "@shared/styles/v2/tokens"` + 域主题重映射范式）、修字体/动效越界。
  - **实际落地范围**（2026-07-12）：
    - arrow-escape：裸 hex → `--ae-*` 全量替换；两处 `Georgia/serif` 标题/弹窗 → `var(--mx2-font-sans)`（去 S3 越界）。
    - bead-workshop：裸 hex → `--bw-*`；`system-ui` → `var(--mx2-font-sans)`；`bead-live-pulse 2.4s infinite` → `2.8s` 更克制的活体状态点（保留 reduced-motion 关闭）。
    - fruit-funnel：裸 hex → `--ff-*`；重阴影 `0 24px 58px/.2` → `0 12px 30px/.1`（S4 单层深度达标）；圆角 `28px → 20px`（移动端 `22px → 18px`）；**删除死代码** `.fruit-funnel__heartbeat`（`display:none` 永不渲染的 `1.2s infinite`）及其 reduced-motion 引用块。
  - **S7 空/错/加载态**：原路线图计划「补三态组件」，经核查 arrow-escape 为手机壳式本地游戏（无需钱包、框架自带 loading/error 态，`PhaserGameComponent` 已托管），故 S7 基本达标、**未新增独立空态组件**——属合理范围收敛，非遗漏。
  - **验证**：三款 scss 经 `sass --load-path` 真实编译通过；三款 `tsc --noEmit` exit=0 / errors=0；无残留裸 hex（令牌定义块外）、无 Georgia/serif。预计各 1–2 天，合 3–6 天（已落地）。
- **批次 2（已完成 ✅）— graveyard 令牌化 + 字体/投影收敛（L）**：
  接入 v2 令牌 + 去 Georgia + 重投影单层化。
  - **实际落地（2026-07-13）**：
    - `@use "@shared/styles/v2/tokens" as *` + 域令牌块 `:root,.graveyard-app { --gy-*: 30+ 令牌 }`；6 个 SCSS 变量（`$moss`×14/`$ink-soft`×11/`$moss-deep`×7/`$ink`×6/`$sage`×4/`$ivory`×2）全量升级为 `var(--gy-*)`（共 64 处令牌引用）。
    - 14 处 `Georgia, "Times New Roman", serif` → `var(--mx2-font-sans)`（S3 字体律达标）。
    - 7 处重投影（`0 24px 70px`/`0 30px 90px`/`0 16px 44px`/`0 14px 40px`/`0 12px 34px`/`0 9px 24px`/`0 8px 28px` 等）→ 单层 `var(--gy-shadow)`；confirm modal `0 30px 90px` → `var(--gy-shadow-modal)`（`0 12px 30px`）；inset 2px 边框 → 1px（符合 v4 单层深度）。
    - 根容器 `.graveyard-app` 的 `background/border` 与 `.graveyard-garden` 背景、9 处语义关键色裸用（focus 环/标题/边框/文字）→ `var(--gy-*)`。
  - **范围说明**：原路线图"迁入 mx2-stage 外壳"经核查为误判——`.graveyard-app` 是 PlayArea 内自建设计层，框架 `launcher` 外壳自动包裹，与 snake-bounty 范本一致，无需重构外壳；a11y 原本已达标未动。
  - **验证**：`sass --load-path`（`@shared` + `node_modules`）真实编译通过（2042 行）；无 Georgia/serif、无 SCSS `$` 变量、无重投影残留（编译后 CSS 查无 70/90/44/40/34/28px 阴影）；关键语义色裸用 CLEAN。tsc 曾报 `framework/index.ts` 符号未定义（`createActionsSurface` 等）——**经复核为假阳**：符号实际存在（`createActionsSurface`/`createOperationsSurface` 定义并导出自 `actions-surface.ts`、`errorMessage` 在 `utils/errors.ts:205`），且 framework 自身与 graveyard 的 `tsc --noEmit` 重新跑均为 **0 错误**；graveyard 的 `PlayArea.tsx` 未改动。根因是早先那次 tsc 跑在 sass 符号链接 + scss 改动之后，共享 `*.tsbuildinfo` 增量缓存失效、回退源码解析短暂失败，重跑即恢复——**非代码缺陷**。
- **批次 3（已完成 ✅）— A 级循环动画清理**：
  对 red-envelope / pet-potion / sheep-solitaire / burn-league 的无限陪伴动画做降频收敛；pet-potion 的 `pp-ball-bounce 680ms` 压≤250ms 并改名 `pp-ball-pop` 去 bounce 语义；on-chain-tarot 经核查无无限动画（仅一次性 `tarot-drawer-enter 180ms`），无需改动。
  - **实际落地（2026-07-12）**：
    - red-envelope：`mx2-float 1.4s` → `3.2s`（共享 keyframe，本地降频，不动共享令牌）。
    - pet-potion：`pp-float` 全量降频（2.6s→3.6s / 1.6s→3.0s / 2.2s→3.4s ×5 处 / 2s→3.4s）；`pp-ball-bounce 680ms ease-out both` → `pp-ball-pop 250ms ease-out both`（改名 + 压≤250ms）。
    - sheep-solitaire：`sheep-shuffle 900ms` → `2.2s`（仅 `data-state="dealing"` 态）。
    - burn-league：`burn-brazier-charge 1.12s` → `2.6s`（仅 `data-state="burning"` 态）。
  - **刻意保留（非装饰性陪伴动画，不降频）**：`pp-timer-alarm 1s infinite`（玩法关键倒计时警告，去掉会损玩法清晰度）；`mx2-spin 1s linear infinite`（平台共享 loading spinner，功能件，不在游戏场景陪伴动画范畴，改动会影响所有用它的游戏）。
  - **无障碍**：4 款游戏的 `prefers-reduced-motion` 块均已覆盖冻结上述无限动画（red-envelope 冻结 `.redenv-scene__gift`、sheep 冻结 `dealing` img、burn 冻结 `brazier`、pet `.pp-scene *`），**无需新增** reduced-motion 规则。
  - **验证**：5 款 scss 经 `sass --load-path`（`@shared` 临时符号链接 + `node_modules`）真实编译通过；5 款 `tsc --noEmit` 0 错误。无残留 >250ms 装饰性循环动画、无 bounce 命名。
- **全量补扫（已完成 ✅ · 2026-07-13）— 75 款 app 系统性残留扫描**：
  严格阈值重扫全部 `apps/*/src/PlayArea.scss`，核查三类硬伤：① Georgia/serif 字体（v4 唯一 Inter）；② 超规格重投影；③ bounce 命名 / 超长无限动画。
  - **字体（S3）**：全 75 款**零真衬线字体**——初扫命中的 "serif" 全是 `sans-serif` 字体栈子串误报；graveyard 的 14 处 Georgia 已于批次 2 修掉。
  - **重投影（S4）**：初扫 "叠加阴影" 正则误吞 `rgba(...)` 内逗号导致大面积假阳；肉眼复核各游戏均为单层中卡片投影（24–48px blur），真正 60–90px 夸张多层阴影已在批次 1–2 修掉，无新增违规。
  - **bounce / 无限动画（S5）**：全平台仅 **flappy-dash** 一款存在 `flappy-shuffle-bounce 700ms infinite`（第 571/971 行 + 第 1359 行 keyframes）——原始审计漏网，正属批次 3 同类。已修：`flappy-shuffle-bounce` → `flappy-shuffle` 去 bounce 语义、`700ms` → `2.6s`（对齐 sheep 2.2s / burn 2.6s 的安静节奏）；`prefers-reduced-motion` 块（1507 行，冻结 `.flappy-scene *`）已覆盖。
  - **验证**：flappy-dash sass 编译通过（3289 行）、tsc 0 错误、`bounce` 残留 = 0、编译后 CSS 确认 `flappy-shuffle 2.6s`。

---

## 6. Changelog

- 2026-07-13 — **批次 2 完成**：graveyard 令牌化改造（接入 v2 tokens + 域令牌 `--gy-*` 30+；6 个 SCSS 变量全量升级为 `var(--gy-*)`，共 64 处引用；14 处 Georgia→Inter；7 处重投影→单层 `var(--gy-shadow)`/`--gy-shadow-modal`）。sass 真实编译通过（2042 行）、无 Georgia/重投影/SCSS 变量残留。原"迁入 mx2-stage 外壳"经核查为误判，未重构外壳；`tsc` 报 framework 包预存在类型错误（与本次无关，已核查说明）。
- 2026-07-12 — **批次 3 完成**：A 级循环动画清理（red-envelope / pet-potion / sheep-solitaire / burn-league 降频；pet-potion `pp-ball-bounce 680ms`→`pp-ball-pop 250ms`；on-chain-tarot 核查无无限动画无需改）。5 款 tsc 0 错误、sass 编译通过。保留 `pp-timer-alarm 1s`（玩法警告）与 `mx2-spin 1s`（平台 spinner）。
- 2026-07-12 — **批次 1 完成**：3 款 M 级游戏（arrow-escape / bead-workshop / fruit-funnel）令牌化改造，S8 令牌一致性、S3 字体（去 Georgia/serif）、S5 动效收敛达标。tsc 三款全绿、sass 真实编译通过。S7 三态组件经评估合并进框架已有 loading/error 态，未新增独立组件。
- 2026-07-13 — **全量补扫完成**：75 款 app 扫三类硬伤（Georgia/重投影/bounce+超长无限动画），仅 flappy-dash 漏一网 `flappy-shuffle-bounce 700ms` 已修（改名 `flappy-shuffle` + 降 2.6s）。字体（零真衬线，初扫 "serif" 为 sans-serif 栈误报）/ 重投影（初扫正则误吞 rgba 逗号假阳，复核无新增违规）均达标。**平台美化路线图全量收口（批次 1/2/3 + 补扫）**。
- 2026-07-12 — 初版审计：24 款普查（20A/4B/0C），建立 8 维 rubric，识别 4 款 B 级重点改造对象与批次 1/2/3 路线图。待执行。
