# Supabase Integration Guide

本项目已深度集成 Supabase，最大化利用其功能减少重复造轮子。

## 新增 Supabase 组件

| 包路径 | 功能 | 替代的自研组件 |
|--------|------|----------------|
| `pkg/supabase` | Supabase 统一客户端 | - |
| `pkg/auth` | GoTrue 认证适配器 | `applications/auth/manager.go` |
| `pkg/storage` | PostgREST CRUD 操作 | `applications/storage/postgres/store*.go` |
| `pkg/blob` | Supabase Storage 文件存储 | `applications/jam/store_pg.go` |
| `pkg/pgnotify` | 事件总线 + 表变更订阅 | `system/core/bus.go` |

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Engine    │  │   Packages  │  │   HTTP API  │          │
│  │  (Android)  │  │  (Services) │  │  (Handlers) │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              pkg/supabase (Client)             │          │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐         │          │
│  │  │  Auth   │ │ PostgREST│ │ Storage │         │          │
│  │  │(GoTrue) │ │  (CRUD)  │ │ (Blobs) │         │          │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘         │          │
│  └───────┼───────────┼────────────┼──────────────┘          │
└──────────┼───────────┼────────────┼──────────────────────────┘
           │           │            │
┌──────────┴───────────┴────────────┴──────────────────────────┐
│                  Self-Hosted Supabase                         │
│  ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌──────────┐          │
│  │ GoTrue  │ │ PostgREST │ │ Storage │ │ Realtime │          │
│  │  :9999  │ │   :3000   │ │  :5000  │ │  :4000   │          │
│  └────┬────┘ └─────┬─────┘ └────┬────┘ └────┬─────┘          │
│       └────────────┴────────────┴───────────┘                │
│                         │                                    │
│                  ┌──────┴──────┐                             │
│                  │  PostgreSQL │                             │
│                  │    + RLS    │                             │
│                  └─────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

## 环境变量配置

### 必需配置

```bash
# PostgreSQL (Supabase DB)
DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres"

# Supabase JWT
SUPABASE_JWT_SECRET="your-***REMOVED***-secret"
```

### 完整配置

```bash
# Supabase Project URL (Kong gateway)
SUPABASE_URL="http://localhost:8000"

# API Keys
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# JWT Authentication
SUPABASE_JWT_SECRET="your-***REMOVED***-secret"
SUPABASE_JWT_AUD="authenticated"
SUPABASE_ADMIN_ROLES="service_role,admin"
SUPABASE_TENANT_CLAIM="tenant_id"
SUPABASE_ROLE_CLAIM="role"

# GoTrue (Auth) URL
SUPABASE_GOTRUE_URL="http://localhost:9999"

# Storage URL
SUPABASE_STORAGE_URL="http://localhost:5000"
```

## 功能对照表

| 功能 | 之前（自研） | 现在（Supabase） |
|------|-------------|------------------|
| JWT 验证 | `applications/auth/manager.go` | GoTrue + `pkg/supabase` |
| Token 刷新 | `httpapi/handler_auth.go` | GoTrue `/token?grant_type=refresh_token` |
| 用户管理 | 手动实现 | GoTrue admin API |
| CRUD 操作 | `applications/storage/postgres/store*.go` | PostgREST via `pkg/supabase` |
| 租户隔离 | 中间件过滤 | PostgreSQL RLS 策略 |
| 事件总线 | `system/core/bus.go` | PostgreSQL NOTIFY via `pkg/pgnotify` |
| 文件存储 | JAM (bytea) | Supabase Storage |

## 使用示例

### 1. 认证

```go
import "github.com/R3E-Network/service_layer/pkg/supabase"

client, _ := supabase.New(supabase.Config{
    ProjectURL: "http://localhost:8000",
    AnonKey:    os.Getenv("SUPABASE_ANON_KEY"),
})

// 用户登录
resp, err := client.SignIn(ctx, "user@example.com", "password")
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Access Token: %s\n", resp.AccessToken)

// 刷新 Token
refreshed, err := client.RefreshToken(ctx, resp.RefreshToken)
```

### 2. PostgREST CRUD

```go
// 查询数据（自动 RLS 过滤）
var accounts []Account
err := client.From("app_accounts").
    Select("*").
    Eq("status", "active").
    Order("created_at", false).
    Limit(10).
    WithAuth(accessToken).  // 使用用户 Token，RLS 自动过滤租户
    Execute(ctx, &accounts)

// 插入数据
err = client.From("app_accounts").
    Insert(ctx, map[string]interface{}{
        "id":     uuid.New().String(),
        "owner":  "user123",
        "tenant": tenantID,  // RLS 会验证
    })

// 更新数据
err = client.From("app_accounts").
    Eq("id", accountID).
    Update(ctx, map[string]interface{}{
        "status": "inactive",
    })
```

### 3. 事件总线

```go
import "github.com/R3E-Network/service_layer/pkg/pgnotify"

bus, _ := pgnotify.NewWithDB(db, dsn)

// 订阅事件
bus.Subscribe("account.created", func(ctx context.Context, event pgnotify.Event) error {
    var payload AccountCreatedPayload
    json.Unmarshal(event.Payload, &payload)
    fmt.Printf("New account: %s\n", payload.AccountID)
    return nil
})

// 发布事件
bus.Publish(ctx, "account.created", AccountCreatedPayload{
    AccountID: "acc_123",
    TenantID:  "tenant_abc",
})
```

### 4. 文件存储

```go
// 上传文件
file, _ := os.Open("report.pdf")
defer file.Close()

err := client.UploadFile(ctx, "documents", "reports/2024/q1.pdf", file, "application/pdf")

// 下载文件
reader, err := client.DownloadFile(ctx, "documents", "reports/2024/q1.pdf")
defer reader.Close()

// 获取公开 URL
url := client.GetPublicURL("documents", "reports/2024/q1.pdf")
```

## RLS 策略

所有租户表都启用了行级安全策略：

```sql
-- 租户隔离策略
CREATE POLICY "tenant_isolation" ON app_accounts
  FOR ALL
  USING (tenant = auth.tenant_id() OR auth.is_service_role())
  WITH CHECK (tenant = auth.tenant_id() OR auth.is_service_role());
```

**关键点：**
- 普通用户只能访问自己租户的数据
- `service_role` 可以访问所有数据
- 租户 ID 从 JWT `tenant_id` claim 提取

## 迁移指南

### 从自研 Auth 迁移

```go
// 之前
token, exp, err := authManager.Issue(user, 24*time.Hour)

// 现在
resp, err := supabaseClient.SignIn(ctx, email, password)
// resp.AccessToken, resp.ExpiresAt
```

### 从手动 CRUD 迁移

```go
// 之前
_, err = s.db.ExecContext(ctx, `
    INSERT INTO app_accounts (id, owner, tenant, created_at)
    VALUES ($1, $2, $3, $4)
`, acct.ID, acct.Owner, tenant, acct.CreatedAt)

// 现在
err = client.From("app_accounts").Insert(ctx, acct)
```

### 从中间件租户过滤迁移

```go
// 之前（中间件）
func tenantFilter(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        tenant := r.Context().Value("tenant").(string)
        // 手动过滤...
    })
}

// 现在（RLS 自动处理）
// 只需在查询时传递 WithAuth(accessToken)
// PostgreSQL RLS 自动根据 JWT 中的 tenant_id 过滤
```

## 性能考虑

1. **PostgREST vs 直接 SQL**
   - PostgREST 增加 ~1-2ms 延迟
   - 复杂查询仍可使用直接 SQL
   - 简单 CRUD 使用 PostgREST 更简洁

2. **RLS 开销**
   - 每行检查增加 ~0.1ms
   - 建议在 tenant 列建索引
   - 大批量操作使用 service_role 绕过 RLS

3. **事件总线**
   - pg_notify 最大 payload: 8000 bytes
   - 大 payload 存表+发通知
   - 持久化需求使用 Supabase Realtime

## 故障排除

### JWT 验证失败

```bash
# 检查 JWT secret 配置
echo $SUPABASE_JWT_SECRET

# 解码 JWT 查看 claims
jwt decode <token>
```

### RLS 权限拒绝

```sql
-- 检查当前 tenant
SELECT auth.tenant_id();

-- 检查 role
SELECT auth.is_service_role();

-- 临时禁用 RLS 调试
ALTER TABLE app_accounts DISABLE ROW LEVEL SECURITY;
```

### PostgREST 连接问题

```bash
# 检查 PostgREST 状态
curl http://localhost:3000/

# 检查 schema cache
curl http://localhost:3000/rpc/reload_schema
```
