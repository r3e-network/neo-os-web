import { z } from "zod";

// Analytics response schemas
export const usageRowSchema = z.object({
  gas_used: z.number().optional().default(0),
});

export const usageOverTimeRowSchema = z.object({
  usage_date: z.string(),
  gas_used: z.number().default(0),
});

export const usageByAppRowSchema = z.object({
  app_id: z.string(),
  gas_used: z.number().default(0),
  tx_count: z.number().optional().default(0),
});

// Services health response schema
export const healthResponseSchema = z.object({
  version: z.string().optional(),
  uptime: z.number().optional(),
}).passthrough();
