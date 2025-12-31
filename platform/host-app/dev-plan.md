# 开发计划：修复 MiniApp 卡片数据

## 🎯 目标

将 MiniApp 卡片从静态模拟数据迁移到真实链上数据，重点解决：

1. NeoBurger APR 和质押 NEO 数据不正确
2. 多个卡片 Banner 数据为空
3. 统计数据使用硬编码值

## 📊 问题分析

### 当前架构

```
lib/app-highlights.ts          → 静态硬编码数据 (问题根源)
lib/card-data/real-data.ts     → 链上数据获取 (仅部分 App)
hooks/useCardData.ts           → 卡片数据 Hook
pages/api/neoburger-stats.ts   → NeoBurger API (有 fallback mock)
```

### 问题点

| 文件                           | 问题                          | 影响                   |
| ------------------------------ | ----------------------------- | ---------------------- |
| `lib/app-highlights.ts`        | 所有 highlights 都是硬编码值  | 64 个 App 显示假数据   |
| `lib/card-data/real-data.ts`   | APP_CONTRACTS 只映射 8 个合约 | 56 个 App 无法获取数据 |
| `pages/api/neoburger-stats.ts` | 错误时返回 mock 数据          | NeoBurger 显示假 APR   |

## 🔧 实施方案

### Phase 1: 创建动态 Highlights API

**文件**: `pages/api/app-highlights/[appId].ts`

- 根据 appId 从链上/外部 API 获取实时数据
- 支持 NeoBurger、Lottery、DeFi 等不同类型
- 缓存策略：60 秒 TTL

### Phase 2: NeoBurger 真实数据

**文件**: `lib/neoburger/client.ts`

- 调用 NeoBurger 官方 API 获取 APR
- 查询 bNEO 合约获取总质押量
- 合约地址: `0x48c40d4666f93408be1bef038b6722404d9a4c2a`

### Phase 3: 扩展合约映射

**文件**: `lib/card-data/real-data.ts`

- 添加所有 64 个 MiniApp 的合约地址
- 实现各类型数据获取函数

### Phase 4: 动态 Highlights Hook

**文件**: `hooks/useAppHighlights.ts`

- 替代静态 `getAppHighlights()`
- 支持实时刷新和错误处理

## 📁 文件变更清单

### 新增文件

1. `pages/api/app-highlights/[appId].ts` - 动态 highlights API
2. `lib/neoburger/client.ts` - NeoBurger 数据客户端
3. `hooks/useAppHighlights.ts` - 动态 highlights hook
4. `__tests__/api/app-highlights.test.ts` - API 测试
5. `__tests__/hooks/useAppHighlights.test.ts` - Hook 测试
6. `__tests__/lib/neoburger-client.test.ts` - 客户端测试

### 修改文件

1. `lib/app-highlights.ts` - 改为 fallback 配置
2. `lib/card-data/real-data.ts` - 扩展合约映射
3. `pages/miniapps/index.tsx` - 使用动态 hook
4. `components/features/miniapp/MiniAppCard.tsx` - 集成动态数据

## ⏱️ 执行顺序

1. **NeoBurger 客户端** - 解决最紧急的 APR 问题
2. **动态 Highlights API** - 统一数据获取入口
3. **扩展合约映射** - 覆盖更多 App
4. **集成到 UI** - 替换静态数据
5. **测试覆盖** - 确保 90%+ 覆盖率

## 🧪 测试策略

- 单元测试：API handlers, hooks, clients
- 集成测试：数据流端到端
- Mock 策略：外部 API 调用使用 MSW
