#!/usr/bin/env node
/**
 * Flip every miniapp's bespoke dark *-theme.scss to use LIGHT as the
 * unconditional default. Each theme file follows the same shape:
 *
 *   :global(.theme-X) {
 *     --dark-var-1: ...;   <-- DARK defaults
 *   }
 *   :global(.theme-light .theme-X),
 *   :global([data-theme="light"] .theme-X) {
 *     --light-var-1: ...;  <-- LIGHT override
 *   }
 *
 * After this script:
 *   :global(.theme-X) gets the LIGHT block
 *   :global(.theme-dark .theme-X) gets the original DARK block as opt-in
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync(
  "grep -rln 'linear-gradient.*#1\\|linear-gradient.*#0\\|conic-gradient.*#1' /home/neo/git/neo-os-web/apps/*/src/ 2>/dev/null | grep theme.scss | grep -v node_modules",
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

console.log(`Found ${files.length} theme files to flip`);

let flipped = 0;
let skipped = 0;
const failures = [];

for (const file of files) {
  try {
    const original = readFileSync(file, "utf8");

    // Match the two blocks: dark default + light override.
    // Block 1 example: `:global(.theme-NAME) { ... dark vars ... }`
    // Block 2 example: `:global(.theme-light .theme-NAME), :global([data-theme="light"] .theme-NAME) { ... light vars ... }`
    const themeName = file.match(/([a-z0-9-]+)-theme\.scss$/)?.[1];
    if (!themeName) {
      skipped++;
      continue;
    }

    // Find the dark default block.
    const darkRe = new RegExp(
      `:global\\(\\.theme-${themeName}\\)\\s*\\{([^}]*\\{[^}]*\\}[^}]*)*[^}]*\\}`,
      "m",
    );

    // Find the light override block.
    const lightRe = new RegExp(
      `:global\\(\\.theme-light \\.theme-${themeName}\\),?\\s*\\n?\\s*:global\\(\\[data-theme="light"\\] \\.theme-${themeName}\\)\\s*\\{([\\s\\S]*?)\\n\\}`,
      "m",
    );

    const lightMatch = original.match(lightRe);
    if (!lightMatch) {
      console.warn(`  ${file}: no light variant found, skipping`);
      skipped++;
      continue;
    }

    const lightBlock = lightMatch[0];
    const lightBody = lightMatch[1];

    // Replace the dark default's BODY with the light body. Keep the
    // original dark block as an opt-in under .theme-dark.
    let result = original;

    // Pull the dark block — naively find from `:global(.theme-NAME) {` to its closing `}`.
    const darkStart = result.indexOf(`:global(.theme-${themeName}) {`);
    if (darkStart === -1) {
      console.warn(`  ${file}: no dark default found, skipping`);
      skipped++;
      continue;
    }

    // Find the matching closing brace.
    let depth = 0;
    let darkEnd = -1;
    for (let i = darkStart; i < result.length; i++) {
      if (result[i] === "{") depth++;
      else if (result[i] === "}") {
        depth--;
        if (depth === 0) {
          darkEnd = i + 1;
          break;
        }
      }
    }
    if (darkEnd === -1) {
      console.warn(`  ${file}: unable to find dark closing brace`);
      skipped++;
      continue;
    }

    const darkBlock = result.slice(darkStart, darkEnd);
    const darkBody = darkBlock.replace(/^:global\([^)]+\)\s*\{/, "").replace(/\}\s*$/, "");

    // Build new shape:
    //   :global(.theme-NAME) {   <-- LIGHT body (was the override)
    //     ...
    //   }
    //   :global(.theme-dark .theme-NAME) {   <-- DARK opt-in
    //     ...
    //   }
    const newBlock = `:global(.theme-${themeName}) {${lightBody}\n}\n\n:global(.theme-dark .theme-${themeName}) {${darkBody}}`;

    // Remove the old light override block first, then replace the dark default.
    result = result.replace(lightBlock, "");
    result = result.slice(0, darkStart) + newBlock + result.slice(darkEnd);

    writeFileSync(file, result, "utf8");
    flipped++;
    console.log(`  ✓ ${file.replace("/home/neo/git/neo-os-web/apps/", "")}`);
  } catch (e) {
    failures.push({ file, error: e.message });
    console.error(`  ✗ ${file}: ${e.message}`);
  }
}

console.log(`\n${flipped} flipped · ${skipped} skipped · ${failures.length} failed`);
