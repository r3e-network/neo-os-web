# 果园漏斗

果园漏斗是一款按生产标准重构的 Phaser 3 果园配对游戏。玩家直接操作精心绘制的水果，而不是填写参数表单：点击六条果藤最前面的水果，看它沿木质漏斗滚入七格果篮，并避免果篮溢出。

## 游戏规则

- 每个种子恰好生成 48 个水果：六条果藤各 8 个，每种水果各 4 对。
- 点击果藤时，只会放下该列最前面的水果。
- 这是相邻**成对消除**，不是三消：漏斗末端最新相邻的两个同类水果会立即一起消失。
- 清除全部 24 对即获胜；未消除水果达到 7 个即失败；每局限时 4 分钟。
- 每个新种子都带有一条构造式零溢出解法。点击“提示”后，游戏会对当前局面运行带边界的记忆化求解器；只有证明能够完成且不会溢出的操作才会高亮。如果无法证明，界面会如实建议撤回或开启新果园。

## 操作与恢复

- 触控/鼠标：点击最前面的水果，或使用紧凑的“撤回”“提示”“暂停”按钮。
- 键盘：`1`–`6` 放下对应果藤，`H` 提示，`U` 撤回，`P` 或空格暂停，`R` 开启新果园。
- 最多保存 5 步撤回状态；撤回只恢复盘面和得分，绝不会倒退计时。
- 页面离开可视区域时自动暂停；刷新后，进行中的一局会以暂停状态安全恢复，不会扣除后台时间。
- 本地存储不可用或数据被篡改时，会安全拒绝坏数据并创建新的可解盘面。
- 动效遵循系统“减少动态效果”设置，声音由 Phaser 宿主统一控制。

## 仅游客模式边界

当前版本明确强制游客模式，不暴露钱包、支付、奖励、预言机、随机数权限、合约操作、交易或 GameFi 结算状态。只有真实合约路径完成部署并经过端到端验证后，才可以开放这些能力。

## 美术与参考边界

全部运行时美术均为果园漏斗专门生成的原创 ImageGen 资源。公开参考只用于研究六列放果几何关系和相邻配对机制；未复制参考代码、截图、Canvas 架构或来源不明的美术。详情见 [public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md)。

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

需要验证放果、可验证配对、七格溢出、撤回恢复、暂停/继续、刷新恢复、声音、减少动态效果，以及 390×844 和桌面布局。
