# 分布式 MiniApp 管理系统 - 开发指南

## 概述

本系统实现了 MiniApp 开发与平台管理的完全分离：

- 外部开发者可在自己的 Git 仓库中独立开发 MiniApp
- 通过 Git URL 提交源代码进行审查
- 平台管理员手动触发构建和发布
- 内部 MiniApps 通过同一提交流程自动审批与构建（服务端校验）

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐
│ 外部开发者       │    │ 平台管理员       │
│ (Git 仓库)      │    │ (Admin Console) │
└────────┬────────┘    └────────┬────────┘
         │                      │
         ▼                      ▼
  ┌────────────────────────────────────────┐
  │         Edge Functions                 │
  │  /functions/v1/miniapp-submit          │
  │  /functions/v1/miniapp-approve         │
  │  /functions/v1/miniapp-build           │
  │  /functions/v1/miniapp-list            │
  └───────────────┬────────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────────────┐
  │          Supabase Database             │
  │  miniapp_submissions (提交)            │
  │  miniapp_registry_view (统一视图)      │
  └───────────────┬────────────────────────┘
                  │
                  ▼
  ┌────────────────────────────────────────┐
  │         Host App Discovery             │
  │  GET /functions/v1/miniapp-list        │
  └────────────────────────────────────────┘
```

## 环境变量配置

### Supabase (必需)

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=***REMOVED***
```

### CDN (构建发布需要)

```bash
CDN_BASE_URL=https://cdn.example.com
# 根据您的 CDN 提供商配置:
# R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
# S3: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
# Cloudflare: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_NAMESPACE
```

## 数据库迁移

运行以下迁移创建表结构：

```bash
# 创建外部提交表
supabase migration up --file platform/supabase/migrations/20250123_miniapp_submissions.sql

# 创建统一视图
supabase migration up --file platform/supabase/migrations/20250123_miniapp_registry_view.sql
```

## API 端点

### Edge Functions (Supabase)

| 端点                                  | 方法 | 描述                  | 认证         |
| ------------------------------------- | ---- | --------------------- | ------------ |
| `/functions/v1/miniapp-submit`        | POST | 提交 Git URL 进行审查 | 用户 + scope |
| `/functions/v1/miniapp-approve`       | POST | 审批/拒绝/请求修改    | 管理员       |
| `/functions/v1/miniapp-build`         | POST | 手动触发构建          | 管理员       |
| `/functions/v1/miniapp-publish`       | POST | 发布构建结果          | Service role |
| `/functions/v1/miniapp-list`          | GET  | Host App 发现         | 公开         |

### Admin Console API (代理)

| 端点                              | 方法     | 描述           |
| --------------------------------- | -------- | -------------- |
| `/api/admin/miniapps/submissions` | GET      | 列出外部提交   |
| `/api/admin/miniapps/approve`     | POST     | 审批操作       |
| `/api/admin/miniapps/build`       | POST     | 触发构建       |
| `/api/admin/miniapps/registry`    | GET      | 统一注册表视图 |

## 工作流程

### 1. 外部开发者提交

```bash
curl -X POST https://your-project.supabase.co/functions/v1/miniapp-submit \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "git_url": "https://github.com/username/my-miniapp",
    "branch": "main",
    "subfolder": "apps/my-app"
  }'
```

响应：

```json
{
    "submission_id": "uuid",
    "status": "pending_review",
    "detected": {
        "manifest": true,
        "assets": { "icon": ["static/icon.png"], "banner": ["static/banner.png"] },
        "build_type": "vite",
        "build_config": {
            "build_command": "npm run build",
            "output_dir": "dist",
            "package_manager": "npm"
        }
    }
}
```

### 2. 管理员审批

```bash
curl -X POST https://your-project.supabase.co/functions/v1/miniapp-approve \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "uuid",
    "action": "approve",
    "trigger_build": false,
    "review_notes": "Looks good!"
  }'
```

### 3. 触发构建

```bash
curl -X POST https://your-project.supabase.co/functions/v1/miniapp-build \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "uuid"
  }'
```

### 4. Host App 发现

```bash
curl https://your-project.supabase.co/functions/v1/miniapp-list?category=gaming
```

## 构建配置检测

系统自动检测以下构建类型：

| 类型    | 配置文件                 | 构建命令           | 输出目录        |
| ------- | ------------------------ | ------------------ | --------------- |
| Vite    | vite.config.ts           | `npm run build`    | `dist`          |
| Webpack | webpack.config.js        | `npm run build`    | `dist`          |
| uni-app | pages.json/manifest.json | `npm run build:h5` | `dist/build/h5` |
| Next.js | next.config.js           | `npm run build`    | `.next`         |
| Vanilla | package.json             | `npm run build`    | `dist`          |

## 资产检测

自动搜索以下资产文件：

| 类型       | 搜索路径                                                     |
| ---------- | ------------------------------------------------------------ |
| Icon       | `icon.png`, `logo.png`, `app-icon.png`, `static/icon.png` 等 |
| Banner     | `banner.png`, `app-banner.png`, `static/banner.png` 等       |
| Screenshot | `screenshot.png`, `preview.png` 等                           |
| Manifest   | `neo-manifest.json`, `manifest.json`, `package.json`         |

## 拒绝条件

提交将被拒绝如果：

- 包含预构建文件 (`dist/`, `build/`, `.next/` 等)
- 缺少 manifest 文件
- 构建配置无效
- Git URL 无法访问
- 分支不存在

## 状态转换

```
pending_review → approved → building → published
                              ↓
                         build_failed

pending_review → rejected
pending_review → update_requested → pending_review
```

## 管理控制台

访问 `/admin/miniapps` 查看分布式 MiniApp 管理界面：

1. **外部提交** - 查看和管理 Git 提交
2. **内部应用** - 同步和管理预构建应用
3. **注册表视图** - 查看所有已发布的应用

## 待实现功能

- [ ] CDN 上传实现 (R2/S3/Cloudflare)
- [ ] 开发者提交表单前端
- [ ] 构建日志实时查看
- [ ] 构建失败自动重试
- [ ] 提交历史版本对比
