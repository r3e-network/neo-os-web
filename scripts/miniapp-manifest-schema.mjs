/**
 * Shared Zod schema for neo-manifest.json validation.
 * Used by: sync-miniapp-registry.mjs, validate-miniapps.mjs, create-miniapp.mjs
 *
 * Single source of truth for manifest structure and category/permission mappings.
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { z } = require("zod");

// ── Constants ──────────────────────────────────────────────────────────

export const VALID_CATEGORIES = [
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
  "utility",
];

/** Maps raw manifest category values → normalized registry category */
export const CATEGORY_NORMALIZE_MAP = {
  games: "gaming",
  gaming: "gaming",
  game: "gaming",
  defi: "defi",
  finance: "defi",
  social: "social",
  nft: "nft",
  governance: "governance",
  utility: "utility",
  tools: "utility",
  tool: "utility",
};

export const VALID_PERMISSIONS = [
  "payments",
  "governance",
  "rng",
  "datafeed",
  "automation",
  "confidential",
];

/** Maps manifest permission strings → registry permission flag keys */
export const PERMISSION_MAP = {
  "invoke:primary": "payments",
  "invoke:secondary": "payments",
  "read:blockchain": null, // no flag, informational
  "write:blockchain": "payments",
  payments: "payments",
  governance: "governance",
  rng: "rng",
  datafeed: "datafeed",
  automation: "automation",
  confidential: "confidential",
};

export const SKIP_DIRS = ["shared", "sdk", "node_modules", ".git"];

export const REQUIRED_FILES = [
  "package.json",
  "vite.config.ts",
  "src/main.ts",
  "src/App.vue",
  "src/pages.json",
];

// ── Schema ─────────────────────────────────────────────────────────────

const developerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

const urlsSchema = z.object({
  entry: z.string().min(1),
  icon: z.string().min(1),
  banner: z.string().min(1),
});

const featuresSchema = z
  .object({
    stateless: z.boolean().optional().default(true),
    offlineSupport: z.boolean().optional().default(false),
    deeplink: z.string().optional().default(""),
  })
  .optional()
  .default({});

const stateSourceSchema = z
  .object({
    type: z.string().optional().default("smart-contract"),
    chain: z.string().optional().default("neo-n3-mainnet"),
    endpoints: z.array(z.string()).optional().default([]),
  })
  .optional()
  .default({});

const platformSchema = z
  .object({
    analytics: z.boolean().optional().default(true),
    comments: z.boolean().optional().default(true),
    ratings: z.boolean().optional().default(true),
    transactions: z.boolean().optional().default(true),
  })
  .optional()
  .default({});

export const manifestSchema = z.object({
  $schema: z.string().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  name_zh: z.string().min(1),
  version: z.string().optional().default("1.0.0"),
  description: z.string().min(1),
  description_zh: z.string().min(1),
  category: z.string().min(1),
  category_name: z.string().optional().default(""),
  category_name_zh: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  developer: developerSchema.optional().default({
    name: "R3E Network",
    email: "dev@r3e.network",
    website: "https://r3e.network",
  }),
  contracts: z.record(z.string(), z.string()).optional().default({}),
  supported_networks: z
    .array(z.string())
    .optional()
    .default(["neo-n3-mainnet"]),
  default_network: z.string().optional().default("neo-n3-mainnet"),
  urls: urlsSchema,
  permissions: z.array(z.string()).optional().default([]),
  features: featuresSchema,
  stateSource: stateSourceSchema,
  platform: platformSchema,
  createdAt: z.string().optional().default("2026-01-01T00:00:00Z"),
  updatedAt: z.string().optional().default("2026-01-01T00:00:00Z"),
});

// ── Helpers ────────────────────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Parse and validate a neo-manifest.json file.
 * @param {string} filePath - Absolute path to neo-manifest.json
 * @returns {{ success: true, data: object } | { success: false, error: import('zod').ZodError }}
 */
export async function parseManifest(filePath) {
  const raw = await readFile(resolve(filePath), "utf-8");
  const json = JSON.parse(raw);
  const result = manifestSchema.safeParse(json);
  return result;
}

/**
 * Normalize a raw category string to a valid registry category.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCategory(raw) {
  const lower = (raw || "").toLowerCase().trim();
  return CATEGORY_NORMALIZE_MAP[lower] || lower;
}

/**
 * Convert manifest permissions array → registry permission flags object.
 * @param {string[]} perms
 * @returns {Record<string, boolean>}
 */
export function permissionsToFlags(perms) {
  const flags = {};
  for (const p of VALID_PERMISSIONS) {
    flags[p] = false;
  }
  for (const p of perms || []) {
    const mapped = PERMISSION_MAP[p];
    if (mapped && mapped in flags) {
      flags[mapped] = true;
    }
  }
  return flags;
}

/**
 * Convert manifest contracts record → registry chainContracts format.
 * @param {Record<string, string>} contracts
 * @returns {Record<string, { address: string, active: boolean }>}
 */
export function contractsToChainContracts(contracts) {
  const result = {};
  for (const [network, address] of Object.entries(contracts || {})) {
    result[network] = {
      address: address || "",
      active: !!address && address !== "",
    };
  }
  return result;
}

/**
 * Rewrite a manifest URL path to the miniapp-assets path used in the registry.
 * /miniapps/{slug}/file → /miniapp-assets/{slug}/file
 * @param {string} url
 * @returns {string}
 */
export function rewriteUrl(url) {
  if (!url) return url;
  return url.replace(/^\/miniapps\//, "/miniapp-assets/");
}

/**
 * Extract the slug from a manifest id.
 * "miniapp-coin-flip" → "coin-flip" (but we use directory name instead)
 * @param {string} id
 * @returns {string}
 */
export function extractSlug(id) {
  return id.replace(/^miniapp-/, "");
}
