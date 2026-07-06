# MiniAppHomeShell Integration — flappy-dash

## 概述

将 v4 设计语言的 MiniAppHomeShell 首页组件集成到 `flappy-dash` 小程序中，替代原有的空闲状态界面。

## 修改文件

| 文件 | 改动 |
|------|------|
| `apps/flappy-dash/src/PlayArea.tsx` | 添加 MiniAppHomeShell 条件渲染 + mySolves 状态绑定 |
| `apps/flappy-dash/src/locale/messages.ts` | 新增 28 个中英文首页文案 |

## 集成逻辑

```
gameStatus === "idle" && !showLobby
  → 渲染 MiniAppHomeShell（精美首页）
  → 用户点击"开始游戏" → setShowLobby(true)
  → 进入原有难度选择界面 → 启动游戏

游戏结束 (solved/expired)
  → useEffect 自动 setShowLobby(false)
  → 用户返回首页看到更新后的统计数据
```

## 数据映射

| MiniAppHomeShell Props | 数据来源 |
|------------------------|---------|
| stats (奖池/赢取/通关/排名) | poolFree / myTotalWon / mySolves / myRank |
| leaderboard (Top 10) | leaderboard observable |
| features (TEE/难度/排行) | 静态描述文案 |
| hero (图标/标题/描述) | 静态营销文案 |
| CTA (按钮/信任徽章) | 静态文案 + onPrimaryClick 回调 |

## 构建验证

```
✓ 3541 modules transformed
✓ built in 1.59s
0 TypeScript errors
```

## 首页组件特性

- 滚动入场动画（IntersectionObserver）
- 统计数字计数动画（easeOutExpo）
- 功能卡片 3D 倾斜效果（鼠标跟随）
- 按钮水波纹效果
- 排行榜前三名特殊高亮
- Hero 图标浮动动画 + 徽章闪光效果
