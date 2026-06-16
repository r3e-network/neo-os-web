import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Root lint gate for the miniapps platform (XC-W2-02).
//
// Pragmatic ruleset: the recommended JS/TS bases tuned to the codebase's
// existing idioms so the gate stays green while still catching real errors
// (undefined globals, unreachable code, duplicate keys, broken regexes, ...).
// Rules that only produce idiom-level noise in this codebase are disabled
// below rather than "fixed" mechanically; widespread-but-useful rules
// (unused vars) are demoted to warnings so they surface without failing CI.
export default tseslint.config(
  {
    ignores: [
      // Dependency and build output trees.
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/.turbo/**",
      // Claude Code session data + transient agent git worktrees (full repo copies that
      // would otherwise be linted as duplicates and pollute results).
      "**/.claude/**",
      // Test tooling artifacts.
      "**/playwright-report/**",
      "**/test-results/**",
      // Generated code (was already ignored by the dead .eslintrc.json files).
      "platform/host-app/lib/codegen/**",
      // Staged miniapp bundles (vite dist output copied by stage:miniapps:dist).
      "platform/host-app/public/miniapps/**",
      // Vendored crypto shims (noble-curves / noble-hashes compiled output).
      "apps/shared/shims/**",
      // Deno runtimes (URL imports + Deno globals; not Node/browser code).
      "platform/host-app/supabase/functions/**",
      "platform/edge/**",
      // Non-JS contract sources and compiled artifacts.
      "contracts/**",
      // Prose and reports.
      "docs/**",
      "claudedocs/**",
      // Declaration files (including next-env.d.ts).
      "**/*.d.ts",
      "**/*.min.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // The repo pervasively uses `any` at SDK/runtime boundaries (wallet
      // payloads, RPC stacks); enforcing this would be a mass rewrite.
      "@typescript-eslint/no-explicit-any": "off",
      // Unused identifiers are widespread in the existing code; surface them
      // as warnings (visible in CI logs) without failing the gate. The
      // `_`-prefix idiom stays available for intentional placeholders.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // `catch {}` / empty placeholder blocks are an accepted idiom here.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // CommonJS interop in deploy/test scripts.
      "@typescript-eslint/no-require-imports": "off",
      // `let` for values assigned once is widespread; stylistic only.
      "prefer-const": "off",
      // Existing code escapes regex characters defensively.
      "no-useless-escape": "off",
      // ts-comment pragmas are used deliberately at generated boundaries.
      "@typescript-eslint/ban-ts-comment": "off",
      // Empty interfaces/object types appear in scaffolded props typing.
      "@typescript-eslint/no-empty-object-type": "off",
      // `while (true)` polling loops are intentional in deploy tooling.
      "no-constant-condition": ["error", { checkLoops: false }],
      // Control characters in regexes are deliberate input sanitizers
      // (e.g. apps/shared/utils/launch-params.ts strips \x00-\x1f).
      "no-control-regex": "off",
      // try/catch-rethrow wrappers are used as documentation seams in the
      // wallet composables; removing them is churn, not signal.
      "no-useless-catch": "off",
      // Loosely-typed callback props (`Function`) are an accepted idiom in
      // the miniapp component layer.
      "@typescript-eslint/no-unsafe-function-type": "off",
      // `Boolean(x)` inside conditions is used for readability.
      "no-extra-boolean-cast": "off",
      // `navigator.sendBeacon?.(...) || void fetch(...)` style short-circuit
      // dispatch is used in the monitoring layer.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true },
      ],
      // React hook dependency hygiene: warn-level signal for the React
      // surfaces (host-app, admin-console, React miniapps). rules-of-hooks
      // stays off because Vue composables share the `useXxx` naming
      // convention and trip its React-specific heuristics.
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Jest-driven suites (host-app unit tests + setup file).
    files: [
      "**/jest.setup.js",
      "**/jest.config.js",
      "**/__tests__/**",
      "**/*.test.{js,jsx,ts,tsx}",
      "**/__mocks__/**",
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Tests exercise constant-folded branches on purpose
      // (e.g. cn("a", true && "b", false && "c") class-merge assertions).
      "no-constant-binary-expression": "off",
    },
  }
);
