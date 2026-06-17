import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Diff static t("key") usages against the app's merged locale map.
 *
 * The React i18n hook renders missing keys as "" in production, so a key that
 * compiles but is absent from the locale produces blank labels and — worse —
 * `throw new Error(t("missingKey"))` becomes an EMPTY error toast (the
 * self-loan walletStatusIdle/missingContract regression). This guard keeps
 * every statically-referenced key resolvable for EVERY app.
 *
 * Coverage is auto-discovered: the runner walks apps/*, resolves each app's
 * locale-message export, and applies the parity checks. A new miniapp is
 * covered automatically the moment it lands — there is no hand-written
 * registry to keep in sync (which silently let apps drift out of coverage
 * before). The message map is resolved from the `messages` import in each
 * app's src/main.tsx — the single source of truth that defineMiniApp() also
 * consumes — so it transparently handles the three file conventions in use
 * (src/locale/messages, src/appConfig, src/messages) plus the cross-app reuse
 * case (neo-pay-shared-example reuses neo-pay's messages). If an app's map
 * can't be resolved the test fails loudly, keeping the convention discoverable.
 */

const APPS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const T_CALL_PATTERN = /\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g;

// Directories under apps/ that are not standalone miniapps.
const NON_MINIAPP_DIRS = new Set(["shared", "host-app", "admin-console"]);

// Matches the `messages` named import in an app's main.tsx, capturing the
// local binding (it may be aliased, e.g. `messages as neoPayMessages`) and the
// module specifier. defineMiniApp() is handed exactly this binding, so it is
// the authoritative source for the app's locale map regardless of which file
// convention the app uses.
const MESSAGES_IMPORT_PATTERN =
  /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

interface DiscoveredApp {
  name: string;
  /** Absolute path to the app's src/ directory (for the static t() scan). */
  srcDir: string;
  /** Module specifier of the resolved locale map, relative to src/. */
  moduleSpecifier: string;
  /** Exported name to read off that module (handles `messages as alias`). */
  exportName: string;
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectUsedKeys(srcDir: string): string[] {
  const keys = new Set<string>();
  for (const file of collectSourceFiles(srcDir)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(T_CALL_PATTERN)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function missingKeys(srcDir: string, messages: Record<string, unknown>): string[] {
  return collectUsedKeys(srcDir).filter((key) => !(key in messages));
}

/**
 * Resolve where an app gets the locale map it passes to defineMiniApp by
 * parsing the `messages` import out of its main.tsx. Returns null (with the
 * caller failing loudly) if the convention can't be discovered.
 */
function resolveMessagesImport(
  appDir: string,
): { moduleSpecifier: string; exportName: string } | null {
  const mainPath = ["main.tsx", "main.ts"]
    .map((f) => path.join(appDir, "src", f))
    .find((f) => existsSync(f));
  if (!mainPath) return null;

  const source = readFileSync(mainPath, "utf8");
  for (const match of source.matchAll(MESSAGES_IMPORT_PATTERN)) {
    const specifiers = match[1];
    const moduleSpecifier = match[2];
    for (const raw of specifiers.split(",")) {
      const part = raw.trim();
      if (!part) continue;
      // `messages` or `messages as someAlias`.
      const aliasMatch = part.match(/^messages(?:\s+as\s+([A-Za-z0-9_$]+))?$/);
      if (aliasMatch) {
        return { moduleSpecifier, exportName: "messages" };
      }
    }
  }
  return null;
}

function discoverApps(): DiscoveredApp[] {
  const apps: DiscoveredApp[] = [];
  for (const entry of readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (NON_MINIAPP_DIRS.has(entry.name)) continue;
    const appDir = path.join(APPS_DIR, entry.name);
    const srcDir = path.join(appDir, "src");
    if (!existsSync(srcDir)) continue;
    const resolved = resolveMessagesImport(appDir);
    apps.push({
      name: entry.name,
      srcDir,
      moduleSpecifier: resolved?.moduleSpecifier ?? "",
      exportName: resolved?.exportName ?? "",
    });
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Import the app's locale module and return its `messages` map. The dynamic
 * import runs inside vitest so the @shared alias + TS transform are available,
 * and the specifier is resolved relative to the app's src/ directory exactly
 * as main.tsx resolves it.
 */
async function loadMessages(app: DiscoveredApp): Promise<Record<string, unknown>> {
  expect(
    app.moduleSpecifier,
    `${app.name}: could not find a \`messages\` import in src/main.tsx — the locale convention is undiscoverable`,
  ).toBeTruthy();

  const modulePath = path.resolve(app.srcDir, app.moduleSpecifier);
  const imported = (await import(/* @vite-ignore */ modulePath)) as Record<
    string,
    unknown
  >;
  const messages = imported[app.exportName];
  expect(
    messages && typeof messages === "object",
    `${app.name}: \`${app.exportName}\` from "${app.moduleSpecifier}" is not a locale map`,
  ).toBe(true);
  return messages as Record<string, unknown>;
}

/**
 * Supplementary per-app key requirements. These are keys that must exist with
 * BOTH en and zh strings but which the static t("...") scan cannot see —
 * they are passed as string literals to notify.guard / runAnchorAction (so a
 * missing one yields a BLANK toast in production, e.g. the burnSuccess /
 * envelopeCreated / checkinSuccess regressions) or were the specific keys a
 * past fix added. Coverage is universal via auto-discovery; this map only adds
 * targeted assertions on top for the apps that have indirect key references.
 */
const REQUIRED_KEYS: Record<string, string[]> = {
  // self-loan: error paths that previously threw Error("").
  "self-loan": ["walletStatusIdle", "missingContract"],
  // milestone-escrow: the four form keys previously papered over with English.
  "milestone-escrow": ["beneficiaryAddress", "description", "descriptionPlaceholder", "submit"],
  // A6 cluster (breakup-contract): exit-path/partner/cancel fixes.
  "breakup-contract": ["cancelled", "cancelContract", "partnerTermsOffChain", "signNotPartner", "recoverCredit", "creditRecovered"],
  // A4 cluster (factories + neo-ns).
  "neo-ns": ["eyebrow", "enterDomainNameError", "renewConfirm", "confirmRenew", "cancel", "perYear"],
  "asset-factory": ["executeDeployAction", "artifactStatusMetadataOnly", "myDeployments"],
  "nft-factory": ["executeDeployAction", "royaltyHelper", "useMyAddress"],
  "miniapp-factory": ["executeRecordAction", "templateKindRewardVault", "templateKindOracleConsole"],
  // A7 cluster (attestation).
  "soulbound-certificate": ["copyIssueShortcut", "copyVerifyLink", "shareVerifyLink", "onlyIssuerCanRevoke", "tokenQrLabel", "tokenQrCaption"],
  "event-ticket-pass": ["copyTokenId", "tokenQrLabel", "tokenQrCaption", "transferTicket", "transferRecipient", "transferSuccess"],
  "timestamp-proof": ["totalProofs", "anchoredProofs", "latestId", "createProof", "verifyProof", "anchorOnChain", "anchoredOnChain"],
  "neo-sign-anything": ["bytesUnit", "networkFeeNote", "signFileBtn", "hashedFileNotice"],
  // A5 cluster (privacy-identity).
  "private-transfer": ["sealButton", "historyTitle", "historyEmpty", "sealErrorStore", "errorDetailLabel", "digestPlaceholder"],
  "recovery-guardian": ["escapeStatusLabel", "escapeActive", "verifierNotConfigured", "timelockSeconds", "digestPlaceholder", "docDescription", "step2"],
  "neodid-passport": ["statistics", "degradedRuntimeWarning", "degradedRuntimeBadge", "externalVerifierTitle", "externalVerifierLink", "digestPlaceholder"],
  "neo-message": ["switchToNeoX", "loadOlder", "bodyCounter", "errorNoEvmWallet"],
  // A9 cluster (games-social): notify.guard success keys + exit-path.
  "burn-league": ["burnSuccess", "settleSuccess", "creditWithdrawn", "withdrawCredit", "prepaidCreditLabel", "noCredit", "seasonLengthLabel", "durationSeconds", "durationDays"],
  "last-survivor": ["keysPurchased", "roundSettled", "creditWithdrawn", "withdrawCredit", "prepaidCreditLabel", "noCredit", "currentLeader", "winsIfZero", "awaitingFirstKey"],
  "on-chain-tarot": ["cardsDrawn", "creditWithdrawn", "withdrawCredit", "prepaidCreditLabel", "noCredit"],
  "red-envelope": ["envelopeCreated", "envelopeClaimed", "shareLinkCopied", "copyShareLink", "shareTitle", "shareHint", "you", "creditWithdrawn"],
  // A12 cluster (anchors): admin success keys + recover/credit-recovered keys.
  "trustanchor": ["invalidAgentId", "invalidCandidateKey", "missingContract", "sameAgent", "recoverCredit", "creditRecovered", "noRewardsHint"],
  "profitanchor": ["invalidAgentId", "invalidCandidateKey", "missingContract", "sameAgent", "stakingWorkspaceLabel", "pendingWithdraw", "recoverCredit", "creditRecovered"],
  "trustanchor-admin": ["appName", "noneFallback", "operatorRequiredTitle", "operatorRequiredBody", "operatorRequiredBodyNoAddress"],
  "profitanchor-admin": ["appName", "noneFallback", "operatorRequiredTitle", "operatorRequiredBody", "operatorRequiredBodyNoAddress"],
  // A14 cluster (tools): notify.guard success keys + new branches.
  "explorer": ["searchUnknownTitle", "searchUnknownDesc", "transactionNotFound", "blockNotFound", "addressNoActivity"],
  "neo-convert": ["detectedAddress", "scriptHashLabel", "scriptHashLeLabel", "loadingBalances", "connectForBalances"],
  "neo-treasury": ["treasuryStale", "treasuryWalletsUnreachable", "treasuryPriceFeedUnavailable", "treasuryWatchlistNetwork"],
  "wallet-health": ["recommendationDevice", "recommendationHardware", "recommendation2fa", "checklistGasPending", "checklistConnectToCheck", "reportDone", "reportPending"],
  "daily-checkin": ["checkinSuccess", "claimSuccess", "statusLoaded"],
};

const apps = discoverApps();

describe("i18n key parity", () => {
  it("discovers at least every committed miniapp (auto-discovery sanity)", () => {
    // A regression guard on the discovery itself: if the glob silently stops
    // finding apps the whole suite would vacuously pass, so assert a floor.
    expect(apps.length).toBeGreaterThanOrEqual(50);
  });

  for (const app of apps) {
    describe(app.name, () => {
      it("resolves its locale message map and defines every statically-referenced t() key with en/zh translations", async () => {
        const messages = await loadMessages(app);

        // (a) Every statically-referenced t("key") must resolve.
        expect(missingKeys(app.srcDir, messages)).toEqual([]);

        // (b) en/zh parity: every locale entry that has an English string must
        // also have a zh one (no English-only keys masquerading as translated).
        const localized = messages as Record<string, { en?: string; zh?: string }>;
        for (const [key, entry] of Object.entries(localized)) {
          if (entry && typeof entry === "object" && "en" in entry) {
            expect(entry.zh, `${app.name}.${key} zh`).toBeTruthy();
          }
        }

        // (c) Supplementary keys that the static scan can't see (indirect
        // notify.guard / runAnchorAction references) must exist with en + zh.
        for (const key of REQUIRED_KEYS[app.name] ?? []) {
          expect(localized[key]?.en, `${app.name}.${key} en`).toBeTruthy();
          expect(localized[key]?.zh, `${app.name}.${key} zh`).toBeTruthy();
        }
      });
    });
  }

  // The original self-loan regression check kept verbatim: the error paths that
  // previously threw Error("") must keep their exact English copy + a zh string.
  it("self-loan keeps the walletStatusIdle/missingContract error copy resolvable", async () => {
    const selfLoan = apps.find((a) => a.name === "self-loan");
    expect(selfLoan, "self-loan app should be discovered").toBeTruthy();
    const messages = (await loadMessages(selfLoan!)) as Record<
      string,
      { en: string; zh?: string }
    >;
    expect(messages.walletStatusIdle.en).toBe("Wallet not connected");
    expect(messages.walletStatusIdle.zh).toBeTruthy();
    expect(messages.missingContract.en).toBe("Contract not configured");
    expect(messages.missingContract.zh).toBeTruthy();
  });
});
