# Bright Geometric Sci-Fi — 平台首页重构完成

## 设计方向

**Option A: Bright Geometric Sci-Fi**
- 纯白画布 + 精密几何网格
- Neo Green #16C784 作为唯一发光主色调
- 规避 AI slop：无蓝紫渐变、无毛玻璃、无默认深色+霓虹
- 科幻感来自几何精密度和光线层次

## 实现内容

### 新文件
| 文件 | 作用 |
|------|------|
| `styles/home-sci-fi.module.css` | 18 个 sci-fi 视觉系统（64 个 CSS 类） |

### 修改文件
| 文件 | 改动 |
|------|------|
| `pages/index.tsx` | 完全注入 sci-fi 视觉，保持全部业务逻辑 |

### 视觉增强清单

| # | 系统 | 效果 |
|---|------|------|
| 1 | 几何网格背景 | 双层 48px/96px radial-mask 渐变网格 |
| 2 | 浮动六边形粒子 | 10 个 CSS clip-path hex，hexDrift 上浮 120px |
| 3 | 电路板装饰线 | 四角 L 形走线 + 连接点 dot |
| 4 | 发光网络徽章 | Neo Green border-glow + dotPulse 呼吸灯 |
| 5 | 标题阶梯入场 | 5 级 stagger（blur→clear + translateY） |
| 6 | 3D 透视 Hero 卡 | perspective 800px + 鼠标跟踪 ±8deg + 光泽叠加 |
| 7 | 分类 sci-fi pill | hover: green border + shadow; active: 绿色高亮 |
| 8 | 精选卡底部渐变 | hover: Neo Green 渐变横线 + border glow |
| 9 | 目录卡顶部 accent | 顶部绿色横线 accent + hover border glow |
| 10 | CTA 按钮 | Primary: 渐变+流光; Ghost: border glow |
| 11 | 排序切换条 | Neo Green active 高亮 |
| 12 | 搜索输入框 | Neo Green focus ring + 外发光 |
| 13 | Skeleton 加载 | 波浪微光 shimmer |
| 14 | 空状态 | 虚线绿色边框 + 淡绿背景 |
| 15 | 滚动揭示 | IntersectionObserver → 淡入上移 |
| 16 | 子元素阶梯揭示 | 9 级 animation-delay |
| 17 | reduced-motion | 完全支持，关闭所有动效 |
| 18 | 全部缓动 | cubic-bezier(0.16, 1, 0.3, 1)，≤700ms |

### 技术验证
- ✅ TypeScript: **0 errors**
- ✅ Next.js build: **成功**
- ✅ CSS 模块: 64 个 class 全部散列正确
- ✅ SSR: index.html 317KB 正确预渲染
- ✅ 所有 CSS 类名在编译产物中验证通过

### 设计约束
- 品牌绿 #16C784 一屏 ≤ 5 处（网格线、发光环、badge、CTA、横线 accent）
- 无 Inter 替换（项目既定字体，通过布局和装饰体现差异化）
- 暖白画布 #FAF9F7（遵循 .impeccable.md 品牌基调）
- 所有动效尊重 prefers-reduced-motion
