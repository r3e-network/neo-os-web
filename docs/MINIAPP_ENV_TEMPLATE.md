# MiniApp Env Template (Production)

Use this as a baseline for host-app/admin-console deployment environments.

## Host App

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Admin auth
MINIAPP_ADMIN_API_KEY=<strong-random-api-key>
MINIAPP_ADMIN_WALLETS=<walletA>,<walletB>

# Publish approval gate
MINIAPP_PUBLISH_APPROVAL_REQUIRED=true
MINIAPP_PUBLISH_REVIEWERS=<reviewerWalletA>,<reviewerWalletB>

# SLA / escalation
MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES=60
MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES=180

# Reminder webhook
MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL=https://<webhook-endpoint>

# Cron
CRON_SECRET=<strong-random-cron-secret>
HOST_APP_BASE_URL=https://<host-app-domain>
```

## Admin Console

```bash
ADMIN_CONSOLE_API_KEY=<admin-console-key>
MINIAPP_HOST_APP_BASE_URL=https://<host-app-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```
