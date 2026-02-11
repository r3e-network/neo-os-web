import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Core infrastructure — required in production, optional in dev
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    // Third-party integrations
    SENDGRID_API_KEY: z.string().min(1).optional(),
    SENDGRID_FROM_EMAIL: z.string().email().optional(),
    EDGE_BASE_URL: z.string().url().optional(),
    EDGE_RPC_ALLOWLIST: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    // Admin auth
    ADMIN_CONSOLE_API_KEY: z.string().min(1).optional(),
    ADMIN_API_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    // SECURITY: NEXT_PUBLIC_ADMIN_* removed — admin secrets must never be
    // bundled into client-side JS. Use server-only ADMIN_CONSOLE_API_KEY /
    // ADMIN_API_KEY instead.
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    EDGE_BASE_URL: process.env.EDGE_BASE_URL,
    EDGE_RPC_ALLOWLIST: process.env.EDGE_RPC_ALLOWLIST,
    ADMIN_CONSOLE_API_KEY: process.env.ADMIN_CONSOLE_API_KEY,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // NEXT_PUBLIC_ADMIN_* entries removed (see client schema comment above)
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
