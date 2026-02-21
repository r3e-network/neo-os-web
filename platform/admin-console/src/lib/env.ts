import { z } from "zod";
import { logger } from "@/lib/logger";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NEXT_PUBLIC_EDGE_URL: z.string().url().optional(),
  ADMIN_CONSOLE_API_KEY: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing or invalid environment variables:\n${missing}`);
    }
    logger.warn(`Environment validation warnings:\n${missing}`);
    return process.env as unknown as Env;
  }
  return result.data;
}

export const env = validateEnv();
