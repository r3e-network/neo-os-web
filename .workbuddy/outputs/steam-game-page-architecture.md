# Steam-Style Unified Game Page — Architecture

## 核心设计理念

为所有 `shell: "game"` 类型小程序提供统一的 Steam 风格首页，类似于点击 Steam 游戏后看到的页面：
游戏简介、用户数据、排行榜、评论、玩法说明、设置等 —— 全部由平台自动渲染。

**零代码接入**：小程序开发者只需在 manifest 中配置 `gamePage` 段即可获得完整首页。

## 三层架构

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: MiniAppManifest.gamePage (声明式配置)       │
│   - 小程序在 manifest 中声明 gamePage 元数据         │
│   - hero、features、CTA、trust badges 等             │
├─────────────────────────────────────────────────────┤
│ Layer 2: GameHomePageWrapper (MiniAppRoot 自动集成) │
│   - 检测 shell=="game" && gamePage 存在             │
│   - 从 observables 读取实时数据 (stats/leaderboard)  │
│   - 管理 home ↔ game 状态切换                       │
├─────────────────────────────────────────────────────┤
│ Layer 3: GameHomePage (增强版首页组件)              │
│   - 基于 MiniAppHomeShell + 规则预览等              │
│   - 优美的动画效果（滚动、计数、3D 倾斜、水波纹）    │
└─────────────────────────────────────────────────────┘
```

## 修改文件

| 文件 | 改动 |
|------|------|
| `apps/shared/types/miniapp-manifest.ts` | 新增 `GamePageConfig`、`GamePageFeature` 类型；`MiniAppManifest` 新增 `gamePage?: GamePageConfig` |
| `apps/shared/components-react/GameHomePage.tsx` | **新建** — 增强版首页，继承 MiniAppHomeShell + rules 预览 |
| `apps/shared/components-react/index.ts` | 导出 GameHomePage |
| `apps/shared/react/MiniAppRoot.tsx` | 新增 `GameHomePageWrapper` 组件 + 自动集成逻辑 |
| `apps/shared/components-react/MiniAppHomeShell.tsx` | 修复 IntersectionObserver `entry` 可能为 undefined |

### flappy-dash（示例改造）

| 文件 | 改动 |
|------|------|
| `apps/flappy-dash/src/manifest.ts` | 新增 `gamePage` 配置段；stats 更新为首页需要的指标 |
| `apps/flappy-dash/src/PlayArea.tsx` | 移除手动 MiniAppHomeShell 集成（平台自动处理） |

## 接入新游戏只需 2 步

**Step 1**: 在 `manifest.ts` 中添加 `gamePage` 配置
```typescript
gamePage: {
  appIcon: "🎲",
  categoryColor: "#F59E0B",
  heroBadgeKey: "homeBadge",
  heroTitleKey: "homeTitle",
  heroDescKey: "homeDesc",
  primaryLabelKey: "startAction",
  features: [...],
  ctaTitleKey: "homeCtaTitle",
  ctaDescKey: "homeCtaDesc",
  trustBadgeKeys: ["homeTrustBadge1", "homeTrustBadge2"],
}
```

**Step 2**: 在 `messages.ts` 中添加对应的 i18n 文案

## 首页内容结构

```
┌─────────────────────────────────────┐
│ 🐦 Hero (icon, badge, title, desc) │
│    [开始游戏]  [玩法说明]           │
├─────────────────────────────────────┤
│ 📊 Stats Row (4列实时数据)          │
├─────────────────────────────────────┤
│ 📝 Features Grid (大卡+小卡网格)    │
├─────────────────────────────────────┤
│ 🏆 Leaderboard (Top 10)            │
├─────────────────────────────────────┤
│ 📖 Rules Preview (可折叠)           │
├─────────────────────────────────────┤
│ 🎯 CTA + Trust Badges              │
├─────────────────────────────────────┤
│ [平台渲染: Comments/评论区]         │
│ [平台渲染: Docs/文档区]             │
└─────────────────────────────────────┘
```

## 构建验证

```
✓ tsc --noEmit: 0 errors
✓ vite build: 3542 modules, 1.59s
✓ 完整的 TypeScript 类型安全
```
