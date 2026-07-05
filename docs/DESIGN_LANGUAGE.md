# Neo MiniApps — 设计语言规范 v4

> 面向终端消费者的 Web3 小程序平台。目标风格：**温暖、明亮、极简、有呼吸感**。
> 品牌色 `#16C784`（Neo Green）必须克制使用——它是指示色，不是主色调。

---

## 一、设计原则

### 1. 呼吸感第一 (Breathe)
留白比内容更重要。每个元素的周围空间至少是元素本身尺寸的 1/2。
**反例**：卡片之间 8px 间距 → **正解**：卡片之间 ≥ 24px 间距。

### 2. 克制用色 (Restrained Color)
一屏之内，品牌绿 `#16C784` 出现不超过 **3 处**（按钮、图标点缀、分割线高亮）。
**主视觉由暖灰 + 白构建**，色彩只用于指引和强调。

### 3. 一字千金 (Typography-First)
字体的层级、字重、行高必须精确。信息架构通过字体方向表达，不通过颜色堆砌。
**反例**：用颜色区分标题 → **正解**：用字重 + 字号 + 间距区分标题。

### 4. 单层深度 (Single Elevation)
整个界面只有三层：背景 → 卡片 → 浮动元素。不做多层阴影嵌套。
卡片阴影极淡（几乎是氛围光），hover 时微微上浮 2px。

### 5. 动效为功能服务 (Motion with Purpose)
所有动效时长 150–250ms，只用于：hover 反馈、页面过渡、加载状态。
**不做**：弹跳、旋转、脉冲动画。这些是玩具感来源。

---

## 二、色彩系统

### 角色划分

| 角色 | 用途 | 占比 |
|------|------|------|
| **Canvas（画布）** | 页面背景 | 70% |
| **Surface（表面）** | 卡片、面板、导航栏 | 25% |
| **Brand（品牌指示）** | 按钮、链接、图标高亮、分割线 | 3% |
| **Accent（强调）** | 数据高亮、徽章、标签 | 2% |

### 完整色板

```
┌─ Canvas ─────────────────────────────────────────┐
│  canvas-primary       #FAF9F7   页面主背景（暖白）     │
│  canvas-secondary     #F4F2EF   次级区域/微差背景      │
│  canvas-tertiary      #EEECE9   Hero 底部装饰带        │
├─ Surface ────────────────────────────────────────┤
│  surface-primary      #FFFFFF   主卡片/导航栏          │
│  surface-secondary    #F8F7F5   次级面板               │
│  surface-hover        #F1EFEC   卡片 hover 背景        │
├─ Border ─────────────────────────────────────────┤
│  border-primary       #E8E6E1   卡片边框（默认）       │
│  border-secondary     #E0DDD7   分割线                 │
│  border-strong        #D4D0C9   输入框边框             │
├─ Ink（文字墨色）─────────────────────────────────┤
│  ink-primary           #1A1A19   正文/标题（接近纯黑）  │
│  ink-secondary         #5C5A56   次要文字               │
│  ink-tertiary          #8B8984   辅助文字/placeholder  │
│  ink-inverse           #FFFFFF   深色底上文字           │
├─ Brand ──────────────────────────────────────────┤
│  brand-primary         #16C784   主品牌绿               │
│  brand-hover           #0EA371   hover 加深            │
│  brand-light           #E8F8F1   品牌绿极浅背景         │
│  brand-subtle          #C5F0DD   品牌绿标签/徽章背景    │
├─ Semantic ───────────────────────────────────────┤
│  success               #22C55E   成功（微偏黄绿）       │
│  warning               #F59E0B   警告                  │
│  error                 #EF4444   错误                  │
│  info                  #3B82F6   信息                  │
├─ Category Accent ────────────────────────────────┤
│  cat-game              #F59E0B   游戏（暖琥珀）         │
│  cat-defi              #3B82F6   DeFi（蓝）            │
│  cat-nft               #8B5CF6   NFT（紫）             │
│  cat-tool              #06B6D4   工具（青）             │
│  cat-social            #EC4899   社交（粉）             │
│  cat-governance        #6366F1   治理（靛）             │
└───────────────────────────────────────────────────┘
```

### 使用铁律

- **品牌绿不出现在大面积背景中**。品牌绿背景 = 廉价感。
- **Canvas 和 Surface 之间必须有可感知的色差**。如果屏幕校准差看不出差异，至少保证卡片有边框 `border-primary`。
- **文字颜色只用 ink-primary / ink-secondary / ink-tertiary**，禁止用品牌绿写正文。
- **分类色彩只用在小徽标或图标上**，面积 ≤ 16×16px 或等价的微型色块。

---

## 三、字体系统

### 字体选择

```
主字体：'Inter', -apple-system, BlinkMacSystemFont, sans-serif
等宽字体（地址/代码）：'JetBrains Mono', 'Fira Code', monospace
```

**为什么是 Inter？** 它在 12-14px 小字号下可读性极佳，x-height 高、字怀大，天然适合 UI 场景。

### 字号阶梯（严格遵循）

| Token | 字号 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| `text-hero` | 48px / 3rem | 1.1 | 700 | Hero 主标题（仅首页） |
| `text-hero-sub` | 20px / 1.25rem | 1.5 | 400 | Hero 副标题 |
| `text-display` | 36px / 2.25rem | 1.2 | 700 | 页面大标题 |
| `text-heading` | 24px / 1.5rem | 1.3 | 600 | 区域标题 |
| `text-subheading` | 18px / 1.125rem | 1.4 | 600 | 卡片标题 |
| `text-body` | 16px / 1rem | 1.6 | 400 | 正文 |
| `text-body-sm` | 14px / 0.875rem | 1.5 | 400 | 次要信息、列表项 |
| `text-caption` | 12px / 0.75rem | 1.4 | 500 | 辅助文字、标签 |
| `text-micro` | 10px / 0.625rem | 1.3 | 600 | 极小标签（大写） |

### 排版规则

1. **标题下方间距 = 标题字号 × 0.5**。例如 24px 标题下方 12px 间距。
2. **段落间距 = 正文字号 × 1.0**。例如 16px 正文段落间 16px。
3. **行宽 ≤ 72 字符**（约 640px）。超过则换行或截断。
4. **数字和金额用等宽字体 + tabular-nums**，确保对齐。
5. **禁止在正文中使用 700 字重**。700 仅用于标题。

---

## 四、间距系统

### 8px 基础网格

所有间距值必须是 4 的倍数。推荐使用以下间距：

```
4px   — 微型间距：icon 与文字之间
8px   — 小组件内间距：按钮内边距、标签间距
12px  — 紧凑间距：卡片内元素之间
16px  — 基础间距：卡片 padding、列表项间距
24px  — 舒适间距：区块之间、卡片之间
32px  — 分区间距：大区域之间
48px  — 页面间距：Hero 底部、大区域分隔
64px  — 极大间距：页面顶部/底部留白
80px  — Hero 上下留白
```

### 容器宽度

```
移动端（< 640px）：  100% 宽度，padding 16px
平板（640-1024px）：  max-width 640px，padding 24px
桌面（1024-1280px）： max-width 1024px，padding 32px
大屏（≥ 1280px）：    max-width 1152px（12 列网格），padding 48px
```

### 卡片规范

```
卡片圆角：12px（大卡片）、8px（小卡片/按钮）
卡片内边距：24px（标准）、16px（紧凑）
卡片间距：24px（网格布局）
卡片边框：1px solid --border-primary
卡片阴影：0 1px 3px rgba(0,0,0,0.04)  （极淡，仅氛围）
卡片 hover：translateY(-2px) + 阴影加深至 0 4px 12px rgba(0,0,0,0.06)
```

---

## 五、布局原则

### 非对称黄金分割

**不要**使用均分网格（3/2/2/2 等分 = 呆板）。推荐：

- **Hero 区域**：左文字 40% + 右视觉 60%（桌面端）
- **卡片网格**：使用 `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`，让卡片自然流动
- **精选区**：一个大卡片占 2 倍宽度 + 两个小卡片 → 2:1:1 节奏
- **CTA 区**：中央聚焦，max-width 560px

### 视觉节奏

页面向下滚动时，区域之间要有明确的「呼吸停」：

```
Hero（大留白）
  ↓ 80px 空白
分类导航（紧凑）
  ↓ 64px 空白
精选内容（中密度）
  ↓ 48px 空白
全量列表（高密度）
  ↓ 64px 空白
CTA（聚焦）
  ↓ 80px 空白
Footer
```

### 导航栏

```
高度：56px（移动端）、64px（桌面端）
位置：sticky top-0
背景：surface-primary + backdrop-blur(12px)
透明度：bg-white/85（85% 不透明 + 12px 毛玻璃）
底部边框：1px solid --border-primary（仅滚动后出现）
```

---

## 六、按钮规范

### 三种层级

```
┌─ Primary ──────────────────────────────────────────┐
│ 背景：brand-primary (#16C784)                       │
│ 文字：white，字重 600                                │
│ 圆角：10px                                          │
│ 内边距：10px 20px（默认）、8px 16px（小号）           │
│ hover：brand-hover (#0EA371)，translateY(-1px)      │
│ shadow：0 2px 8px rgba(22,199,132,0.25) hover 时    │
│                                                     │
│ ★ 一屏内 Primary 按钮最多出现 1 次                   │
└─────────────────────────────────────────────────────┘

┌─ Secondary ────────────────────────────────────────┐
│ 背景：transparent                                   │
│ 文字：ink-primary，字重 500                          │
│ 边框：1px solid --border-strong                     │
│ 圆角：10px                                          │
│ hover：bg-surface-hover, border-ink-secondary       │
│                                                     │
│ ★ 用于「次要操作」：取消、查看更多、返回              │
└─────────────────────────────────────────────────────┘

┌─ Ghost ────────────────────────────────────────────┐
│ 背景：transparent                                   │
│ 文字：ink-secondary，字重 500                        │
│ hover：text-ink-primary, bg-surface-hover           │
│                                                     │
│ ★ 用于「低调操作」：图标按钮、标签操作、工具栏        │
└─────────────────────────────────────────────────────┘
```

### 按钮层级使用规则

任何视图内，按钮层级分布应为：
- 1 个 Primary（主导操作）
- 0-2 个 Secondary（次要操作）  
- N 个 Ghost（辅助/图标操作）

**禁止**两个 Primary 按钮并排。如果确实需要两个同等重要的操作，都用 Secondary。

---

## 七、输入框规范

```
高度：40px（标准）、36px（紧凑）
圆角：10px
边框：1px solid --border-strong
背景：white
内边距：0 12px
placeholder 颜色：ink-tertiary

focus：
  边框色 → brand-primary
  外发光 → 0 0 0 3px rgba(22,199,132,0.12)

error：
  边框色 → error
  外发光 → 0 0 0 3px rgba(239,68,68,0.12)
```

搜索框特殊处理：
- 圆角拉满：`border-radius: 20px`（胶囊形）
- 背景：`surface-secondary`（比白稍暗，暗示可输入）
- 左侧搜索图标 16px，颜色 ink-tertiary
- focus 时背景变白

---

## 八、图标规范

```
图标库：Lucide Icons（https://lucide.dev）
尺寸：16px（文字旁）、20px（独立图标按钮）、24px（导航/功能图标）
颜色：默认 ink-secondary，hover/accent 时用语义色
点击区域：至少 40×40px（移动端 44×44px）
```

---

## 九、数据展示规范

### 统计卡片

```
┌──────────────────────────┐
│ 标签（text-caption,       │
│       ink-tertiary）      │
│                           │
│ 数值（text-display,       │
│       ink-primary, 700）   │
│                           │
│ 变化趋势（text-caption,    │
│           success/error）  │
└──────────────────────────┘

统计卡片内边距：24px
统计卡片间距：16px（1 行内）、24px（多行间）
数值和标签之间间距：8px
```

### 表格

```
表头：text-caption, ink-tertiary, 大写, 字重 600
  背景：surface-secondary
  高度：40px
  文字对齐：左对齐（数值列右对齐）

行：text-body-sm, ink-primary
  高度：48px
  底部边框：1px solid border-primary
  hover：bg-surface-hover

斑马纹：不需要。hover + 细线已足够区分。
```

---

## 十、暗色模式

暗色模式不是简单的颜色反转。核心原则：**暗色模式下的层次感通过亮度微差表达，而非阴影**。

```
Canvas：     #0D0D0C  （接近纯黑，但不刺眼）
Surface：    #1A1A18  （卡片表面）
Border：     #2A2A27  （边框，极微弱）
Ink：        #EDEDEB  （正文，不高对比纯白）
  secondary: #9B9994
  tertiary:  #6B6964
Brand：      保持 #16C784（绿色在暗底上更鲜艳，可能需微调为 #19D894）
```

暗色模式下：
- 阴影全部消失，改由 1px 边框区分层次
- 卡片 hover 效果改为背景微亮 +2%
- 品牌绿在暗底上视觉冲击力翻倍 → 需要更克制使用

---

## 十一、动效规范

```
hover 过渡：150ms ease-out
页面元素出现：200ms ease-out，依次 stagger 50ms（前 5 个元素）
模态打开：200ms ease-out，从 scale(0.96)+opacity(0) 到 scale(1)+opacity(1)
模态关闭：150ms ease-in，反向
路由过渡：200ms ease-out，页面淡入 + 上移 8px
骨架屏：闪烁 1.5s ease-in-out infinite（亮度在 bg-surface-secondary ↔ bg-surface-hover 之间）
```

**禁止**：
- 超过 300ms 的动效（用户不想等）
- spring / bounce 缓动（玩具感）
- 连续动画（loading spinner 除外）

---

## 十二、设计检查清单（Agent 自查用）

在提交任何界面代码前，逐项确认：

- [ ] 品牌绿 `#16C784` 一屏内不超过 3 处
- [ ] Primary 按钮一屏内只有 1 个
- [ ] 所有间距值是 4 的倍数
- [ ] 卡片有 1px 边框 + 极淡阴影
- [ ] 文字颜色只用了 ink-primary / ink-secondary / ink-tertiary
- [ ] 正文行宽不超过 72 字符
- [ ] 标题用 600/700 字重，正文用 400
- [ ] 卡片间间距 ≥ 24px
- [ ] 页面顶部留白 ≥ 64px（Hero ≥ 80px）
- [ ] 暗色模式下阴影已移除，改边框区分层次
- [ ] 所有可点击元素有 hover 状态（150ms 过渡）
- [ ] 移动端按钮点击区域 ≥ 44×44px

---

## 附录：参考设计风格

本设计语言借鉴了以下审美方向：

- **Linear** — 字体层次、极简工具栏、暗色模式
- **Vercel** — 暖色背景、卡片边框、hero 留白
- **Stripe** — 按钮圆角、颜色克制、渐进式信息展示
- **Apple Design** — 毛玻璃导航、微动效、阴影深度

---

> **此文档为唯一设计真相来源。任何界面实现若与此冲突，以本文档为准。**
