# Neo v3 — 次世代 UI 设计方案

> **版本**: v3.0
> **日期**: 2026-07-03
> **审计范围**: Neo MiniApps Platform (host-app, admin-console, 75 miniapps)
> **设计方向**: 全面升级，保留品牌色 #16C784，温暖明亮极简主义

---

## 一、审计发现

| 优先级 | 问题 | 影响 |
|--------|------|------|
| 🔴 P0 | 首页 Hero 缺乏冲击力 — 单色渐变模板化 | 用户第一印象弱，跳出率高 |
| 🔴 P0 | 两套令牌共存 (`--ns-*` vs `--mx2-*`) | 视觉碎片化，新老小程序不一致 |
| 🟡 P1 | 导航过于简单，分类筛选不直观 | 75+ 小程序难以发现 |
| 🟡 P1 | 小程序间切换无动效 | iframe 切换有"跳转断层" |
| 🟢 P2 | 阴影保守、圆角缺乏层次、品类色彩单一 | 细节打磨空间大 |

> 完整审计报告: [docs/design-audit-2026.md](../docs/design-audit-2026.md)

---

## 二、v3 设计令牌系统

**命名空间**: `--n3-*`（独立于旧的 `--ns-*` 和 `--mx2-*`，向后兼容）

### 核心升级点

1. **暖灰白画布** — `#faf9f7` 替代冷灰 `#f4f5f7`
2. **层次化阴影** — 从 `xs` 到 `2xl`，品牌光晕单独定义
3. **分类色彩体系** — 游戏(琥珀)/DeFi(蓝)/NFT(紫)/工具(青)/社交(粉)
4. **流体排版** — `clamp()` 字号适配全设备
5. **完整动效系统** — `duration` + `easing` 函数化
6. **场景氛围变量** — PlayArea 根据分类注入微妙的色彩氛围

### 令牌文件

```
apps/shared/styles/theme-v3.css  ← Neo v3 CSS 令牌（新增，不覆盖旧文件）
platform/shared/tailwind.preset.js ← 扩展为包含 v3 色彩（待实施）
```

---

## 三、原型文件

| 文件 | 说明 |
|------|------|
| `design-prototypes/platform-homepage.html` | 平台首页 — Hero + 分类导航 + 精选推荐 + 全部小程序 + CTA |
| `design-prototypes/admin-console.html` | 管理控制台 — 仪表盘 + 侧边栏 + 数据概览 + 小程序管理表 + 动态流 |
| `design-prototypes/miniapp-template.html` | 小程序模板 — PlayArea + Tab + Stage + Controls + ActionRail + DetailDrawer |

### 原型亮点

**首页**:
- 卡片堆叠 Hero 视觉 + 浮动徽章动效
- 分类卡片网格（6 分类，每个有独立颜色氛围）
- 精选推荐大卡片（3 列，含预览图渐变）
- 全部小程序网格（4 列，简洁信息卡片）
- 深色 CTA 区域（高对比度引导行动）

**管理控制台**:
- 固定侧边栏（分区导航 + 徽章计数）
- 4 个统计卡片 + 3 个快速操作入口
- 小程序管理表格（状态徽章 + 分类标识）
- 动态信息流面板
- 筛选 tab + 搜索组合

**小程序模板**:
- 紧凑 Header（图标 + 名称 + 操作按钮）
- 分类氛围背景（场景 tint + radial gradient）
- Tab 导航（游戏/排行榜/记录）
- 居中 Stage 画布 + 得分条 + 主操作按钮
- 底部 ActionRail + DetailDrawer
- 演示了两个变体：游戏类（Color Clash）和 DeFi 类（Neo Swap）

---

## 四、迁移路径

### Phase 1: 设计令牌
- [ ] `theme-v3.css` 引入到 `apps/shared/styles/`
- [ ] Tailwind 预设扩展 v3 色彩
- [ ] 旧令牌保留不变，新小程序 opt-in 使用 v3

### Phase 2: 平台首页
- [ ] Hero 区域重设计（卡片堆叠 + 浮动徽章）
- [ ] 分类卡片重设计（6 分类独立色彩）
- [ ] 精选推荐大卡片布局
- [ ] 深色 CTA 区域

### Phase 3: 管理控制台
- [ ] 侧边栏分区导航 + 徽章
- [ ] 仪表盘统计卡片
- [ ] 快速操作入口
- [ ] 动态流面板

### Phase 4: 小程序模板
- [ ] PlayArea 场景氛围系统
- [ ] ActionRail + DetailDrawer 组件
- [ ] 分类色彩场景注入

### Phase 5: 暗色模式完善
- [ ] 所有 prototype 已包含暗色模式变量
- [ ] 需要针对每个小程序逐个适配

---

## 五、与现有设计系统的关系

```
Neo Soft v1 (--ns-*)     →  现有 75 个小程序继续使用
MiniApp OS v2 (--mx2-*)  →  部分新小程序使用
Neo v3 (--n3-*)          →  本次设计，增量引入，opt-in
```

三个系统可以共存。新设计的小程序使用 v3，老小程序不受影响。

---

**UI Designer** | 2026-07-03
