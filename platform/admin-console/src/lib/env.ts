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

type RequiredEnvKey = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY";

type SupabaseServiceEnv = {
  url: string;
  serviceRoleKey: string;
};

type GetEnvOptions = {
  strict?: boolean;
  required?: RequiredEnvKey[];
};

let warnedAboutInvalidEnv = false;

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function buildSchema(required: RequiredEnvKey[]) {
  if (required.length === 0) {
    return envSchema;
  }

  const shape = required.reduce<Record<RequiredEnvKey, true>>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {
    NEXT_PUBLIC_SUPABASE_URL: true,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
    SUPABASE_SERVICE_ROLE_KEY: true,
  });

  const pickedShape = Object.fromEntries(required.map((key) => [key, shape[key]]));
  return envSchema.pick(pickedShape as Record<RequiredEnvKey, true>);
}

export function getEnv(options: GetEnvOptions = {}): Env {
  const required = options.required ?? [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const result = buildSchema(required).safeParse(process.env);
  if (result.success) {
    return process.env as unknown as Env;
  }

  const missing = formatIssues(result.error.issues);
  if (options.strict) {
    throw new Error(`Missing or invalid environment variables:\n${missing}`);
  }

  if (!warnedAboutInvalidEnv) {
    logger.warn(`Environment validation warnings:\n${missing}`);
    warnedAboutInvalidEnv = true;
  }

  return process.env as unknown as Env;
}

export function getSupabaseServiceEnv(options: { strict?: boolean } = {}): SupabaseServiceEnv {
  const env = getEnv({ strict: options.strict, required: ["SUPABASE_SERVICE_ROLE_KEY"] });
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  const issues: string[] = [];
  if (!url) {
    issues.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required");
  } else {
    try {
      new URL(url);
    } catch {
      // Invalid URL format — record validation issue
      issues.push("Resolved Supabase URL must be a valid URL");
    }
  }

  if (!serviceRoleKey) {
    issues.push("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  if (issues.length > 0) {
    const message = `Missing or invalid Supabase service environment:\n  ${issues.join("\n  ")}`;
    if (options.strict) {
      throw new Error(message);
    }

    if (!warnedAboutInvalidEnv) {
      logger.warn(message);
      warnedAboutInvalidEnv = true;
    }
  }

  return { url, serviceRoleKey };
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== "string") {
      return undefined;
    }

    return getEnv()[prop as keyof Env];
  },
}) as Env;
