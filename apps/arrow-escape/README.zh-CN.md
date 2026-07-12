# 花园箭坊

花园箭坊是一款访客优先的 Phaser 3 箭头依赖解谜游戏。每枚箭头占据
2–4 个格子；只有箭头前方到棋盘边缘的逃逸射线上不存在其他箭头时，
它才能离开。生成器会拒绝循环依赖，并为每个公开种子保存完整的可解
顺序见证。

## 玩法与控制

1. 点击前方路径畅通的箭头。
2. 箭头逃离后会释放新的路径。
3. 点击被阻挡的箭头会回弹，并消耗 3 枚护盾中的 1 枚。
4. 在 2 分钟内清空棋盘即可获胜。

移动端支持点击、双指缩放和平移；桌面端支持鼠标滚轮和平移。界面还
提供暂停、同种子重玩、新种子开局、缩放滑杆、音效偏好、键盘快捷键
以及减少动态效果适配。

## 确定性与恢复

- `SeededRandom` 是关卡生成唯一的随机源。
- 每个 9×12 关卡用 36–42 枚箭头覆盖全部格子。
- 生成器构建箭头依赖图并拒绝任何有环布局。
- `solveLevel` 生成解法见证，`verifyWitness` 会完整重放校验。
- 存档只保存种子、合法移除历史、护盾和已结算时间，不信任客户端
  自报的“已完成”状态；恢复时会重建关卡并逐步验证历史。
- 页面隐藏、刷新或正常卸载会先结算并暂停前台计时；玩家明确继续后
  才会恢复，后台墙钟时间不会被重复计算。

## 访客模式与 GameFi 边界

当前完整玩法为本地访客模式，不要求连接钱包。Manifest 不开放支付、
交易、预言机、VRF、TEE、Token 或奖励操作。在真实部署合约与服务获得
生产证据之前，这些 GameFi 能力保持关闭，界面也不会伪造奖励结果。

## 上游参考与许可说明

机制研究参考了 `IcedSoul/minigame-everyday` 的 Day 03 Arrow，审计提交为
`73bb72fa6b144148fc7c7e93c83ffd47f3d9f173`。上游 README 声明 MIT，
但该提交没有独立的 `LICENSE`、`NOTICE` 或逐图片来源清单，因此本应用
没有复制其代码或美术；规则引擎、Phaser 场景、React 桥接和全部运行时
图片均为独立实现。完整来源映射见 [ATTRIBUTION.md](./ATTRIBUTION.md)。

## 开发与验证

```bash
# 本地开发与生产构建
npm --prefix apps/arrow-escape run dev
npm --prefix apps/arrow-escape run build

# 类型与局部 lint
npx tsc -p apps/arrow-escape/tsconfig.json --noEmit
npx eslint apps/arrow-escape/src \
  apps/shared/test/arrow-escape.engine.test.ts \
  apps/shared/test/arrow-escape.playarea.test.tsx

# 确定性引擎与 PlayArea 直接测试
cd apps/shared
npx vitest run test/arrow-escape.engine.test.ts \
  test/arrow-escape.playarea.test.tsx
```

