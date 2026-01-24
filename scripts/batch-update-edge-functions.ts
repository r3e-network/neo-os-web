#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Batch Update Script for Edge Functions
 *
 * Automatically updates Edge Functions to use:
 * - Standardized error codes
 * - Type utilities
 * - Deno type declarations
 * - Init imports
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

const EDGE_FUNCTIONS_DIR = "platform/edge/functions";

// Patterns to replace
const REPLACEMENTS = [
  {
    description: "Add error codes import",
    pattern: /import \{ error, json \} from "\.\/\.\.\/_shared\/response\.ts";/,
    replacement:
      'import { json } from "../_shared/response.ts";\nimport { errorResponse, validationError, notFoundError, unauthorizedError, forbiddenError } from "../_shared/error-codes.ts";',
  },
  {
    description: "Add type utils import",
    pattern: /(import \{[^\}]+\} from "\.\/\.\.\/_shared\/[^\"]+\.ts";)/,
    replacement:
      '$1\nimport { isNonEmptyString, isValidChainId, isNeoAddress, assert, assertNotNull, withDefault } from "../_shared/type-utils.ts";',
    checkNoDup: true, // Skip if type utils already imported
  },
  {
    description: "Replace error(405) with METHOD_NOT_ALLOWED",
    pattern: /return error\(405, "method not allowed", "METHOD_NOT_ALLOWED", req\)/g,
    replacement: 'return errorResponse("METHOD_NOT_ALLOWED", undefined, req)',
  },
  {
    description: 'Replace error(400, "invalid JSON body") with BAD_JSON',
    pattern: /return error\(400, "invalid JSON body", "BAD_JSON", req\)/g,
    replacement: 'return errorResponse("BAD_JSON", undefined, req)',
  },
  {
    description: 'Replace error(400, "app_id required") with VAL_003',
    pattern: /return error\(400, "app_id required", "APP_ID_REQUIRED", req\)/g,
    replacement: 'return validationError("app_id", "app_id required", req)',
  },
  {
    description: 'Replace error(400, "manifest required") with VAL_003',
    pattern: /return error\(400, "manifest required", "MANIFEST_REQUIRED", req\)/g,
    replacement: 'return validationError("manifest", "manifest required", req)',
  },
  {
    description: 'Replace error(400, "chain_id required") with VAL_003',
    pattern: /return error\(400, "chain_id required", "CHAIN_ID_REQUIRED", req\)/g,
    replacement: 'return validationError("chain_id", "chain_id required", req)',
  },
  {
    description: 'Replace error(400, "unknown chain") with NOTFOUND_003',
    pattern: /return error\(400, "unknown chain", "UNKNOWN_CHAIN", req\)/g,
    replacement: 'return notFoundError("chain", req)',
  },
  {
    description: 'Replace error(400, "unknown chain_id:") with NOTFOUND_003',
    pattern: /return error\(400, `unknown chain_id: \$(.+)`, "CHAIN_NOT_FOUND", req\)/g,
    replacement: 'return notFoundError("chain", req)',
  },
  {
    description: 'Replace error(401, "Unauthorized") with AUTH_001',
    pattern: /return error\(401, "Unauthorized", "UNAUTHORIZED", req\)/g,
    replacement: "return unauthorizedError(undefined, req)",
  },
  {
    description: 'Replace error(403, "Forbidden") with AUTH_004',
    pattern: /return error\(403, "Forbidden", "FORBIDDEN", req\)/g,
    replacement: "return forbiddenError(undefined, req)",
  },
  {
    description: "Replace error(404) with NOTFOUND_001",
    pattern: /return error\(404, "(.+)", "NOT_FOUND", req\)/g,
    replacement: 'return notFoundError("$1", req)',
  },
  {
    description: "Replace error(429) with RATE_001",
    pattern: /return error\(429, "(.+)", "RATE_LIMIT", req\)/g,
    replacement: 'return errorResponse("RATE_001", { message: "$1" }, req)',
  },
  {
    description: "Replace error(500) with SERVER_001",
    pattern: /return error\(500, "(.+)", "INTERNAL_ERROR", req\)/g,
    replacement: 'return errorResponse("SERVER_001", { message: "$1" }, req)',
  },
];

/**
 * Check if a file has already been updated
 */
function isAlreadyUpdated(content: string): boolean {
  return content.includes("errorResponse") || content.includes("validationError") || content.includes("type-utils");
}

/**
 * Apply replacements to a file
 */
function applyReplacements(content: string): string {
  let updated = content;
  let hasChanges = false;

  for (const replacement of REPLACEMENTS) {
    // Skip if this is a "check no dup" pattern and already present
    if (replacement.checkNoDup && updated.includes("type-utils")) {
      continue;
    }

    const before = updated;
    updated = updated.replace(replacement.pattern, replacement.replacement);
    if (before !== updated) {
      hasChanges = true;
      console.log(`  ✓ ${replacement.description}`);
    }
  }

  return { content: updated, hasChanges };
}

/**
 * Add Deno type declaration if not present
 */
function addDenoDeclaration(content: string): string {
  if (content.includes("declare const Deno")) {
    return content;
  }

  // Find the best place to insert (after init import, before other imports)
  const initImport = /import "\.\.\/_shared\/init\.ts";/;
  if (initImport.test(content)) {
    return content.replace(
      initImport,
      `$&\n\n// Deno global type definitions\ndeclare const Deno: {\n  env: {\n    get(key: string): string | undefined;\n  };\n  serve(handler: (req: Request) => Promise<Response>): void;\n};`
    );
  }

  return content;
}

/**
 * Update a single file
 */
async function updateFile(filePath: string): Promise<boolean> {
  try {
    const content = await Deno.readTextFile(filePath);

    // Skip if already updated
    if (isAlreadyUpdated(content)) {
      console.log(`⊘ ${filePath} - Already updated`);
      return false;
    }

    // Apply replacements
    const { content: updated, hasChanges } = applyReplacements(content);

    // Add Deno declaration
    const withDeno = addDenoDeclaration(updated);

    // Write back if changed
    if (hasChanges || withDeno !== content) {
      await Deno.writeTextFile(filePath, withDeno);
      console.log(`✓ ${filePath} - Updated`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`✗ ${filePath} - Error: ${error.message}`);
    return false;
  }
}

/**
 * Get all Edge Function index.ts files
 */
async function getEdgeFunctions(): Promise<string[]> {
  const files: string[] = [];

  for await (const entry of Deno.readDir(EDGE_FUNCTIONS_DIR)) {
    if (entry.isDirectory && !entry.name.startsWith("_") && !entry.name.startsWith(".")) {
      const indexPath = join(EDGE_FUNCTIONS_DIR, entry.name, "index.ts");
      try {
        await Deno.stat(indexPath);
        files.push(indexPath);
      } catch {
        // index.ts doesn't exist in this directory
      }
    }
  }

  return files;
}

/**
 * Main function
 */
async function main(args: string[]) {
  console.log("🔧 Batch Update Edge Functions");
  console.log("=".repeat(50));

  // Get list of files to update
  let files = await getEdgeFunctions();

  // Filter by specific function if provided
  if (args.length > 0) {
    const specific = args.map((arg) => join(EDGE_FUNCTIONS_DIR, arg, "index.ts"));
    files = files.filter((f) => specific.includes(f));
  }

  console.log(`Found ${files.length} Edge Function(s) to update\n`);

  // Update each file
  let updated = 0;
  for (const file of files) {
    if (await updateFile(file)) {
      updated++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✓ Updated ${updated} file(s)`);
}

// Run if executed directly
if (import.meta.main) {
  await main(Deno.args);
}
