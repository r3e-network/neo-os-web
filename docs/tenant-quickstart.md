# Tenant Quickstart

Multi-tenant enforcement is enabled across the API, stores, and dashboard. Use this quickstart to get a working tenant-scoped setup locally or in staging.

## Prerequisites
- `make run` (or `docker compose up --build`) to start Postgres, appserver, and dashboard.
- Defaults: API `http://localhost:8080`, dashboard `http://localhost:8081`, site `http://localhost:8082`, token `dev-token`, admin login `admin/changeme` (JWT).

## 1) Create an account with a tenant
All resources hang off an account. Set the tenant via metadata:
```bash
curl -X POST http://localhost:8080/accounts \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-a" \
  -d '{"owner":"demo","metadata":{"tenant":"tenant-a"}}'
```
Note: API calls must include both the tenant header and a token/JWT. The server rejects tenant-scoped resources when `X-Tenant-ID` is missing or mismatched.

## 2) Use the dashboard with the tenant prefilled
- Open `http://localhost:8081/?baseUrl=http://localhost:8080&tenant=tenant-a`.
- Set the token (`dev-token` or a JWT from `/auth/login`).
- Account cards show both the account tenant and your active tenant. A warning appears if they differ.

## 3) CLI with tenant
`slctl` sends the tenant when `--tenant` (or `SERVICE_LAYER_TENANT`) is set:
```bash
SERVICE_LAYER_TOKEN=dev-token SERVICE_LAYER_TENANT=tenant-a \
slctl accounts list
```

## 4) Common tenant errors
- `403 forbidden: tenant required` → send `X-Tenant-ID`.
- `403 forbidden: tenant mismatch` → header tenant does not match the account’s tenant.
- Dashboard shows “Active tenant: none” when unset; set it in Settings to avoid 403s.

## 5) Schema safety
On startup the server verifies tenant columns exist (migrations `0024`/`0025`). If a legacy schema is used, startup fails with an explicit error; run migrations then retry.

## 6) Defaults and tokens
Local defaults are for development only. Override `API_TOKENS`, `AUTH_USERS`, and `AUTH_JWT_SECRET` for any shared/staging/production deployment.

## Ports (compose defaults)
- API: `8080`
- Dashboard: `8081`
- Site: `8082`
- Postgres: `5432`
