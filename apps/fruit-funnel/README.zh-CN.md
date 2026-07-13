# 果园漏斗

果园漏斗是一款按生产标准打造的 Phaser 3 物理水果合成游戏。玩家直接操作精心绘制的水果，而不是填写参数表单：在顶部水平移动下一个水果并松手放下，看真实重力把它堆进漏斗，两个同级水果相撞即合成更高一级——同时别让果堆在顶部警戒线上方静止。

## 游戏规则

- 在顶部水平移动当前水果并松手即可放下；只有最小的五种水果会被放下。
- 物理是真实的 Matter.js 模拟：水果受重力下落、碰撞并堆叠。两个同级水果接触即合成更高一级，并沿十一级进化链（樱桃 → 西瓜）累积得分。
- 连锁合成得更高分；两个西瓜合并并清除可获得额外奖励。
- 当静止的果堆越过顶部警戒线并超过短暂宽限期时，本局结束。本地最佳分会在各局之间保留。

## 操作与恢复

- 触控/鼠标：拖动瞄准顶部，点击放下。紧凑的“暂停”“新游戏”按钮始终可用。
- 键盘：方向键或 `A`/`D` 移动瞄准，空格或回车放下，`P` 暂停，`R` 开新游戏。
- 棋盘（而非物理场景）是唯一真相来源并本地存档，刷新后进行中的一局会以暂停状态精确恢复当前果堆，不会扣除后台时间。
- 本地存储不可用或数据被篡改时，会安全拒绝坏数据并创建新的一局。
- 动效遵循系统“减少动态效果”设置，声音由 Phaser 宿主统一控制。

## 仅游客模式边界

本游戏完全在本地运行，并明确强制游客模式，不暴露钱包、支付、奖励、预言机、随机数权限、合约操作、交易或 GameFi 结算状态。只有真实合约路径完成部署并经过端到端验证后，才可以开放这些能力。

## 美术与参考边界

全部运行时美术均为果园漏斗专门生成的原创 ImageGen 资源：真实的果园背景与手工生成的水果贴图。公开参考只用于研究放下与合成的物理机制；未复制参考代码、截图、Canvas 架构或来源不明的美术。面向用户的名称为原创，未复用任何第三方产品名称。详情见 [public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md)。

## 验证

在仓库根目录运行：

```bash
npm --prefix apps/fruit-funnel run build
npx tsc -p apps/fruit-funnel/tsconfig.json --noEmit
npx eslint apps/fruit-funnel/src apps/shared/test/fruit-funnel*.test.ts
(cd apps/shared && npx vitest run test/fruit-funnel.engine.test.ts test/fruit-funnel.storage.test.ts test/fruit-funnel.browser-entry.test.ts test/fruit-funnel.production.test.ts test/fruit-funnel.phaser-playarea.test.tsx test/fruit-funnel.scene.test.ts test/fruit-funnel.scene-runtime.test.ts test/minigame-everyday-migrations.production.test.ts)
jq empty apps/fruit-funnel/neo-manifest.json
```

视觉验收：

```bash
npm --prefix apps/fruit-funnel run dev -- --port 5342
```

需要验证放下、合成、连锁合成、警戒线游戏结束、暂停/继续、刷新恢复、声音、减少动态效果，以及 390×844 和桌面布局。
