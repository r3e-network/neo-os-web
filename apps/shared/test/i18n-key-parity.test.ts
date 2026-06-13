import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { messages as selfLoanMessages } from "../../self-loan/src/locale/messages";
import { messages as milestoneEscrowMessages } from "../../milestone-escrow/src/locale/messages";
import { messages as breakupContractMessages } from "../../breakup-contract/src/locale/messages";
import { messages as customAnchorMessages } from "../../custom-anchor/src/locale/messages";
import { messages as foreverAlbumMessages } from "../../forever-album/src/locale/messages";
import { messages as graveyardMessages } from "../../graveyard/src/locale/messages";
import { messages as neoNsMessages } from "../../neo-ns/src/locale/messages";
import { messages as assetFactoryMessages } from "../../asset-factory/src/locale/messages";
import { messages as nftFactoryMessages } from "../../nft-factory/src/locale/messages";
import { messages as miniappFactoryMessages } from "../../miniapp-factory/src/locale/messages";
import { messages as neoSignAnythingMessages } from "../../neo-sign-anything/src/locale/messages";
import { messages as eventTicketPassMessages } from "../../event-ticket-pass/src/locale/messages";
import { messages as soulboundCertificateMessages } from "../../soulbound-certificate/src/locale/messages";
import { messages as timestampProofMessages } from "../../timestamp-proof/src/locale/messages";
import { messages as privateTransferMessages } from "../../private-transfer/src/appConfig";
import { messages as recoveryGuardianMessages } from "../../recovery-guardian/src/locale/messages";
import { messages as neodidPassportMessages } from "../../neodid-passport/src/appConfig";
import { messages as neoMessageMessages } from "../../neo-message/src/locale/messages";
import { messages as trustAnchorMessages } from "../../trustanchor/src/locale/messages";
import { messages as profitAnchorMessages } from "../../profitanchor/src/locale/messages";
import { messages as trustAnchorAdminMessages } from "../../trustanchor-admin/src/messages";
import { messages as profitAnchorAdminMessages } from "../../profitanchor-admin/src/messages";
import { messages as burnLeagueMessages } from "../../burn-league/src/locale/messages";
import { messages as lastSurvivorMessages } from "../../last-survivor/src/locale/messages";
import { messages as onChainTarotMessages } from "../../on-chain-tarot/src/locale/messages";
import { messages as redEnvelopeMessages } from "../../red-envelope/src/locale/messages";
import { messages as explorerMessages } from "../../explorer/src/locale/messages";
import { messages as neoConvertMessages } from "../../neo-convert/src/locale/messages";
import { messages as neoTreasuryMessages } from "../../neo-treasury/src/locale/messages";
import { messages as walletHealthMessages } from "../../wallet-health/src/locale/messages";
import { messages as dailyCheckinMessages } from "../../daily-checkin/src/locale/messages";

/**
 * Diff static t("key") usages against the app's merged locale map.
 *
 * The React i18n hook renders missing keys as "" in production, so a key that
 * compiles but is absent from the locale produces blank labels and — worse —
 * `throw new Error(t("missingKey"))` becomes an EMPTY error toast (the
 * self-loan walletStatusIdle/missingContract regression). This guard keeps
 * every statically-referenced key resolvable for the audited apps.
 */

const APPS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const T_CALL_PATTERN = /\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g;

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

function collectUsedKeys(appName: string): string[] {
  const keys = new Set<string>();
  for (const file of collectSourceFiles(path.join(APPS_DIR, appName, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(T_CALL_PATTERN)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

function missingKeys(appName: string, messages: Record<string, unknown>): string[] {
  return collectUsedKeys(appName).filter((key) => !(key in messages));
}

describe("i18n key parity", () => {
  it("self-loan defines every statically-referenced t() key (incl. walletStatusIdle/missingContract error keys)", () => {
    expect(missingKeys("self-loan", selfLoanMessages)).toEqual([]);
    // The error paths that previously threw Error("") must stay resolvable.
    const localized = selfLoanMessages as Record<string, { en: string; zh?: string }>;
    expect(localized.walletStatusIdle.en).toBe("Wallet not connected");
    expect(localized.walletStatusIdle.zh).toBeTruthy();
    expect(localized.missingContract.en).toBe("Contract not configured");
    expect(localized.missingContract.zh).toBeTruthy();
  });

  it("milestone-escrow defines every statically-referenced t() key with zh translations for the create form", () => {
    expect(missingKeys("milestone-escrow", milestoneEscrowMessages)).toEqual([]);
    // The four form keys previously papered over with English literals.
    const localized = milestoneEscrowMessages as Record<string, { en: string; zh?: string }>;
    for (const key of ["beneficiaryAddress", "description", "descriptionPlaceholder", "submit"]) {
      expect(localized[key]?.en, key).toBeTruthy();
      expect(localized[key]?.zh, key).toBeTruthy();
    }
  });

  // A6 cluster (breakup-contract, custom-anchor, forever-album, graveyard): the
  // UX/workflow fixes stripped every `t("k") || "English"` fallback, so a key
  // missing from the locale would now render blank (or an empty error toast).
  // Each app must resolve every statically-referenced key with a zh translation.
  const a6Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "breakup-contract",
      breakupContractMessages,
      // Keys added by the exit-path/partner/cancel fixes.
      ["cancelled", "cancelContract", "partnerTermsOffChain", "signNotPartner", "recoverCredit", "creditRecovered"],
    ],
    ["custom-anchor", customAnchorMessages, []],
    ["forever-album", foreverAlbumMessages, []],
    ["graveyard", graveyardMessages, []],
  ];

  for (const [appName, appMessages, requiredKeys] of a6Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      // Every locale entry that has an English string must also have a zh one
      // (no English-only keys masquerading as translated).
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }

  // A4 cluster (factories + neo-ns): the UX fixes stripped every
  // `t("k") || "English"` fallback and added new keys (execute/eyebrow/renew
  // confirm), so each statically-referenced key must resolve with a zh string.
  const a4Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "neo-ns",
      neoNsMessages,
      // Keys added by the eyebrow i18n, empty-search, renew-confirm, and
      // registration-term fixes.
      ["eyebrow", "enterDomainNameError", "renewConfirm", "confirmRenew", "cancel", "perYear"],
    ],
    ["asset-factory", assetFactoryMessages, ["executeDeployAction", "artifactStatusMetadataOnly", "myDeployments"]],
    ["nft-factory", nftFactoryMessages, ["executeDeployAction", "royaltyHelper", "useMyAddress"]],
    ["miniapp-factory", miniappFactoryMessages, ["executeRecordAction", "templateKindRewardVault", "templateKindOracleConsole"]],
  ];

  for (const [appName, appMessages, requiredKeys] of a4Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }

  // A7 cluster (attestation): the UX fixes wired the new on-chain reality —
  // NEP-11 enumeration/transfer UI for event-ticket-pass + soulbound, an honest
  // anchor for timestamp-proof, and the sign/broadcast coexistence fix — while
  // stripping every `t("k") || "English"` fallback, so each statically-
  // referenced key must resolve with a zh string.
  const a7Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "soulbound-certificate",
      soulboundCertificateMessages,
      ["copyIssueShortcut", "copyVerifyLink", "shareVerifyLink", "onlyIssuerCanRevoke", "tokenQrLabel", "tokenQrCaption"],
    ],
    [
      "event-ticket-pass",
      eventTicketPassMessages,
      ["copyTokenId", "tokenQrLabel", "tokenQrCaption", "transferTicket", "transferRecipient", "transferSuccess"],
    ],
    [
      "timestamp-proof",
      timestampProofMessages,
      ["totalProofs", "anchoredProofs", "latestId", "createProof", "verifyProof", "anchorOnChain", "anchoredOnChain"],
    ],
    [
      "neo-sign-anything",
      neoSignAnythingMessages,
      ["bytesUnit", "networkFeeNote", "signFileBtn", "hashedFileNotice"],
    ],
  ];

  for (const [appName, appMessages, requiredKeys] of a7Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }

  // A5 cluster (privacy-identity): the UX fixes ran a full i18n pass over
  // private-transfer (530-line PlayArea had zero t()), stripped every
  // `t("k") || "English"` fallback from recovery-guardian, and added keys for
  // the degraded-runtime/external-verifier surfaces (neodid-passport) and the
  // switch-network/load-older/body-counter surfaces (neo-message). Each
  // statically-referenced key must resolve with a zh string.
  const a5Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "private-transfer",
      privateTransferMessages,
      ["sealButton", "historyTitle", "historyEmpty", "sealErrorStore", "errorDetailLabel", "digestPlaceholder"],
    ],
    [
      "recovery-guardian",
      recoveryGuardianMessages,
      ["escapeStatusLabel", "escapeActive", "verifierNotConfigured", "timelockSeconds", "digestPlaceholder", "docDescription", "step2"],
    ],
    [
      "neodid-passport",
      neodidPassportMessages,
      ["statistics", "degradedRuntimeWarning", "degradedRuntimeBadge", "externalVerifierTitle", "externalVerifierLink", "digestPlaceholder"],
    ],
    [
      "neo-message",
      neoMessageMessages,
      ["switchToNeoX", "loadOlder", "bodyCounter", "errorNoEvmWallet"],
    ],
  ];

  for (const [appName, appMessages, requiredKeys] of a5Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }

  // A9 cluster (games-social): the UX fixes added the exit-path withdraw UI
  // (withdraw/creditOf), success toasts on money-moving actions, the
  // deposit-confirmation race fix, season-length disclosure, and the
  // red-envelope share affordance — while stripping every `t("k") || "English"`
  // fallback. The `requiredKeys` here include the success-toast keys passed to
  // notify.guard (NOT literal t("...") calls, so the static scan can't see them)
  // — a missing one produces a BLANK toast in production (the burnSuccess /
  // envelopeCreated regressions). Each statically-referenced key must resolve
  // with a zh string.
  const a9Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "burn-league",
      burnLeagueMessages,
      // notify.guard success keys + exit-path + season-length disclosure.
      ["burnSuccess", "settleSuccess", "creditWithdrawn", "withdrawCredit", "prepaidCreditLabel", "noCredit", "seasonLengthLabel", "durationSeconds", "durationDays"],
    ],
    [
      "last-survivor",
      lastSurvivorMessages,
      ["keysPurchased", "roundSettled", "creditWithdrawn", "withdrawCredit", "prepaidCreditLabel", "noCredit", "currentLeader", "winsIfZero", "awaitingFirstKey"],
    ],
    [
      "on-chain-tarot",
      onChainTarotMessages,
      ["cardsDrawn", "creditWithdrawn", "withdrawCredit", "prepaidCreditLabel", "noCredit"],
    ],
    [
      "red-envelope",
      redEnvelopeMessages,
      ["envelopeCreated", "envelopeClaimed", "shareLinkCopied", "copyShareLink", "shareTitle", "shareHint", "you", "creditWithdrawn"],
    ],
  ];

  for (const [appName, appMessages, requiredKeys] of a9Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }

  // A12 cluster (anchors): the UX fixes localized the hook validation throws
  // (threaded t() into normalize*), added the NEO-credit recovery exit path,
  // the claim-gating hint, the admin-role read-only banner, and moved the
  // hardcoded English admin kickers to locale. Admin success keys (passed to
  // notify.guard) and the recover/credit-recovered keys (passed to runAnchor-
  // Action, not literal t() calls) are listed in requiredKeys so a missing one
  // — which would yield a BLANK toast in production — is caught. Each
  // statically-referenced key must resolve with a zh string.
  const a12Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "trustanchor",
      trustAnchorMessages,
      [
        "invalidAgentId",
        "invalidCandidateKey",
        "missingContract",
        "sameAgent",
        "recoverCredit",
        "creditRecovered",
        "noRewardsHint",
      ],
    ],
    [
      "profitanchor",
      profitAnchorMessages,
      [
        "invalidAgentId",
        "invalidCandidateKey",
        "missingContract",
        "sameAgent",
        "stakingWorkspaceLabel",
        "pendingWithdraw",
        "recoverCredit",
        "creditRecovered",
      ],
    ],
    [
      "trustanchor-admin",
      trustAnchorAdminMessages,
      ["appName", "noneFallback", "operatorRequiredTitle", "operatorRequiredBody", "operatorRequiredBodyNoAddress"],
    ],
    [
      "profitanchor-admin",
      profitAnchorAdminMessages,
      ["appName", "noneFallback", "operatorRequiredTitle", "operatorRequiredBody", "operatorRequiredBodyNoAddress"],
    ],
  ];

  for (const [appName, appMessages, requiredKeys] of a12Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }

  // A14 cluster (tools): the UX fixes added the explorer unknown/not-found
  // search branches, neo-convert address conversion + missing loadingBalances,
  // neo-treasury stale/price-feed/unreachable signals + the ¥→$ fix, the
  // wallet-health pre-connect gating + per-item recommendations + report
  // locale, and the daily-checkin pre-load CTA gating — while stripping every
  // `t("k") || "English"` fallback. Each statically-referenced key must resolve
  // with a zh string.
  const a14Apps: Array<[string, Record<string, unknown>, string[]]> = [
    [
      "explorer",
      explorerMessages,
      ["searchUnknownTitle", "searchUnknownDesc", "transactionNotFound", "blockNotFound", "addressNoActivity"],
    ],
    [
      "neo-convert",
      neoConvertMessages,
      ["detectedAddress", "scriptHashLabel", "scriptHashLeLabel", "loadingBalances", "connectForBalances"],
    ],
    [
      "neo-treasury",
      neoTreasuryMessages,
      ["treasuryStale", "treasuryWalletsUnreachable", "treasuryPriceFeedUnavailable", "treasuryWatchlistNetwork"],
    ],
    [
      "wallet-health",
      walletHealthMessages,
      ["recommendationDevice", "recommendationHardware", "recommendation2fa", "checklistGasPending", "checklistConnectToCheck", "reportDone", "reportPending"],
    ],
    [
      "daily-checkin",
      dailyCheckinMessages,
      // notify.guard success keys (not literal t("…") calls) + the pre-load gate.
      ["checkinSuccess", "claimSuccess", "statusLoaded"],
    ],
  ];

  for (const [appName, appMessages, requiredKeys] of a14Apps) {
    it(`${appName} defines every statically-referenced t() key with zh translations`, () => {
      expect(missingKeys(appName, appMessages)).toEqual([]);
      const localized = appMessages as Record<string, { en?: string; zh?: string }>;
      for (const [key, entry] of Object.entries(localized)) {
        if (entry && typeof entry === "object" && "en" in entry) {
          expect(entry.zh, `${appName}.${key} zh`).toBeTruthy();
        }
      }
      for (const key of requiredKeys) {
        expect(localized[key]?.en, `${appName}.${key} en`).toBeTruthy();
        expect(localized[key]?.zh, `${appName}.${key} zh`).toBeTruthy();
      }
    });
  }
});
