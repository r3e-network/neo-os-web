import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    AUTH0_SECRET: z.string().min(1).optional(),
    AUTH0_BASE_URL: z.string().url().optional(),
    AUTH0_ISSUER_BASE_URL: z.string().url().optional(),
    AUTH0_CLIENT_ID: z.string().min(1).optional(),
    AUTH0_CLIENT_SECRET: z.string().min(1).optional(),
    SENDGRID_API_KEY: z.string().min(1).optional(),
    EDGE_BASE_URL: z.string().url().optional(),
    EDGE_RPC_ALLOWLIST: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH0_SECRET: process.env.AUTH0_SECRET,
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    EDGE_BASE_URL: process.env.EDGE_BASE_URL,
    EDGE_RPC_ALLOWLIST: process.env.EDGE_RPC_ALLOWLIST,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
