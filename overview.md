# 抓大鹅小游戏落地完成（B 类物理抽物版）

## 完成内容

1. **架构分析**：已彻底摸清 neo-miniapps-platform 的小游戏架构。
   - mini-app 通过 `apps/<slug>/neo-manifest.json` 被宿主扫描注册。
   - 游戏复用统一游戏框架的 **`GameBridge`**（引擎无关）：`on("state")` / `getState()` / `dispatch` / `setDispatch` / `notifyReady`，通过 `window.__phaserBridge` 注入。
   - 设计令牌用 `--mx2-*`（`mx2 mx2-cat-game`）。

2. **玩法与决策**：用户决策做 **B 类「限时物理抽物 + 托盘 3 连消除」版**（Three.js + cannon-es 真 3D 物理），匹配其提供的教程，要可上线完整版。
   - 无官方开源美术/音效资源，本作采用原创 **低多边形几何体 + emoji 兜底**（颜色对齐原版暖色调），玩法机制合法复现。

3. **新增 mini-app**：`apps/zhuada-e/`（slug: `zhuada-e`，id: `miniapp-zhuada-e`）。
   - 核心循环：物品落盒堆叠 → 点选射线抽出 → 摆进 7 槽托盘 → 凑 3 个消除 → 盒空过关、托盘满且无可消三元组或超时失败。
   - 15 关递进曲线（种类 3→12、份数 2→4、时间 **40s→230s**、盒子略增大），每种物品数恒为 3 倍数 → 永可解。
   - 纯本地免费模式（guest engine，localStorage `zhuada-e:progress`），零链上依赖。

4. **四项后续打磨已落地（v2.1）**：
   - **美术升级**：`scenes/models.ts` 原创低多边形模型库（番茄/胡萝卜/玉米/茄子/苹果/西兰花/蘑菇/洋葱/辣椒/西瓜/蛋/鱼 + 低多边形大鹅），替换 bare primitive + emoji。
   - **道具系统**：洗牌 / 提示 / 加时，限量供应（开局 shuffle:1/hint:3/addTime:1）+ 里程碑回赠（破 100 分 +1 提示、破 200 +1 加时、4 连 +1 加时）。
   - **代码分割**：场景按需动态加载，入口 `index` **213KB / gzip 67KB**，three+cannon 拆为 `ZhuaDaScene` 懒加载块（599KB/gzip 155KB）。
   - **数值调优**：`scripts/tune.mjs` 蒙特卡洛模拟，重写 15 关曲线（时间随物品数增长），贪心策略全 15 关 100% 可解。

5. **音频 + 移动端（v2.2）**：
   - **音频系统**：`logic/sound.ts` 单例 **纯合成 WebAudio 音效引擎**（振荡器 + 滤波白噪声，**零音频文件、零版权风险**）。9 种音效：land/pick/match/combo/win/fail/powerup/shuffle/click。单例共享静音态 + 首次用户手势 `unlock()` + `localStorage` 持久化静音，HUD `📢/🔇` 切换。
   - **移动端触屏适配**：`ZhuaDaScene` 改监听 `pointerdown`（覆盖鼠标/触屏/笔）；`.goose-canvas-wrap` / `.goose-three-canvas` 加 `touch-action:none` + 禁选 + 禁高亮 + `overscroll-behavior:contain`，避免触屏落点被页面滚动/下拉刷新吞掉。射线归一化用 `getBoundingClientRect()`（与 DPR 无关）。

5. **验证（全部通过）**：
   - `npm run build` 通过（入口 **218KB / gzip 69KB**，含音效引擎仅 +5KB）；`npx eslint` **0 error / 0 warning**。
   - v2.1 agent-browser 端到端验证（本环境无 Chromium/Playwright，沿用前次结论）：
     - 胜利链路 `solved`，`score: 237`，`itemsLeft: 0`；
     - 关卡递进 → `level 2` `dealt` 重生；
     - **道具全链路**：提示(hint 3→2 + nonce)、加时(time +15000)、洗牌(kinds 重排 + nonce)、里程碑回赠均生效。
   - **v2.2 音频逻辑单测**：Node + mock `AudioContext`/`localStorage` 对 `sound.ts` 跑 10 项断言（懒创建、静音门控、持久化、unlock-resume、9 种音效均不抛错、`land` 节流生效），全部 PASS。
   - `npm run stage:miniapps:dist -- zhuada-e` 已拷贝到 `platform/host-app/public/miniapps/zhuada-e/`（含懒加载场景块），catalog 已含 zhuada-e，宿主路由 `/miniapps/miniapp-zhuada-e` 可服务同一构建。

## 关键实现坑（务必保留）

- **`world.fixedStep` 不推进刚体（致命）**：cannon-es 0.20.0 下必须用 `world.step(1/60)`，否则物品悬在盒口、射线瞄错坐标。
- **生成节奏卡死**：用未钳制 `rawDt` 累加 `spawnTimer`，否则 rAF 节流下盒子永远空。
- **拾取前矩阵过期**：`onPointerDown` 内先 `camera/scene.updateMatrixWorld()` 再射线，否则首帧/headless 瞄偏。
- **关卡时间曲线数学死局**：旧 `timeMs` 随关卡收紧到 50s 但物品涨到 180 → 不可赢；蒙特卡洛调优改为时间随物品数增长（40s→230s）。

## 后续事项

1. **接链上奖励（可选）**：后续复用 `rewardGame` SDK 转排行榜/奖励，需配套合约。
2. **真实浏览器/真机复检**：headless 会暂停 rAF，3D 掉落/射线需在真机肉眼复检；本环境无浏览器自动化，音频「可听感」与触屏命中手感需真机 playtest 复检（逻辑/道具/音效引擎逻辑均已通过自动化验证）。
3. **首测微调**：`scripts/tune.mjs` 复算 + 手感测试微调重力/连击窗口/托盘槽数；关卡「好不好玩」需真人 playtest（蒙特卡洛只保证可解）。

## 文件清单

- `apps/zhuada-e/neo-manifest.json`
- `apps/zhuada-e/package.json`
- `apps/zhuada-e/vite.config.ts`
- `apps/zhuada-e/index.html`
- `apps/zhuada-e/public/logo.png` / `banner.png` / `art/`
- `apps/zhuada-e/src/main.tsx`
- `apps/zhuada-e/src/manifest.ts`
- `apps/zhuada-e/src/ThreeGameComponent.tsx`
- `apps/zhuada-e/src/PlayArea.tsx` / `PlayArea.scss`
- `apps/zhuada-e/src/locale/messages.ts`
- `apps/zhuada-e/src/scenes/ZhuaDaScene.ts`
- `apps/zhuada-e/src/logic/engine-zhuada.ts`
- `apps/zhuada-e/src/logic/game-rules.ts`
- `apps/zhuada-e/src/logic/guest-engine.ts`
- `apps/zhuada-e/src/logic/sound.ts`（v2.2 音频引擎）
- `design-prototypes/gdd-zhuada-e.md`（v2.2 B 类）
