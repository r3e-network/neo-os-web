import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  CreditCard,
  Dice5,
  FileKey,
  FileSignature,
  Fingerprint,
  Flame,
  Gift,
  Hash,
  HeartHandshake,
  History,
  Hourglass,
  ImageIcon,
  KeyRound,
  Landmark,
  Layers3,
  Link2,
  LockKeyhole,
  Medal,
  MessageSquareText,
  Radio,
  ReceiptText,
  Scale,
  SearchCheck,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Vault,
  Vote,
  WalletCards,
  WandSparkles,
  Workflow,
} from "lucide-react";

import type { MiniAppInfo, MiniAppLaunchContext } from "@/components/types";
import { getLaunchParam } from "@/lib/miniapp-launch-params";
import {
  buildConfidentialTransferPackage,
  encryptJsonWithOraclePublicKey,
} from "../../../../apps/shared/utils/morpheus-confidential-envelope";

type PlayMetric = { label: string; value: string; accent?: boolean };
type ActivityRow = {
  icon: string;
  primary: string;
  secondary?: string;
  amount?: string;
  accent?: boolean;
};
type PlayActivity = {
  title: string;
  rows: ActivityRow[];
  emptyText?: string;
};

export type PlayAreaRegistryProps = {
  app: MiniAppInfo;
  stats: PlayMetric[];
  statsMap: Record<string, string>;
  activity: PlayActivity | null;
  loading: boolean;
  error: string | null;
  contractHash: string | null;
  network: "mainnet" | "testnet";
  launchContext?: MiniAppLaunchContext | null;
  onRefresh: () => void;
};

type PlayAreaComponent = (props: PlayAreaRegistryProps) => JSX.Element;

const PLAYAREA_REGISTRY: Record<string, PlayAreaComponent> = {
  "miniapp-last-survivor": LastSurvivorPlayArea,
  "miniapp-fogplay": FogPlayPlayArea,
  "miniapp-gasbox": GasBoxPlayArea,
  "miniapp-redenvelope": RedEnvelopePlayArea,
  "miniapp-dailycheckin": DailyCheckinPlayArea,
  "miniapp-self-loan": SelfLoanPlayArea,
  "miniapp-profitanchor": ProfitAnchorPlayArea,
  "miniapp-trustanchor": TrustAnchorPlayArea,
  "miniapp-neo-pay": NeoPayPlayArea,
  "miniapp-onchaintarot": TarotPlayArea,
  "miniapp-on-chain-tarot": TarotPlayArea,
  "miniapp-explorer": ExplorerPlayArea,
  "miniapp-neo-x-bridge": NeoXBridgePlayArea,
  "miniapp-private-transfer": PrivateTransferPlayArea,
};

const ORACLE_APP_LABELS: Record<
  string,
  { title: string; mode: "http" | "vrf" | "compute" | "seal" | "neodid" | "price" }
> = {
  "miniapp-oracle-http-console": { title: "HTTP Oracle Console", mode: "http" },
  "miniapp-oracle-vrf-console": { title: "VRF Request Console", mode: "vrf" },
  "miniapp-oracle-compute-lab": { title: "Private Compute Lab", mode: "compute" },
  "miniapp-oracle-seal-console": { title: "Seal Console", mode: "seal" },
  "miniapp-oracle-neodid-console": { title: "NeoDID Oracle Console", mode: "neodid" },
  "miniapp-oracle-price-console": { title: "Price Oracle Console", mode: "price" },
};

type ProfileField = {
  key: string;
  label: string;
  defaultValue: string;
  suffix?: string;
  type?: "text" | "number";
};

type ProfileCard = {
  label: string;
  value: string;
};

type ProfileVisualLayout =
  | "pipeline"
  | "market"
  | "ballot"
  | "scoreboard"
  | "proof"
  | "vault"
  | "gallery"
  | "timeline"
  | "converter"
  | "qr"
  | "checklist"
  | "ledger"
  | "stream";

type ProfileVisual = {
  layout: ProfileVisualLayout;
  headline: string;
  slots: string[];
  footnote?: string;
};

type PlayAreaProfile = {
  title: string;
  subtitle: string;
  tone: "emerald" | "violet" | "amber" | "rose" | "sky" | "slate";
  icon: React.ReactNode;
  fields: ProfileField[];
  cards: ProfileCard[];
  steps: string[];
  primaryAction: string;
  visual: ProfileVisual;
};

const PROFILED_PLAYAREAS: Record<string, PlayAreaProfile> = {
  "miniapp-aa-account-lab": {
    title: "AA account registration lab",
    subtitle: "Preview registration intent, predicted account id, and owner binding before submitting through the action console.",
    tone: "sky",
    icon: <Fingerprint className="h-5 w-5" />,
    fields: [
      { key: "owner", label: "Owner address", defaultValue: "" },
      { key: "salt", label: "Registration salt", defaultValue: "neo-aa-001" },
    ],
    cards: [
      { label: "Core", value: "AA registry" },
      { label: "Witness", value: "owner" },
      { label: "Mode", value: "testnet" },
    ],
    steps: ["Resolve AA core", "Derive account id", "Bind owner witness", "Submit register"],
    primaryAction: "Stage account registration",
    visual: {
      layout: "pipeline",
      headline: "Registration flow",
      slots: ["Owner", "Salt", "Account ID", "AA Core"],
      footnote: "The preview mirrors the shared AA registration path.",
    },
  },
  "miniapp-aa-market-hub": {
    title: "AA escrow market desk",
    subtitle: "Create a listing, lock settlement terms, and track counterparty approval for AA-powered marketplace deals.",
    tone: "emerald",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    fields: [
      { key: "price", label: "Listing price", defaultValue: "18", suffix: "GAS", type: "number" },
      { key: "item", label: "Listing title", defaultValue: "AA service package" },
    ],
    cards: [
      { label: "Escrow", value: "funded on accept" },
      { label: "Settlement", value: "dual approval" },
      { label: "Disputes", value: "timelock" },
    ],
    steps: ["Draft listing", "Lock funds", "Accept counterparty", "Settle or dispute"],
    primaryAction: "Stage listing",
    visual: {
      layout: "market",
      headline: "Trustless listing board",
      slots: ["Draft", "Funded", "Accepted", "Settled"],
    },
  },
  "miniapp-aa-permissions-lab": {
    title: "AA permission binding console",
    subtitle: "Inspect verifier and hook bindings, then stage permission updates with clear before and after state.",
    tone: "slate",
    icon: <ClipboardCheck className="h-5 w-5" />,
    fields: [
      { key: "verifier", label: "Verifier hash", defaultValue: "" },
      { key: "hook", label: "Hook binding", defaultValue: "spend-limit" },
    ],
    cards: [
      { label: "Verifier", value: "active" },
      { label: "Hook", value: "review" },
      { label: "Scope", value: "account" },
    ],
    steps: ["Read bindings", "Compare desired policy", "Stage update", "Verify event"],
    primaryAction: "Stage permission update",
    visual: {
      layout: "checklist",
      headline: "Binding matrix",
      slots: ["Verifier active", "Hook enabled", "Witness required", "Event audit"],
    },
  },
  "miniapp-aa-relay-console": {
    title: "Relay payload console",
    subtitle: "Build relay-ready calldata, inspect sponsor metadata, and verify the envelope before relay submission.",
    tone: "sky",
    icon: <Send className="h-5 w-5" />,
    fields: [
      { key: "target", label: "Target method", defaultValue: "transfer" },
      { key: "gas", label: "Sponsor budget", defaultValue: "0.08", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Sponsor", value: "policy match" },
      { label: "Nonce", value: "fresh" },
      { label: "Relay", value: "ready" },
    ],
    steps: ["Encode payload", "Attach sponsor", "Check nonce", "Relay atomically"],
    primaryAction: "Build relay package",
    visual: {
      layout: "proof",
      headline: "Relay envelope",
      slots: ["method", "nonce", "sponsor", "signature"],
      footnote: "A relay package must be complete before it leaves the console.",
    },
  },
  "miniapp-aa-session-key-lab": {
    title: "Session key policy lab",
    subtitle: "Configure a scoped session key with limits, expiry, and sponsor readiness for AA flows.",
    tone: "violet",
    icon: <KeyRound className="h-5 w-5" />,
    fields: [
      { key: "scope", label: "Allowed method", defaultValue: "claimReward" },
      { key: "limit", label: "Spend limit", defaultValue: "2", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Expiry", value: "24h" },
      { label: "Sponsor", value: "enabled" },
      { label: "Verifier", value: "session key" },
    ],
    steps: ["Define scope", "Set limit", "Bind verifier", "Activate key"],
    primaryAction: "Stage session key",
    visual: {
      layout: "timeline",
      headline: "Scoped key lifecycle",
      slots: ["Issue", "Use", "Throttle", "Expire"],
    },
  },
  "miniapp-automation-copilot": {
    title: "Automation runbook cockpit",
    subtitle: "Compose price alerts, AA recipes, private oracle jobs, and datafeed runbooks from one operator surface.",
    tone: "emerald",
    icon: <Workflow className="h-5 w-5" />,
    fields: [
      { key: "trigger", label: "Trigger", defaultValue: "NEO price > 25" },
      { key: "action", label: "Action", defaultValue: "notify + prepare tx" },
    ],
    cards: [
      { label: "Oracle", value: "price feed" },
      { label: "Privacy", value: "sealed input" },
      { label: "Runbook", value: "armed" },
    ],
    steps: ["Select trigger", "Attach oracle", "Review action", "Enable monitor"],
    primaryAction: "Stage automation",
    visual: {
      layout: "pipeline",
      headline: "Runbook chain",
      slots: ["Trigger", "Oracle", "Policy", "Action"],
    },
  },
  "miniapp-breakupcontract": {
    title: "Agreement split workspace",
    subtitle: "Draft a breakup agreement, split shared assets fairly, and keep the settlement path legible.",
    tone: "rose",
    icon: <Scale className="h-5 w-5" />,
    fields: [
      { key: "partyA", label: "Party A share", defaultValue: "50", suffix: "%", type: "number" },
      { key: "asset", label: "Shared asset", defaultValue: "GAS balance" },
    ],
    cards: [
      { label: "Agreement", value: "draft" },
      { label: "Counterparty", value: "pending" },
      { label: "Settlement", value: "fair split" },
    ],
    steps: ["Draft terms", "Invite counterparty", "Lock assets", "Release split"],
    primaryAction: "Stage agreement",
    visual: {
      layout: "ledger",
      headline: "Split ledger",
      slots: ["Party A", "Party B", "Shared pool", "Release"],
    },
  },
  "miniapp-burn-league": {
    title: "Burn league arena",
    subtitle: "Enter a burn challenge, preview leaderboard impact, and stage the burn transaction intentionally.",
    tone: "amber",
    icon: <Flame className="h-5 w-5" />,
    fields: [
      { key: "amount", label: "Burn amount", defaultValue: "10", suffix: "points", type: "number" },
      { key: "league", label: "League", defaultValue: "Weekly ladder" },
    ],
    cards: [
      { label: "Rank", value: "#12" },
      { label: "Multiplier", value: "1.4x" },
      { label: "Season", value: "open" },
    ],
    steps: ["Choose league", "Preview burn", "Submit burn", "Update rank"],
    primaryAction: "Stage burn entry",
    visual: {
      layout: "scoreboard",
      headline: "Leaderboard impact",
      slots: ["You", "Top 10", "Weekly", "Final"],
    },
  },
  "miniapp-council-governance": {
    title: "Council voting chamber",
    subtitle: "Review proposals, stage a council vote, and verify voting power before signing.",
    tone: "emerald",
    icon: <Building2 className="h-5 w-5" />,
    fields: [
      { key: "proposal", label: "Proposal id", defaultValue: "CIP-42" },
      { key: "vote", label: "Vote", defaultValue: "Approve" },
    ],
    cards: [
      { label: "Quorum", value: "68%" },
      { label: "Power", value: "verified" },
      { label: "Status", value: "voting" },
    ],
    steps: ["Read proposal", "Check quorum", "Stage vote", "Confirm receipt"],
    primaryAction: "Stage council vote",
    visual: {
      layout: "ballot",
      headline: "Council ballot",
      slots: ["Approve", "Reject", "Abstain", "Needs quorum"],
    },
  },
  "miniapp-dev-tipping": {
    title: "Developer tip jar",
    subtitle: "Send an appreciation tip with a message and clear wallet preview before payment.",
    tone: "rose",
    icon: <HeartHandshake className="h-5 w-5" />,
    fields: [
      { key: "recipient", label: "Developer", defaultValue: "" },
      { key: "amount", label: "Tip amount", defaultValue: "1", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Message", value: "public thanks" },
      { label: "Asset", value: "GAS" },
      { label: "Receipt", value: "on-chain" },
    ],
    steps: ["Pick developer", "Write note", "Preview tip", "Send receipt"],
    primaryAction: "Stage tip",
    visual: {
      layout: "stream",
      headline: "Tip flow",
      slots: ["Sender", "Message", "Developer", "Receipt"],
    },
  },
  "miniapp-event-ticket-pass": {
    title: "Ticket issuer and check-in",
    subtitle: "Issue NEP-11 event passes, preview QR check-in, and track used versus active tickets.",
    tone: "sky",
    icon: <Ticket className="h-5 w-5" />,
    fields: [
      { key: "event", label: "Event", defaultValue: "Neo meetup" },
      { key: "supply", label: "Ticket supply", defaultValue: "120", type: "number" },
    ],
    cards: [
      { label: "Token", value: "NEP-11" },
      { label: "Check-in", value: "QR" },
      { label: "Status", value: "draft" },
    ],
    steps: ["Create event", "Mint passes", "Scan QR", "Mark used"],
    primaryAction: "Stage ticket batch",
    visual: {
      layout: "qr",
      headline: "Event pass preview",
      slots: ["NEP-11", "QR", "Gate", "Used"],
    },
  },
  "miniapp-flashloan": {
    title: "Flash loan route builder",
    subtitle: "Build a single-transaction loan route with borrow, execute, repay, and profit checks visible.",
    tone: "emerald",
    icon: <CircleDollarSign className="h-5 w-5" />,
    fields: [
      { key: "borrow", label: "Borrow amount", defaultValue: "100", suffix: "GAS", type: "number" },
      { key: "route", label: "Execution route", defaultValue: "borrow -> swap -> repay" },
    ],
    cards: [
      { label: "Atomicity", value: "required" },
      { label: "Repay", value: "same tx" },
      { label: "Profit", value: "preview" },
    ],
    steps: ["Borrow", "Execute route", "Repay", "Keep surplus"],
    primaryAction: "Stage flash route",
    visual: {
      layout: "pipeline",
      headline: "Atomic loan path",
      slots: ["Borrow", "Trade", "Repay", "Profit"],
    },
  },
  "miniapp-forever-album": {
    title: "Encrypted album desk",
    subtitle: "Prepare photo metadata, choose encryption mode, and preview the per-wallet album surface.",
    tone: "violet",
    icon: <ImageIcon className="h-5 w-5" />,
    fields: [
      { key: "album", label: "Album title", defaultValue: "Neo memories" },
      { key: "mode", label: "Privacy mode", defaultValue: "AES-GCM optional" },
    ],
    cards: [
      { label: "Storage", value: "wallet scoped" },
      { label: "Encryption", value: "optional" },
      { label: "Access", value: "owner" },
    ],
    steps: ["Select photo", "Encrypt metadata", "Write hash", "Open album"],
    primaryAction: "Stage album entry",
    visual: {
      layout: "gallery",
      headline: "Wallet album preview",
      slots: ["Photo", "Hash", "Owner", "Album"],
    },
  },
  "miniapp-gas-sponsor": {
    title: "Gas sponsor policy desk",
    subtitle: "Define who receives sponsored GAS, cap the budget, and make onboarding rules transparent.",
    tone: "emerald",
    icon: <Coins className="h-5 w-5" />,
    fields: [
      { key: "contract", label: "Allowed contract", defaultValue: "" },
      { key: "budget", label: "Daily budget", defaultValue: "5", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Recipients", value: "low balance" },
      { label: "Cap", value: "daily" },
      { label: "Mode", value: "gasless" },
    ],
    steps: ["Choose contract", "Set cap", "Enable sponsor", "Audit usage"],
    primaryAction: "Stage sponsor policy",
    visual: {
      layout: "checklist",
      headline: "Sponsorship rules",
      slots: ["Low balance", "Contract allowlist", "Daily cap", "Usage log"],
    },
  },
  "miniapp-gov-merc": {
    title: "Governance delegation market",
    subtitle: "List, compare, and delegate voting power through transparent governance offers.",
    tone: "sky",
    icon: <Users className="h-5 w-5" />,
    fields: [
      { key: "delegate", label: "Delegate", defaultValue: "Council desk" },
      { key: "power", label: "Voting power", defaultValue: "40", suffix: "NEO", type: "number" },
    ],
    cards: [
      { label: "Offers", value: "market" },
      { label: "Duration", value: "epoch" },
      { label: "Reward", value: "negotiated" },
    ],
    steps: ["Compare delegates", "Set duration", "Delegate power", "Track result"],
    primaryAction: "Stage delegation",
    visual: {
      layout: "market",
      headline: "Voting power offers",
      slots: ["Delegate", "Rate", "Epoch", "Reward"],
    },
  },
  "miniapp-graveyard": {
    title: "Encrypted memory burial",
    subtitle: "Seal a memory, set a forgetting price, and keep the privacy envelope explicit.",
    tone: "slate",
    icon: <History className="h-5 w-5" />,
    fields: [
      { key: "memory", label: "Memory label", defaultValue: "private note" },
      { key: "price", label: "Forgetting price", defaultValue: "3", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Encryption", value: "sealed" },
      { label: "Reveal", value: "never by default" },
      { label: "Payment", value: "forgetting" },
    ],
    steps: ["Encrypt memory", "Commit hash", "Set price", "Bury record"],
    primaryAction: "Stage burial",
    visual: {
      layout: "vault",
      headline: "Sealed memory",
      slots: ["Ciphertext", "Hash", "Price", "Buried"],
    },
  },
  "miniapp-memorial-shrine": {
    title: "Memorial tribute wall",
    subtitle: "Compose a permanent tribute with message, donation state, and on-chain memorial proof.",
    tone: "rose",
    icon: <BookOpenCheck className="h-5 w-5" />,
    fields: [
      { key: "name", label: "Memorial name", defaultValue: "Loved one" },
      { key: "message", label: "Tribute line", defaultValue: "Always remembered" },
    ],
    cards: [
      { label: "Tribute", value: "draft" },
      { label: "Proof", value: "on-chain" },
      { label: "Visitors", value: "open" },
    ],
    steps: ["Write tribute", "Preview wall", "Anchor proof", "Share memorial"],
    primaryAction: "Stage tribute",
    visual: {
      layout: "gallery",
      headline: "Shrine wall",
      slots: ["Portrait", "Message", "Proof", "Visitors"],
    },
  },
  "miniapp-milestone-escrow": {
    title: "Milestone escrow board",
    subtitle: "Lock project funds, approve completed milestones, and release payments step by step.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    fields: [
      { key: "total", label: "Escrow total", defaultValue: "50", suffix: "GAS", type: "number" },
      { key: "milestone", label: "Next milestone", defaultValue: "M2 delivery" },
    ],
    cards: [
      { label: "Locked", value: "escrow" },
      { label: "Approval", value: "buyer" },
      { label: "Release", value: "milestone" },
    ],
    steps: ["Fund escrow", "Submit milestone", "Approve work", "Release funds"],
    primaryAction: "Stage escrow",
    visual: {
      layout: "timeline",
      headline: "Milestone release plan",
      slots: ["Fund", "M1", "M2", "Release"],
    },
  },
  "miniapp-neo-convert": {
    title: "Neo conversion workbench",
    subtitle: "Convert addresses, script hashes, and key formats locally before using them in a wallet operation.",
    tone: "sky",
    icon: <ArrowRightLeft className="h-5 w-5" />,
    fields: [
      { key: "input", label: "Input value", defaultValue: "" },
      { key: "format", label: "Target format", defaultValue: "script hash" },
    ],
    cards: [
      { label: "Mode", value: "local" },
      { label: "Network", value: "Neo N3" },
      { label: "Output", value: "copyable" },
    ],
    steps: ["Paste value", "Detect format", "Convert", "Copy output"],
    primaryAction: "Convert value",
    visual: {
      layout: "converter",
      headline: "Address converter",
      slots: ["Address", "Script hash", "Endian", "Copy"],
    },
  },
  "miniapp-neo-swap": {
    title: "Neo swap quote desk",
    subtitle: "Build a token swap preview with route, slippage, and settlement state before submitting through the shared action console.",
    tone: "emerald",
    icon: <ArrowRightLeft className="h-5 w-5" />,
    fields: [
      { key: "from", label: "From asset", defaultValue: "NEO" },
      { key: "amount", label: "Amount", defaultValue: "10", suffix: "NEO", type: "number" },
    ],
    cards: [
      { label: "Route", value: "best path" },
      { label: "Slippage", value: "0.5%" },
      { label: "Settlement", value: "wallet" },
    ],
    steps: ["Select assets", "Preview quote", "Check slippage", "Stage swap"],
    primaryAction: "Preview swap route",
    visual: {
      layout: "converter",
      headline: "Swap quote route",
      slots: ["NEO", "Route", "GAS", "Confirm"],
      footnote: "The shared operation panel handles wallet submission after the quote is reviewed.",
    },
  },
  "miniapp-neo-multisig": {
    title: "Multisig signing room",
    subtitle: "Create a multisig request, collect signatures, and keep threshold progress visible.",
    tone: "slate",
    icon: <Users className="h-5 w-5" />,
    fields: [
      { key: "threshold", label: "Threshold", defaultValue: "2 of 3" },
      { key: "amount", label: "Transfer amount", defaultValue: "8", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Signers", value: "3" },
      { label: "Threshold", value: "2" },
      { label: "State", value: "collecting" },
    ],
    steps: ["Draft transfer", "Invite signers", "Collect threshold", "Broadcast"],
    primaryAction: "Stage multisig request",
    visual: {
      layout: "checklist",
      headline: "Signature progress",
      slots: ["Signer 1", "Signer 2", "Signer 3", "Threshold"],
    },
  },
  "miniapp-neo-ns": {
    title: ".neo domain desk",
    subtitle: "Search, register, and manage human-readable Neo names from a focused registration surface.",
    tone: "emerald",
    icon: <FileKey className="h-5 w-5" />,
    fields: [
      { key: "name", label: "Domain", defaultValue: "" },
      { key: "years", label: "Registration", defaultValue: "1", suffix: "year", type: "number" },
    ],
    cards: [
      { label: "Availability", value: "checking" },
      { label: "Resolver", value: "wallet" },
      { label: "Renewal", value: "enabled" },
    ],
    steps: ["Search name", "Resolve price", "Register", "Set resolver"],
    primaryAction: "Stage domain registration",
    visual: {
      layout: "proof",
      headline: "Name resolution",
      slots: ["name", "owner", "resolver", "expiry"],
    },
  },
  "miniapp-neo-pay-shared-example": {
    title: "Shared payment stream builder",
    subtitle: "Demonstrate the shared-mode NeoPay recipe with funding vault and stream vesting modules.",
    tone: "emerald",
    icon: <CreditCard className="h-5 w-5" />,
    fields: [
      { key: "beneficiary", label: "Beneficiary", defaultValue: "" },
      { key: "amount", label: "Total amount", defaultValue: "20", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Recipe", value: "shared mode" },
      { label: "Vault", value: "funding" },
      { label: "Vesting", value: "stream" },
    ],
    steps: ["Fund vault", "Create stream", "Claim vested", "Cancel if needed"],
    primaryAction: "Stage shared stream",
    visual: {
      layout: "stream",
      headline: "Shared runtime stream",
      slots: ["Vault", "Stream", "Claim", "Cancel"],
    },
  },
  "miniapp-neo-sign-anything": {
    title: "Message signing desk",
    subtitle: "Prepare a message, preview the digest, and request a wallet signature with clear verification output.",
    tone: "violet",
    icon: <FileSignature className="h-5 w-5" />,
    fields: [
      { key: "message", label: "Message", defaultValue: "I control this Neo address" },
      { key: "domain", label: "Domain", defaultValue: "neomini.app" },
    ],
    cards: [
      { label: "Digest", value: "SHA-256" },
      { label: "Wallet", value: "required" },
      { label: "Verify", value: "local" },
    ],
    steps: ["Write message", "Hash digest", "Sign wallet", "Verify signature"],
    primaryAction: "Stage signature",
    visual: {
      layout: "proof",
      headline: "Signature envelope",
      slots: ["Message", "Digest", "Signature", "Verifier"],
    },
  },
  "miniapp-neo-treasury": {
    title: "Treasury balance monitor",
    subtitle: "Track foundation and ecosystem fund balances with asset rows and balance change context.",
    tone: "slate",
    icon: <Landmark className="h-5 w-5" />,
    fields: [
      { key: "fund", label: "Fund", defaultValue: "Ecosystem Fund" },
      { key: "asset", label: "Asset", defaultValue: "NEO / GAS" },
    ],
    cards: [
      { label: "Balances", value: "indexed" },
      { label: "Outflow", value: "tracked" },
      { label: "Proof", value: "explorer" },
    ],
    steps: ["Select fund", "Read balances", "Inspect movement", "Export proof"],
    primaryAction: "Refresh treasury",
    visual: {
      layout: "ledger",
      headline: "Treasury ledger",
      slots: ["NEO", "GAS", "NEP-17", "History"],
    },
  },
  "miniapp-neodid-passport": {
    title: "NeoDID passport composer",
    subtitle: "Compose portable credential previews and prepare verification payloads for identity flows.",
    tone: "sky",
    icon: <UserCheck className="h-5 w-5" />,
    fields: [
      { key: "did", label: "NeoDID", defaultValue: "" },
      { key: "claim", label: "Credential claim", defaultValue: "KYC level 1" },
    ],
    cards: [
      { label: "Credential", value: "preview" },
      { label: "Privacy", value: "selective" },
      { label: "Verify", value: "oracle-ready" },
    ],
    steps: ["Load DID", "Select claims", "Package proof", "Verify request"],
    primaryAction: "Stage credential proof",
    visual: {
      layout: "qr",
      headline: "Passport card",
      slots: ["DID", "Claim", "Issuer", "Proof"],
    },
  },
  "miniapp-quadratic-funding": {
    title: "Quadratic funding round",
    subtitle: "Create grant allocations, preview matching pool impact, and keep donor count visible.",
    tone: "emerald",
    icon: <Medal className="h-5 w-5" />,
    fields: [
      { key: "grant", label: "Grant", defaultValue: "Open-source SDK" },
      { key: "amount", label: "Contribution", defaultValue: "5", suffix: "GAS", type: "number" },
    ],
    cards: [
      { label: "Matching", value: "quadratic" },
      { label: "Donors", value: "weighted" },
      { label: "Round", value: "open" },
    ],
    steps: ["Choose grant", "Add contribution", "Preview match", "Submit donation"],
    primaryAction: "Stage contribution",
    visual: {
      layout: "scoreboard",
      headline: "Matching pool impact",
      slots: ["Grant A", "Grant B", "Your match", "Pool"],
    },
  },
  "miniapp-recovery-guardian": {
    title: "Recovery guardian console",
    subtitle: "Review AA guardian policy, recovery ticket state, timelock, and final execution readiness.",
    tone: "rose",
    icon: <ShieldAlert className="h-5 w-5" />,
    fields: [
      { key: "account", label: "AA account", defaultValue: "" },
      { key: "guardian", label: "Guardian", defaultValue: "did:neo:guardian" },
    ],
    cards: [
      { label: "Ticket", value: "draft" },
      { label: "Timelock", value: "48h" },
      { label: "Recovery", value: "guarded" },
    ],
    steps: ["Open ticket", "Notify guardians", "Wait timelock", "Execute recovery"],
    primaryAction: "Stage recovery ticket",
    visual: {
      layout: "timeline",
      headline: "Recovery path",
      slots: ["Ticket", "Guardian", "Timelock", "Recover"],
    },
  },
  "miniapp-soulbound-certificate": {
    title: "Certificate issuer",
    subtitle: "Issue non-transferable NEP-11 certificates with recipient, claim, and metadata preview.",
    tone: "sky",
    icon: <BadgeCheck className="h-5 w-5" />,
    fields: [
      { key: "recipient", label: "Recipient", defaultValue: "" },
      { key: "title", label: "Certificate title", defaultValue: "Neo Builder" },
    ],
    cards: [
      { label: "Token", value: "NEP-11" },
      { label: "Transfer", value: "soulbound" },
      { label: "Issuer", value: "verified" },
    ],
    steps: ["Enter recipient", "Attach claim", "Mint certificate", "Share proof"],
    primaryAction: "Stage certificate",
    visual: {
      layout: "proof",
      headline: "Soulbound credential",
      slots: ["Recipient", "Claim", "Issuer", "Token ID"],
    },
  },
  "miniapp-time-capsule": {
    title: "Time capsule locker",
    subtitle: "Seal a message hash until a future unlock date with clear public proof and retrieval state.",
    tone: "amber",
    icon: <Hourglass className="h-5 w-5" />,
    fields: [
      { key: "unlock", label: "Unlock date", defaultValue: "2026-12-31" },
      { key: "message", label: "Message hash", defaultValue: "" },
    ],
    cards: [
      { label: "Seal", value: "active" },
      { label: "Unlock", value: "scheduled" },
      { label: "Proof", value: "public hash" },
    ],
    steps: ["Hash message", "Set unlock", "Seal capsule", "Open later"],
    primaryAction: "Stage capsule",
    visual: {
      layout: "timeline",
      headline: "Capsule schedule",
      slots: ["Seal", "Wait", "Unlock", "Reveal"],
    },
  },
  "miniapp-timestamp-proof": {
    title: "Timestamp proof journal",
    subtitle: "Hash local content, anchor the digest, and keep proof lookup straightforward.",
    tone: "slate",
    icon: <Hash className="h-5 w-5" />,
    fields: [
      { key: "content", label: "Content label", defaultValue: "release-notes.pdf" },
      { key: "digest", label: "Digest", defaultValue: "" },
    ],
    cards: [
      { label: "Hash", value: "local" },
      { label: "Anchor", value: "timestamp" },
      { label: "Lookup", value: "proof" },
    ],
    steps: ["Hash file", "Anchor digest", "Record block", "Verify proof"],
    primaryAction: "Stage timestamp",
    visual: {
      layout: "proof",
      headline: "Proof journal",
      slots: ["File", "SHA-256", "Block", "Verify"],
    },
  },
  "miniapp-unbreakablevault": {
    title: "Hash bounty vault",
    subtitle: "Create a bounty vault, lock secret hash conditions, and expose the claim path clearly.",
    tone: "rose",
    icon: <Vault className="h-5 w-5" />,
    fields: [
      { key: "bounty", label: "Bounty", defaultValue: "100", suffix: "GAS", type: "number" },
      { key: "hash", label: "Secret hash", defaultValue: "" },
    ],
    cards: [
      { label: "Vault", value: "locked" },
      { label: "Claim", value: "preimage" },
      { label: "Security", value: "hashlock" },
    ],
    steps: ["Lock bounty", "Publish hash", "Submit preimage", "Release reward"],
    primaryAction: "Stage vault",
    visual: {
      layout: "vault",
      headline: "Bounty vault",
      slots: ["Hash", "Bounty", "Preimage", "Release"],
    },
  },
  "miniapp-wallet-health": {
    title: "Wallet safety checkup",
    subtitle: "Run a wallet readiness checklist covering balance, permissions, suspicious approvals, and backup posture.",
    tone: "emerald",
    icon: <WalletCards className="h-5 w-5" />,
    fields: [
      { key: "wallet", label: "Wallet", defaultValue: "connected wallet" },
      { key: "scope", label: "Audit scope", defaultValue: "balances + approvals" },
    ],
    cards: [
      { label: "Risk", value: "medium" },
      { label: "Approvals", value: "review" },
      { label: "Backup", value: "check" },
    ],
    steps: ["Read balances", "Check approvals", "Review activity", "Export checklist"],
    primaryAction: "Run health check",
    visual: {
      layout: "checklist",
      headline: "Safety checklist",
      slots: ["Balance ok", "No risky approvals", "Backup checked", "Recent tx clean"],
    },
  },
};

export function hasNativePlayArea(appId: string) {
  return Boolean(
    PLAYAREA_REGISTRY[appId] ||
      ORACLE_APP_LABELS[appId] ||
      PROFILED_PLAYAREAS[appId] ||
      appId.startsWith("miniapp-oracle-"),
  );
}

export function PlayAreaRegistry(props: PlayAreaRegistryProps) {
  const Component =
    PLAYAREA_REGISTRY[props.app.app_id] ||
    (props.app.app_id.startsWith("miniapp-oracle-")
      ? OracleConsolePlayArea
      : PROFILED_PLAYAREAS[props.app.app_id]
        ? ProfiledPlayArea
        : GenericPlayArea);

  return (
    <div
      className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      data-testid={`native-playarea-${props.app.app_id}`}
    >
      <Component {...props} />
    </div>
  );
}

function getMetric(stats: Record<string, string>, label: string, fallback = "0") {
  return stats[label] || fallback;
}

function parseGas(value: string): number {
  const match = String(value || "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function formatGas(value: number) {
  if (!Number.isFinite(value)) return "0.00 GAS";
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

function useLaunchParamState(
  launchContext: MiniAppLaunchContext | null | undefined,
  keys: string | string[],
  fallback = "",
) {
  const initial = getLaunchParam(launchContext, keys, fallback);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, launchContext?.signature]);

  return [value, setValue] as const;
}

function useLaunchChoiceState<T extends string>(
  launchContext: MiniAppLaunchContext | null | undefined,
  keys: string | string[],
  options: readonly T[],
  fallback: T,
) {
  const raw = getLaunchParam(launchContext, keys, fallback);
  const initial = options.includes(raw as T) ? (raw as T) : fallback;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, launchContext?.signature]);

  return [value, setValue] as const;
}

function profileDefaultValue(field: ProfileField) {
  const value = field.defaultValue.trim();
  if (!value) return "";
  if (/(\.\.\.|builder|alice|bob|carol|cip-\d+)/i.test(value)) return "";
  return value;
}

function shortHash(value?: string | null) {
  if (!value) return "shared runtime";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function PlayShell({
  app,
  title,
  subtitle,
  tone = "emerald",
  children,
  side,
  footer,
}: {
  app: MiniAppInfo;
  title: string;
  subtitle: string;
  tone?: "emerald" | "violet" | "amber" | "rose" | "sky" | "slate";
  children: React.ReactNode;
  side?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const toneClass = {
    emerald: "from-emerald-50 via-white to-teal-50 border-emerald-100",
    violet: "from-violet-50 via-white to-indigo-50 border-violet-100",
    amber: "from-amber-50 via-white to-orange-50 border-amber-100",
    rose: "from-rose-50 via-white to-red-50 border-rose-100",
    sky: "from-sky-50 via-white to-cyan-50 border-sky-100",
    slate: "from-slate-50 via-white to-gray-50 border-slate-100",
  }[tone];

  return (
    <div className={`border bg-gradient-to-br ${toneClass}`}>
      <div className="grid gap-5 p-4 sm:p-5 2xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                {app.name}
              </p>
              <h2 className="m-0 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                {subtitle}
              </p>
            </div>
          </div>
          {children}
        </div>
        {side && <div className="min-w-0">{side}</div>}
      </div>
      {footer && <div className="border-t border-gray-200 bg-white/70 px-4 py-3 sm:px-5">{footer}</div>}
    </div>
  );
}

function ChainStateStrip({
  loading,
  error,
  contractHash,
  network,
  onRefresh,
}: Pick<PlayAreaRegistryProps, "loading" | "error" | "contractHash" | "network" | "onRefresh">) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold">
          <Radio className="h-3.5 w-3.5 text-emerald-600" />
          {loading ? "Syncing" : error ? "Local preview" : "Live state"}
        </span>
        <span className="truncate font-mono">{shortHash(contractHash)}</span>
        <span className="font-semibold uppercase text-gray-400">{network}</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600 transition hover:bg-gray-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  );
}

function MetricGrid({ stats }: { stats: PlayMetric[] }) {
  if (!stats.length) return null;
  return (
    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {stats.slice(0, 4).map((item) => (
        <div key={item.label} className="rounded-lg border border-gray-200 bg-white/80 p-3">
          <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {item.label}
          </p>
          <p className={`m-0 mt-1 truncate text-lg font-black ${item.accent ? "text-emerald-600" : "text-gray-950"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ActivityPanel({ activity }: { activity: PlayActivity | null }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-bold text-gray-900">
          {activity?.title || "Recent activity"}
        </h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
          {activity?.rows.length || 0} items
        </span>
      </div>
      {activity?.rows.length ? (
        <div className="space-y-2">
          {activity.rows.slice(0, 4).map((row, index) => (
            <div key={`${row.primary}:${index}`} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold text-gray-900">{row.primary}</p>
                  {row.secondary && <p className="m-0 mt-0.5 truncate text-xs text-gray-500">{row.secondary}</p>}
                </div>
                {row.amount && <span className="shrink-0 text-xs font-bold text-emerald-700">{row.amount}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm leading-6 text-gray-500">
          {activity?.emptyText || "No live on-chain events are available for this miniapp yet."}
        </p>
      )}
    </div>
  );
}

function PrimaryAction({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-900 bg-gray-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/60"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">{label}</span>
      <div className="flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2">
        <input
          aria-label={label}
          value={value}
          type={type}
          min={type === "number" ? "0" : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-gray-950 outline-none"
        />
        {suffix && <span className="ml-2 text-xs font-bold text-gray-400">{suffix}</span>}
      </div>
    </label>
  );
}

function LastSurvivorPlayArea(props: PlayAreaRegistryProps) {
  const { app, statsMap, stats, activity, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [keys, setKeys] = useLaunchParamState(launchContext, ["keys", "keyCount"], "3");
  const keyPrice = parseGas(getMetric(statsMap, "Key Price", "0.01 GAS")) || 0.01;
  const projected = Math.max(1, Number(keys) || 1) * keyPrice;
  const status = getMetric(statsMap, "Status", "Ready");
  const countdown = getMetric(statsMap, "Countdown", "--:--:--");
  const needsRollover = /rollover|pending|settlement|restart/i.test(status) || /rollover/i.test(countdown);
  const legacyMainnetDeployment = app.app_id === "miniapp-last-survivor" && network === "mainnet";

  return (
    <PlayShell
      app={app}
      title="Countdown auction arena"
      subtitle="Buy keys, extend the timer, and become the current leader before the round settles on-chain."
      tone="rose"
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="grid place-items-center rounded-lg border border-rose-100 bg-white/75 p-5">
          <div className="grid h-44 w-44 place-items-center rounded-full border-[10px] border-rose-500 bg-white shadow-inner">
            <div className="text-center">
              <p className="m-0 text-[10px] font-black uppercase text-rose-600">Countdown</p>
              <p className="m-0 mt-1 text-2xl font-black tabular-nums text-gray-950">
                {countdown}
              </p>
              <p className="m-0 mt-1 text-xs font-semibold text-gray-500">{status}</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {needsRollover && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="m-0 text-sm font-bold text-amber-900">Next round is ready to start</p>
              <p className="m-0 mt-1 text-xs leading-5 text-amber-800">
                {legacyMainnetDeployment
                  ? "This legacy mainnet deployment needs a one-time contract update or admin restart. The updated PlatformGame rolls future expirations into the next live countdown automatically."
                  : "The lifecycle keeper settles expired rounds automatically. New key purchases also roll the game forward before applying the bid."}
              </p>
            </div>
          )}
          <MetricGrid stats={stats} />
          <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
            <Field label="Keys to buy" value={keys} onChange={setKeys} type="number" suffix="keys" />
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <PreviewStat label="Estimated cost" value={formatGas(projected)} />
              <PreviewStat label="Current pool" value={getMetric(statsMap, "Prize Pool", "0 GAS")} />
              <PreviewStat label="Current round" value={getMetric(statsMap, "Round", "#0")} />
            </div>
            <div className="mt-4">
              <PrimaryAction>
                Preview key purchase <Timer className="h-4 w-4" />
              </PrimaryAction>
            </div>
          </div>
        </div>
      </div>
    </PlayShell>
  );
}

function FogPlayPlayArea(props: PlayAreaRegistryProps) {
  const { app, statsMap, stats, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [side, setSide] = useLaunchChoiceState(launchContext, ["side", "choice"], ["heads", "tails"] as const, "heads");
  const [amount, setAmount] = useLaunchParamState(launchContext, ["amount", "stake", "bet"], "0.10");
  const [spin, setSpin] = useState(false);
  const payout = (Number(amount) || 0) * 2;

  return (
    <PlayShell
      app={app}
      title="Coin flip table"
      subtitle="Choose heads or tails, size the bet, then submit from the shared action console when the preview looks right."
      tone="violet"
      side={<MetricGrid stats={stats} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid place-items-center rounded-lg border border-violet-100 bg-slate-950 p-5 text-white">
          <button
            type="button"
            onClick={() => setSpin((value) => !value)}
            className={`grid h-36 w-36 cursor-pointer place-items-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-3xl font-black text-amber-950 shadow-2xl transition ${spin ? "rotate-180" : ""}`}
            aria-label="Flip local coin preview"
          >
            {side === "heads" ? "H" : "T"}
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["heads", "tails"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSide(option)}
                className={`rounded-lg border px-4 py-3 text-sm font-black capitalize transition ${
                  side === option
                    ? "border-violet-500 bg-violet-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <Field label="Stake" value={amount} onChange={setAmount} type="number" suffix="GAS" />
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Potential payout" value={formatGas(payout)} />
            <PreviewStat label="Min bet" value={getMetric(statsMap, "Min Bet", "--")} />
            <PreviewStat label="Max bet" value={getMetric(statsMap, "Max Bet", "--")} />
          </div>
          <PrimaryAction>
            Stage coin flip <Dice5 className="h-4 w-4" />
          </PrimaryAction>
        </div>
      </div>
    </PlayShell>
  );
}

function GasBoxPlayArea(props: PlayAreaRegistryProps) {
  const { app, statsMap, stats, activity, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [selectedRaw, setSelectedRaw] = useLaunchParamState(launchContext, ["machine", "machineId", "box"], "1");
  const selected = Math.max(1, Number(selectedRaw) || 1);
  const machines = Math.max(1, Number(getMetric(statsMap, "Total Machines", "3")) || 3);

  return (
    <PlayShell
      app={app}
      title="GASBox gacha machine"
      subtitle="Pick a machine, inspect its capsule pool, and stage a draw before sending the on-chain play operation."
      tone="amber"
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-lg border border-amber-100 bg-white/80 p-5">
          <div className="mx-auto grid h-56 max-w-[180px] place-items-center rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 p-4 shadow-inner">
            <div className="grid h-28 w-28 grid-cols-3 gap-1 rounded-full border-4 border-white/70 bg-white/50 p-3">
              {["bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-violet-400", "bg-yellow-300", "bg-pink-400"].map((color, index) => (
                <span key={`${color}:${index}`} className={`rounded-full ${color}`} />
              ))}
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
              Machine #{selected}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: Math.min(machines, 6) }, (_, index) => index + 1).map((machine) => (
              <button
                key={machine}
                type="button"
                onClick={() => setSelectedRaw(String(machine))}
                className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                  selected === machine ? "border-amber-500 bg-amber-500 text-white" : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                #{machine}
              </button>
            ))}
          </div>
          <MetricGrid stats={stats} />
          <PrimaryAction>
            Stage capsule draw <Boxes className="h-4 w-4" />
          </PrimaryAction>
        </div>
      </div>
    </PlayShell>
  );
}

function RedEnvelopePlayArea(props: PlayAreaRegistryProps) {
  const { app, stats, activity, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [amount, setAmount] = useLaunchParamState(launchContext, ["amount", "total"], "5");
  const [packets, setPackets] = useLaunchParamState(launchContext, ["packets", "count"], "8");
  const avg = (Number(amount) || 0) / Math.max(1, Number(packets) || 1);

  return (
    <PlayShell
      app={app}
      title="Lucky packet desk"
      subtitle="Create a GAS envelope, split it into packets, and share the envelope ID for friends to open."
      tone="rose"
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid place-items-center rounded-lg border border-red-100 bg-red-50 p-5">
          <div className="relative h-44 w-36 rounded-2xl bg-gradient-to-b from-red-500 to-red-700 shadow-xl">
            <div className="absolute left-1/2 top-14 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-amber-300 text-xl font-black text-red-800">
              GAS
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/15 p-2 text-center text-xs font-bold text-white">
              {packets} packets
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Envelope amount" value={amount} onChange={setAmount} type="number" suffix="GAS" />
            <Field label="Packet count" value={packets} onChange={setPackets} type="number" suffix="claims" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Average packet" value={formatGas(avg)} />
            <PreviewStat label="Split mode" value="VRF lucky" />
            <PreviewStat label="Share code" value="after submit" />
          </div>
          <MetricGrid stats={stats} />
          <PrimaryAction>
            Prepare envelope <Gift className="h-4 w-4" />
          </PrimaryAction>
        </div>
      </div>
    </PlayShell>
  );
}

function DailyCheckinPlayArea(props: PlayAreaRegistryProps) {
  const { app, statsMap, stats, loading, error, contractHash, network, onRefresh } = props;
  const [claimed, setClaimed] = useState(5);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <PlayShell
      app={app}
      title="Daily streak board"
      subtitle="One daily check-in keeps the streak alive. The seventh day unlocks the bigger reward."
      tone="emerald"
      side={<MetricGrid stats={stats} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const active = index < claimed;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setClaimed(index + 1)}
                className={`min-h-20 rounded-lg border px-2 py-3 text-center transition ${
                  active ? "border-emerald-300 bg-emerald-500 text-white" : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                <CalendarCheck className="mx-auto mb-2 h-5 w-5" />
                <span className="block text-xs font-black">{day}</span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Current streak" value={`${claimed} days`} />
          <PreviewStat label="7-day reward" value={getMetric(statsMap, "7-Day Reward", "--")} />
          <PreviewStat label="Total rewarded" value={getMetric(statsMap, "Total Rewarded", "0 GAS")} />
        </div>
        <PrimaryAction>
          Mark today ready <CheckCircle2 className="h-4 w-4" />
        </PrimaryAction>
      </div>
    </PlayShell>
  );
}

function SelfLoanPlayArea(props: PlayAreaRegistryProps) {
  const { app, statsMap, stats, activity, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [collateral, setCollateral] = useLaunchParamState(launchContext, ["collateral", "neo"], "20");
  const ltv = 0.35;
  const borrowable = (Number(collateral) || 0) * ltv;

  return (
    <PlayShell
      app={app}
      title="Self-repaying loan panel"
      subtitle="Lock NEO, draw GAS, and route future yield toward repayment without liquidation."
      tone="sky"
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="space-y-4">
        <Field label="NEO collateral" value={collateral} onChange={setCollateral} type="number" suffix="NEO" />
        <div className="grid gap-2 sm:grid-cols-4">
          <PreviewStat label="Borrowable GAS" value={formatGas(borrowable)} />
          <PreviewStat label="LTV preview" value="35%" />
          <PreviewStat label="Locked collateral" value={getMetric(statsMap, "Collateral Locked", "0 NEO")} />
          <PreviewStat label="Outstanding debt" value={getMetric(statsMap, "Outstanding Debt", "0 GAS")} />
        </div>
        <MetricGrid stats={stats} />
        <PrimaryAction>
          Prepare loan request <Landmark className="h-4 w-4" />
        </PrimaryAction>
      </div>
    </PlayShell>
  );
}

function ProfitAnchorPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorPlayArea {...props} mode="profit" />;
}

function TrustAnchorPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorPlayArea {...props} mode="trust" />;
}

function AnchorPlayArea(props: PlayAreaRegistryProps & { mode: "profit" | "trust" }) {
  const { app, statsMap, stats, activity, loading, error, contractHash, network, launchContext, onRefresh, mode } = props;
  const [candidate, setCandidate] = useLaunchParamState(launchContext, ["candidate", "agent", "route"], "Agent #1");
  const [stake, setStake] = useLaunchParamState(launchContext, ["stake", "amount"], "25");
  const isProfit = mode === "profit";

  return (
    <PlayShell
      app={app}
      title={isProfit ? "Profit route voting" : "Trust route staking"}
      subtitle={isProfit ? "Stake NEO and vote for the AA agent with the strongest yield route." : "Stake NEO and route governance voting through trusted AA agents."}
      tone={isProfit ? "emerald" : "slate"}
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stake amount" value={stake} onChange={setStake} type="number" suffix="NEO" />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Route</span>
            <select
              value={candidate}
              onChange={(event) => setCandidate(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-950 outline-none"
            >
              <option>Agent #1</option>
              <option>Agent #2</option>
              <option>Agent #3</option>
            </select>
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <PreviewStat label="Selected route" value={candidate} />
          <PreviewStat label="Total staked" value={getMetric(statsMap, "Total Staked", "0 NEO")} />
          <PreviewStat label="Agents" value={getMetric(statsMap, "Agents", "0")} />
          <PreviewStat label="Rewards" value={getMetric(statsMap, "Reward Reserve", "0 GAS")} />
        </div>
        <MetricGrid stats={stats} />
        <PrimaryAction>
          Stage stake and vote <Vote className="h-4 w-4" />
        </PrimaryAction>
      </div>
    </PlayShell>
  );
}

function NeoPayPlayArea(props: PlayAreaRegistryProps) {
  const { app, statsMap, stats, activity, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [amount, setAmount] = useLaunchParamState(launchContext, ["amount", "total"], "12");
  const [rate, setRate] = useLaunchParamState(launchContext, ["rate", "releaseRate"], "1");
  const duration = Math.ceil((Number(amount) || 0) / Math.max(0.01, Number(rate) || 1));

  return (
    <PlayShell
      app={app}
      title="Payment stream builder"
      subtitle="Compose a payroll, grant, or escrow stream with release cadence and beneficiary before submitting."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Total amount" value={amount} onChange={setAmount} type="number" suffix="GAS" />
          <Field label="Release rate" value={rate} onChange={setRate} type="number" suffix="GAS / day" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase text-gray-500">
            <span>Stream timeline</span>
            <span>{duration} days</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-400 to-neo" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Total streams" value={getMetric(statsMap, "Total Streams", "0")} />
            <PreviewStat label="Asset" value="GAS" />
            <PreviewStat label="Release type" value="linear" />
          </div>
        </div>
        <MetricGrid stats={stats} />
        <PrimaryAction>
          Prepare stream <CreditCard className="h-4 w-4" />
        </PrimaryAction>
      </div>
    </PlayShell>
  );
}

type TarotCard = {
  id: number;
  name: string;
  keyword: string;
  meaning: string;
  image: string;
};

function TarotPlayArea(props: PlayAreaRegistryProps) {
  const { app, loading, error, contractHash, network, onRefresh } = props;
  const [deck, setDeck] = useState<TarotCard[]>([]);
  const [drawn, setDrawn] = useState<TarotCard[]>([]);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/miniapps/on-chain-tarot/cards/index.json")
      .then((response) => (response.ok ? response.json() : []))
      .then((cards: TarotCard[]) => {
        if (!cancelled && Array.isArray(cards)) setDeck(cards);
      })
      .catch(() => {
        if (!cancelled) setDeck([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const drawCards = useCallback(() => {
    const source = deck.length ? deck : FALLBACK_TAROT;
    const seed = Date.now();
    const picks = [0, 1, 2].map((offset) => source[(seed + offset * 17) % source.length]);
    setDrawn(picks);
    setFlipped(false);
  }, [deck]);

  useEffect(() => {
    if (drawn.length === 0) drawCards();
  }, [drawCards, drawn.length]);

  return (
    <PlayShell
      app={app}
      title="Draw, flip, read"
      subtitle="The first screen is the reading table: draw three cards, flip them, and use the action console for the on-chain request."
      tone="violet"
      side={
        <div className="rounded-lg border border-violet-100 bg-white/85 p-4">
          <h3 className="m-0 text-sm font-bold text-gray-950">Reading spread</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <PreviewStat label="Deck" value={`${deck.length || FALLBACK_TAROT.length} cards`} />
            <PreviewStat label="Spread" value="Past / Signal / Path" />
            <PreviewStat label="Randomness" value="Neo block seed" />
          </div>
        </div>
      }
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {(drawn.length ? drawn : FALLBACK_TAROT.slice(0, 3)).map((card, index) => {
            const image = card.image?.replace("./cards/", "/miniapps/on-chain-tarot/cards/");
            return (
              <button
                key={`${card.id}:${index}`}
                type="button"
                onClick={() => setFlipped(true)}
                className="group min-h-[260px] cursor-pointer rounded-lg border border-violet-100 bg-slate-950 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {flipped ? (
                  <div className="h-full">
                    <img src={image} alt={card.name} className="mx-auto aspect-[2/3] h-44 rounded-md object-cover" />
                    <p className="m-0 mt-3 text-sm font-black text-white">{card.name}</p>
                    <p className="m-0 mt-1 text-xs text-violet-200">{card.keyword} / {card.meaning}</p>
                  </div>
                ) : (
                  <div className="grid h-full min-h-[232px] place-items-center rounded-md border border-violet-300/30 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.3),transparent_45%),linear-gradient(135deg,#111827,#312e81)]">
                    <div className="text-center text-white">
                      <WandSparkles className="mx-auto mb-3 h-8 w-8 text-neo" />
                      <p className="m-0 text-xs font-bold uppercase tracking-wide text-violet-200">
                        {["Past", "Signal", "Path"][index]}
                      </p>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryAction onClick={() => setFlipped(true)}>
            Flip reading <Sparkles className="h-4 w-4" />
          </PrimaryAction>
          <button
            type="button"
            onClick={drawCards}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Draw again
          </button>
        </div>
      </div>
    </PlayShell>
  );
}

type ExplorerNetworkStats = {
  height: number;
  txCount: number | null;
  txCountSource?: string;
};

type ExplorerStatsPayload = {
  mainnet?: ExplorerNetworkStats;
  testnet?: ExplorerNetworkStats;
};

type ExplorerSearchPayload = {
  type?: string;
  found?: boolean;
  network?: string;
  data?: Record<string, unknown>;
  address?: string;
  tx_count?: number;
  transactions?: Array<Record<string, unknown>>;
  contract_hash?: string;
  call_count?: number;
  calls?: Array<Record<string, unknown>>;
  source?: string;
};

type ExplorerRecentTx = {
  hash?: string;
  tx_hash?: string;
  vm_state?: string;
  vmState?: string;
  block_time?: string;
  blockTime?: string;
};

function ExplorerPlayArea(props: PlayAreaRegistryProps) {
  const { app, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const launchNetwork = launchContext?.network ?? network;
  const [selectedNetwork, setSelectedNetwork] = useState<"mainnet" | "testnet">(launchNetwork);
  const [query, setQuery] = useLaunchParamState(launchContext, ["query", "q", "hash", "address", "height"], "");
  const [stats, setStats] = useState<ExplorerStatsPayload | null>(null);
  const [recent, setRecent] = useState<ExplorerRecentTx[]>([]);
  const [result, setResult] = useState<ExplorerSearchPayload | null>(null);
  const [status, setStatus] = useState("Ready");
  const [isFetching, setIsFetching] = useState(false);

  const loadExplorerData = useCallback(async () => {
    setIsFetching(true);
    setStatus("Syncing explorer APIs...");
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch("/api/explorer/stats"),
        fetch(`/api/explorer/recent?network=${selectedNetwork}&limit=5`),
      ]);

      if (!statsRes.ok) throw new Error(`stats ${statsRes.status}`);
      const statsPayload = (await statsRes.json()) as ExplorerStatsPayload;
      setStats(statsPayload);

      if (recentRes.ok) {
        const recentPayload = (await recentRes.json()) as { transactions?: ExplorerRecentTx[] };
        setRecent(Array.isArray(recentPayload.transactions) ? recentPayload.transactions : []);
      } else {
        setRecent([]);
      }
      setStatus("Live chain data loaded");
    } catch (err) {
      setStatus(err instanceof Error ? `Explorer API unavailable: ${err.message}` : "Explorer API unavailable");
      setRecent([]);
    } finally {
      setIsFetching(false);
    }
  }, [selectedNetwork]);

  useEffect(() => {
    setSelectedNetwork(launchContext?.network ?? network);
  }, [launchContext?.network, network]);

  useEffect(() => {
    void loadExplorerData();
  }, [loadExplorerData]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setStatus("Enter a block height, tx hash, address, or contract hash.");
      return;
    }
    setIsFetching(true);
    setResult(null);
    setStatus("Resolving on chain...");
    try {
      const res = await fetch(
        `/api/explorer/search?q=${encodeURIComponent(trimmed)}&network=${selectedNetwork}`,
      );
      const payload = (await res.json()) as ExplorerSearchPayload & { error?: string };
      if (!res.ok || payload.error) {
        throw new Error(payload.error || `search ${res.status}`);
      }
      setResult(payload);
      setStatus(payload.found ? "Resolved from live data" : "No matching live record found");
    } catch (err) {
      setStatus(err instanceof Error ? `Search failed: ${err.message}` : "Search failed");
    } finally {
      setIsFetching(false);
    }
  }, [query, selectedNetwork]);

  const selectedStats = stats?.[selectedNetwork];
  const height = selectedStats?.height ? selectedStats.height.toLocaleString() : "Unavailable";
  const txCount =
    typeof selectedStats?.txCount === "number"
      ? selectedStats.txCount.toLocaleString()
      : "Indexer unavailable";
  const resultStats: PlayMetric[] = [
    { label: "Network", value: selectedNetwork, accent: true },
    { label: "Block height", value: height, accent: true },
    { label: "Indexed tx", value: txCount },
    { label: "Result", value: result?.found ? String(result.type || "found") : "none" },
  ];

  return (
    <PlayShell
      app={app}
      title="Live explorer console"
      subtitle="Query Neo N3 blocks, transactions, addresses, and contracts through live RPC/indexer endpoints. Missing indexer data is shown as unavailable, never synthesized."
      tone="slate"
      side={
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
            <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
              <History className="h-4 w-4 text-slate-600" />
              Recent live transactions
            </h3>
            <div className="mt-3 space-y-2">
              {recent.length > 0 ? (
                recent.map((tx, index) => {
                  const hash = String(tx.hash || tx.tx_hash || "");
                  const state = String(tx.vmState || tx.vm_state || "");
                  return (
                    <button
                      type="button"
                      key={`${hash}:${index}`}
                      onClick={() => setQuery(hash)}
                      className="block w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left transition hover:bg-white"
                    >
                      <span className="block truncate font-mono text-xs font-bold text-gray-950">
                        {shortHash(hash)}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold text-gray-500">
                        {state || "state unavailable"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="m-0 text-sm leading-6 text-gray-500">
                  Recent transaction indexer is not configured or has no rows for this network.
                </p>
              )}
            </div>
          </div>
          <ActivityPanel activity={props.activity} />
        </div>
      }
      footer={
        <ChainStateStrip
          loading={loading || isFetching}
          error={error}
          contractHash={contractHash}
          network={selectedNetwork}
          onRefresh={() => {
            onRefresh();
            void loadExplorerData();
          }}
        />
      }
    >
      <div className="space-y-4">
        <MetricGrid stats={resultStats} />
        <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["mainnet", "testnet"] as const).map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setSelectedNetwork(item)}
                className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                  selectedNetwork === item
                    ? "border-gray-950 bg-gray-950 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Explorer query
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Explorer query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runSearch();
                }}
                placeholder="Block height, 0x tx/block hash, N-address, or 0x contract hash"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-950 outline-none transition focus:border-neo focus:ring-2 focus:ring-neo/20"
              />
              <PrimaryAction onClick={runSearch}>
                Run live query <SearchCheck className="h-4 w-4" />
              </PrimaryAction>
            </div>
          </label>
          <p className="m-0 mt-3 text-xs font-semibold text-gray-500" role="status">
            {status}
          </p>
        </div>
        <ExplorerResultPanel result={result} />
      </div>
    </PlayShell>
  );
}

function ExplorerResultPanel({ result }: { result: ExplorerSearchPayload | null }) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white/70 p-4 text-sm font-semibold text-gray-500">
        Search results will appear here after a live RPC or indexer response.
      </div>
    );
  }

  if (!result.found) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        No live record found for this query on {result.network || "the selected network"}.
        {result.source === "indexer_unavailable" ? " Address history requires the indexer service." : ""}
      </div>
    );
  }

  const data = result.data || {};
  const rows =
    result.type === "block"
      ? [
          ["Block", String(data.index ?? "")],
          ["Hash", String(data.hash ?? "")],
          ["Transactions", String(data.tx_count ?? "")],
          ["Size", data.size == null ? "" : `${String(data.size)} bytes`],
        ]
      : result.type === "transaction"
        ? [
            ["Hash", String(data.hash ?? "")],
            ["VM state", String(data.vm_state ?? data.vmstate ?? "")],
            ["Block", String(data.block_index ?? data.blockindex ?? "")],
            ["Sender", String(data.sender ?? "")],
          ]
        : result.type === "address"
          ? [
              ["Address", String(result.address ?? "")],
              ["Transactions", String(result.tx_count ?? 0)],
              ["Source", "indexer"],
            ]
          : [
              ["Contract", String(result.contract_hash ?? "")],
              ["Calls", String(result.call_count ?? 0)],
              ["Source", String(result.source || "indexer")],
            ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Hash className="h-4 w-4 text-emerald-600" />
        <h3 className="m-0 text-sm font-black capitalize text-gray-950">
          {result.type} result
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <PreviewStat key={label} label={label} value={value || "Unavailable"} />
        ))}
      </div>
    </div>
  );
}

function NeoXBridgePlayArea(props: PlayAreaRegistryProps) {
  const { app, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [amount, setAmount] = useLaunchParamState(launchContext, ["amount"], "");
  const [direction, setDirection] = useLaunchChoiceState(
    launchContext,
    ["direction", "route"],
    ["Neo N3 -> Neo X", "Neo X -> Neo N3"] as const,
    "Neo N3 -> Neo X",
  );
  const [targetContract, setTargetContract] = useLaunchParamState(launchContext, ["targetContract", "contract", "to"], "");
  const [bridgeMessage, setBridgeMessage] = useLaunchParamState(launchContext, ["message", "payload"], "");

  return (
    <PlayShell
      app={app}
      title="Neo X bridge control console"
      subtitle="Operate asset bridge, Message Bridge, and operation status tracking without leaving the platform shell."
      tone="sky"
      side={<BridgeStatusPanel />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <ToolCard icon={<ArrowRightLeft className="h-5 w-5" />} title="Asset bridge">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Direction</span>
            <select value={direction} onChange={(event) => setDirection(event.target.value as "Neo N3 -> Neo X" | "Neo X -> Neo N3")} className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold">
              <option>{"Neo N3 -> Neo X"}</option>
              <option>{"Neo X -> Neo N3"}</option>
            </select>
          </label>
          <Field label="Amount" value={amount} onChange={setAmount} type="number" suffix="GAS" />
          <PreviewStat label="Route" value={direction} />
        </ToolCard>
        <ToolCard icon={<MessageSquareText className="h-5 w-5" />} title="Message Bridge">
          <Field label="Target contract" value={targetContract} onChange={setTargetContract} />
          <Field label="Message" value={bridgeMessage} onChange={setBridgeMessage} />
          <PreviewStat label="Encoding" value="UTF-8 payload" />
        </ToolCard>
        <ToolCard icon={<ReceiptText className="h-5 w-5" />} title="Status tracking">
          <PreviewStat label="Lock tx" value="pending input" />
          <PreviewStat label="Relay" value="waiting proof" />
          <PreviewStat label="Finality" value="not submitted" />
        </ToolCard>
      </div>
    </PlayShell>
  );
}

type PrivateTransferResult = {
  status: "idle" | "sealing" | "stored" | "error";
  message: string;
  noteCommitment?: string;
  nullifier?: string;
  secretRef?: string;
  contract?: string;
};

function PrivateTransferPlayArea(props: PlayAreaRegistryProps) {
  const { app, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const [recipient, setRecipient] = useLaunchParamState(launchContext, ["recipient", "to", "address"], "");
  const [amount, setAmount] = useLaunchParamState(launchContext, ["amount"], "");
  const [asset, setAsset] = useLaunchChoiceState(launchContext, ["asset", "token"], ["GAS", "NEO"] as const, "GAS");
  const [memo, setMemo] = useLaunchParamState(launchContext, ["memo", "note"], "");
  const [result, setResult] = useState<PrivateTransferResult>({
    status: "idle",
    message: "Ready to seal transfer instructions locally.",
  });

  const sealTransfer = useCallback(async () => {
    setResult({
      status: "sealing",
      message: "Fetching Morpheus public key and building a local X25519 envelope.",
    });
    try {
      const keyResponse = await fetch(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(keyMeta?.error || "Morpheus oracle public key is unavailable");
      }
      if (
        keyMeta.algorithm &&
        keyMeta.algorithm !== "X25519-HKDF-SHA256-AES-256-GCM"
      ) {
        throw new Error(`Unsupported Morpheus encryption algorithm: ${keyMeta.algorithm}`);
      }

      const transferPackage = await buildConfidentialTransferPackage({
        appId: app.app_id,
        network,
        recipient,
        asset,
        amount,
        memo,
      });
      const ciphertext = await encryptJsonWithOraclePublicKey(
        String(keyMeta.public_key),
        transferPackage.confidentialPayload,
      );
      const storeResponse = await fetch("/api/morpheus/confidential/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          target_chain: "neo_n3",
          app_id: app.app_id,
          name: `private-transfer:${transferPackage.publicEnvelope.note_commitment}`,
          ciphertext,
          public_envelope: transferPackage.publicEnvelope,
        }),
      });
      const stored = await storeResponse.json().catch(() => ({}));
      if (!storeResponse.ok) {
        throw new Error(stored?.error || stored?.message || "Morpheus confidential store is unavailable");
      }
      const storedRef = String(stored.secret_ref || stored.id || stored.ref || "").trim();
      if (!storedRef) {
        throw new Error("Morpheus confidential store did not return a secret reference");
      }

      setResult({
        status: "stored",
        message: "Encrypted transfer intent stored. Only the TEE can decrypt recipient, amount, memo, and note secret.",
        noteCommitment: transferPackage.publicEnvelope.note_commitment,
        nullifier: transferPackage.publicEnvelope.nullifier_hash,
        secretRef: storedRef,
        contract: String(keyMeta.contract || ""),
      });
    } catch (sealError) {
      setResult({
        status: "error",
        message: sealError instanceof Error ? sealError.message : String(sealError),
      });
    }
  }, [amount, app.app_id, asset, memo, network, recipient]);

  return (
    <PlayShell
      app={app}
      title="Confidential transfer desk"
      subtitle="A zERC20-style private transfer workflow without on-chain zk curve assumptions: seal transfer details locally, let Morpheus confidential compute validate them inside the TEE, then return a signed settlement intent."
      tone="slate"
      side={<PrivateTransferStatusPanel result={result} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white/85 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recipient" value={recipient} onChange={setRecipient} />
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Asset</span>
              <select
                value={asset}
                onChange={(event) => setAsset(event.target.value as "GAS" | "NEO")}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-950 outline-none"
              >
                <option>GAS</option>
                <option>NEO</option>
              </select>
            </label>
            <Field label="Amount" value={amount} onChange={setAmount} type="number" suffix={asset} />
            <Field label="Private memo" value={memo} onChange={setMemo} />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Privacy layer" value="Morpheus confidential compute" />
            <PreviewStat label="Local encryption" value="X25519 + AES-256-GCM" />
            <PreviewStat label="Public chain data" value="commitment + nullifier" />
          </div>

          <PrimaryAction onClick={sealTransfer}>
            {result.status === "sealing" ? "Sealing..." : "Seal private transfer"}
            <LockKeyhole className="h-4 w-4" />
          </PrimaryAction>
        </div>

        <div className="rounded-lg border border-gray-200 bg-slate-950 p-4 text-white">
          <h3 className="m-0 flex items-center gap-2 text-sm font-black">
            <ShieldCheck className="h-4 w-4 text-neo" />
            Privacy flow
          </h3>
          <div className="mt-4 space-y-3">
            {[
              "Deposit asset into a public escrow or wallet-signed intent.",
              "Encrypt recipient, amount, memo, and note secret in the browser.",
              "Morpheus TEE decrypts, checks policy, and signs a settlement envelope.",
              "Wallet submits release or refund with the signed result.",
            ].map((step, index) => (
              <div key={step} className="flex gap-3 text-sm text-slate-200">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PlayShell>
  );
}

function PrivateTransferStatusPanel({ result }: { result: PrivateTransferResult }) {
  const tone =
    result.status === "stored"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : result.status === "error"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-gray-200 bg-white text-gray-950";

  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <h3 className="m-0 text-sm font-black">Morpheus confidential compute</h3>
      <p className="mt-2 text-sm leading-6">{result.message}</p>
      <div className="mt-3 space-y-2">
        {result.secretRef && <PreviewStat label="Secret ref" value={result.secretRef} />}
        {result.noteCommitment && <PreviewStat label="Note commitment" value={result.noteCommitment} />}
        {result.nullifier && <PreviewStat label="Nullifier hash" value={result.nullifier} />}
        {result.contract && <PreviewStat label="Oracle contract" value={shortHash(result.contract)} />}
      </div>
    </div>
  );
}

function OracleConsolePlayArea(props: PlayAreaRegistryProps) {
  const { app, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const config = ORACLE_APP_LABELS[app.app_id] || { title: app.name, mode: "http" as const };
  const [endpoint, setEndpoint] = useLaunchParamState(
    launchContext,
    ["endpoint", "url", "feed", "symbol"],
    config.mode === "price" ? "TWELVEDATA:NEO-USD" : "https://oracle.meshmini.app/health",
  );
  const [result, setResult] = useState("Ready to build request package.");
  const [sealing, setSealing] = useState(false);
  const confidentialMode =
    config.mode === "compute" ||
    config.mode === "seal" ||
    config.mode === "neodid";

  const build = () => {
    const payload = {
      app_id: app.app_id,
      mode: config.mode,
      endpoint,
      callback: "onOracleResult(requestId, result)",
      nep21: true,
    };
    setResult(JSON.stringify(payload, null, 2));
  };

  const seal = async () => {
    setSealing(true);
    try {
      const keyResponse = await fetch(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(keyMeta?.error || "Morpheus oracle public key is unavailable");
      }
      const confidentialPayload = {
        kind: `oracle.${config.mode}.confidential.v1`,
        app_id: app.app_id,
        mode: config.mode,
        target_chain: "neo_n3",
        network,
        request: config.mode === "compute"
          ? { workflow: "private-transfer-or-policy-check", input: endpoint }
          : config.mode === "neodid"
            ? { provider: "neodid", subject: endpoint }
            : { payload: endpoint },
      };
      const ciphertext = await encryptJsonWithOraclePublicKey(
        String(keyMeta.public_key),
        confidentialPayload,
      );
      const storeResponse = await fetch("/api/morpheus/confidential/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network,
          target_chain: "neo_n3",
          app_id: app.app_id,
          name: `${app.app_id}:${config.mode}`,
          ciphertext,
        }),
      });
      const stored = await storeResponse.json().catch(() => ({}));
      setResult(JSON.stringify({
        status: storeResponse.ok ? "sealed_ref" : "sealed_inline",
        mode: config.mode,
        encryption: keyMeta.algorithm || "X25519-HKDF-SHA256-AES-256-GCM",
        encrypted_payload: storeResponse.ok ? undefined : ciphertext,
        secret_ref: storeResponse.ok ? stored.secret_ref || stored.id || stored.ref || "stored" : undefined,
        public_key_contract: keyMeta.contract,
      }, null, 2));
    } catch (sealError) {
      setResult(JSON.stringify({
        status: "seal_failed",
        error: sealError instanceof Error ? sealError.message : String(sealError),
      }, null, 2));
    } finally {
      setSealing(false);
    }
  };

  return (
    <PlayShell
      app={app}
      title={config.title}
      subtitle="Build a Morpheus request, inspect the callback shape, and verify the result envelope in the same native console."
      tone="slate"
      side={<OracleStatusPanel mode={config.mode} result={result} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <ToolCard icon={<Radio className="h-5 w-5" />} title="Request">
          <Field label={config.mode === "price" ? "Feed symbol" : "Endpoint"} value={endpoint} onChange={setEndpoint} />
          <PreviewStat label="Wallet path" value="NEP-21" />
        </ToolCard>
        <ToolCard icon={<LockKeyhole className="h-5 w-5" />} title="Private fields">
          <PreviewStat label="Encryption" value={confidentialMode ? "X25519 sealed" : "optional"} />
          <PreviewStat label="Runtime" value={config.mode === "compute" ? "TEE compute" : "Morpheus oracle"} />
          {confidentialMode && (
            <button
              type="button"
              onClick={seal}
              disabled={sealing}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65"
            >
              {sealing ? "Sealing..." : "Seal with Morpheus"}
              <LockKeyhole className="h-4 w-4" />
            </button>
          )}
        </ToolCard>
        <ToolCard icon={<BadgeCheck className="h-5 w-5" />} title="Verification">
          <PreviewStat label="Callback" value="configured" />
          <PreviewStat label="Envelope" value="verifiable" />
          <PrimaryAction onClick={build}>
            Build package <Send className="h-4 w-4" />
          </PrimaryAction>
        </ToolCard>
      </div>
    </PlayShell>
  );
}

function ProfiledPlayArea(props: PlayAreaRegistryProps) {
  const { app, stats, activity, loading, error, contractHash, network, launchContext, onRefresh } = props;
  const profile = PROFILED_PLAYAREAS[app.app_id];
  const initialValues = useCallback(
	    () =>
	      Object.fromEntries(
	        profile.fields.map((field) => [
            field.key,
            getLaunchParam(launchContext, field.key, profileDefaultValue(field)),
          ]),
	      ) as Record<string, string>,
	    [launchContext, profile],
	  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    setValues(initialValues());
  }, [initialValues]);

	  const profileMetrics =
	    stats.length > 0
	      ? stats
	      : [{ label: "Live stats", value: "Unavailable" }];

  return (
    <PlayShell
      app={app}
      title={profile.title}
      subtitle={profile.subtitle}
      tone={profile.tone}
      side={
        <div className="space-y-3">
          <ProfileWorkflowPanel profile={profile} />
          <ActivityPanel activity={activity} />
        </div>
      }
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <ProfileVisualPanel profile={profile} values={values} />
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                value={values[field.key] ?? ""}
                onChange={(next) =>
                  setValues((current) => ({ ...current, [field.key]: next }))
                }
                suffix={field.suffix}
                type={field.type}
              />
            ))}
          </div>
          <MetricGrid stats={profileMetrics} />
          <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                {profile.icon}
              </span>
              <div>
                <p className="m-0 text-sm font-black text-gray-950">
                  Prepare wallet action
                </p>
                <p className="m-0 text-xs text-gray-500">
                  This panel prepares inputs only. Final values come from the wallet,
                  live contract reads, and the shared action console.
                </p>
              </div>
            </div>
            <PrimaryAction>
              {profile.primaryAction}
              <ArrowRightLeft className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
      </div>
    </PlayShell>
  );
}

function ProfileWorkflowPanel({ profile }: { profile: PlayAreaProfile }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-700">
          {profile.icon}
        </span>
        Workflow
      </h3>
      <div className="mt-4 space-y-3">
        {profile.steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-950 text-xs font-black text-white">
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-gray-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileVisualPanel({
  profile,
  values,
}: {
  profile: PlayAreaProfile;
  values: Record<string, string>;
}) {
  const slots = profile.visual.slots.slice(0, 4);
  const primaryInput = Object.values(values).find(Boolean) || profile.visual.headline;

  switch (profile.visual.layout) {
    case "pipeline":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="grid gap-2">
            {slots.map((slot, index) => (
              <div key={slot} className="flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="m-0 truncate text-sm font-black text-gray-950">{slot}</p>
                  <p className="m-0 mt-0.5 text-[11px] font-semibold text-gray-400">
                    step {index + 1}
                  </p>
                </div>
                {index < slots.length - 1 && <ArrowRightLeft className="h-4 w-4 shrink-0 text-gray-400" />}
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "market":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {slots.map((slot, index) => (
              <div key={slot} className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="m-0 text-sm font-black text-gray-950">{slot}</p>
	                <p className="m-0 mt-1 text-xs text-gray-500">
	                  {index === 0 ? primaryInput : "requires live state"}
	                </p>
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "ballot":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="space-y-3">
            {slots.map((slot, index) => (
              <div key={slot}>
                <div className="mb-1 flex items-center justify-between text-xs font-bold text-gray-500">
                  <span>{slot}</span>
	                  <span>live value required</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
	                  <div className="h-full w-0 rounded-full bg-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "scoreboard":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="space-y-2">
            {slots.map((slot, index) => (
              <div key={slot} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-sm font-black text-amber-700">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-gray-950">
                  {slot}
                </span>
                <Trophy className="h-4 w-4 text-amber-500" />
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "proof":
      return (
        <ProfileVisualFrame profile={profile}>
          <pre className="m-0 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-5 text-emerald-200">
{`{
  "subject": "${primaryInput}",
  "fields": [${slots.map((slot) => `"${slot}"`).join(", ")}],
	  "status": "requires-wallet-and-chain-validation"
}`}
          </pre>
        </ProfileVisualFrame>
      );
    case "vault":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="grid place-items-center rounded-lg border border-gray-200 bg-slate-950 p-5 text-white">
            <Vault className="h-12 w-12 text-neo" />
            <p className="m-0 mt-3 text-center text-sm font-black">{primaryInput}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {slots.map((slot) => (
                <span key={slot} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-200">
                  {slot}
                </span>
              ))}
            </div>
          </div>
        </ProfileVisualFrame>
      );
    case "gallery":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="grid grid-cols-2 gap-2">
            {slots.map((slot, index) => (
              <div
                key={slot}
                className={`min-h-24 rounded-lg border border-gray-200 p-3 ${index % 2 === 0 ? "bg-violet-50" : "bg-emerald-50"}`}
              >
                <ImageIcon className="mb-3 h-5 w-5 text-gray-500" />
                <p className="m-0 text-sm font-black text-gray-950">{slot}</p>
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "timeline":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="space-y-3">
            {slots.map((slot, index) => (
              <div key={slot} className="flex items-center gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="m-0 truncate text-sm font-black text-gray-950">{slot}</p>
                </div>
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "converter":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="grid gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="m-0 text-[10px] font-bold uppercase text-gray-400">{slots[0]}</p>
              <p className="m-0 mt-1 truncate font-mono text-sm font-black text-gray-950">{primaryInput}</p>
            </div>
            <ArrowRightLeft className="mx-auto h-5 w-5 text-emerald-600" />
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="m-0 text-[10px] font-bold uppercase text-emerald-600">{slots[1] || "Output"}</p>
	              <p className="m-0 mt-1 truncate font-mono text-sm font-black text-gray-950">derived after validation</p>
            </div>
          </div>
        </ProfileVisualFrame>
      );
    case "qr":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="grid place-items-center">
            <div className="grid h-36 w-36 grid-cols-6 gap-1 rounded-lg border border-gray-200 bg-white p-3">
              {Array.from({ length: 36 }, (_, index) => (
                <span
                  key={index}
                  className={`rounded-sm ${index % 3 === 0 || index % 7 === 0 ? "bg-gray-950" : "bg-gray-100"}`}
                />
              ))}
            </div>
            <p className="m-0 mt-3 text-center text-sm font-black text-gray-950">{primaryInput}</p>
          </div>
        </ProfileVisualFrame>
      );
    case "checklist":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="space-y-2">
            {slots.map((slot, index) => (
              <div key={slot} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <CheckCircle2 className={`h-4 w-4 ${index < 2 ? "text-emerald-600" : "text-gray-300"}`} />
                <span className="text-sm font-black text-gray-950">{slot}</span>
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "ledger":
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="space-y-2">
            {slots.map((slot, index) => (
              <div key={slot} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <span className="text-sm font-black text-gray-950">{slot}</span>
                <span className="font-mono text-xs font-bold text-gray-500">
	                  {index === 0 ? primaryInput : "live value required"}
                </span>
              </div>
            ))}
          </div>
        </ProfileVisualFrame>
      );
    case "stream":
    default:
      return (
        <ProfileVisualFrame profile={profile}>
          <div className="space-y-4">
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-400 to-sky-500" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {slots.map((slot) => (
                <div key={slot} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <p className="m-0 text-sm font-black text-gray-950">{slot}</p>
                </div>
              ))}
            </div>
          </div>
        </ProfileVisualFrame>
      );
  }
}

function ProfileVisualFrame({
  profile,
  children,
}: {
  profile: PlayAreaProfile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white/85 p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-950 text-white">
          {profile.icon}
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-black text-gray-950">
            {profile.visual.headline}
          </h3>
          {profile.visual.footnote && (
            <p className="m-0 mt-1 text-xs leading-5 text-gray-500">
              {profile.visual.footnote}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function GenericPlayArea(props: PlayAreaRegistryProps) {
  const { app, stats, activity, loading, error, contractHash, network, onRefresh } = props;

  return (
    <PlayShell
      app={app}
      title="Native operation workspace"
      subtitle="This MiniApp is rendered inside the host shell with a purpose-built control area and shared platform actions."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
      footer={<ChainStateStrip loading={loading} error={error} contractHash={contractHash} network={network} onRefresh={onRefresh} />}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
          <h3 className="m-0 text-lg font-black text-gray-950">{app.name}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">{app.description}</p>
          <div className="mt-4">
            <PrimaryAction>
              Open operation flow <Link2 className="h-4 w-4" />
            </PrimaryAction>
          </div>
        </div>
        <MetricGrid stats={stats} />
      </div>
    </PlayShell>
  );
}

function ToolCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="m-0 mt-1 break-words text-sm font-black text-gray-950">{value}</p>
    </div>
  );
}

function BridgeStatusPanel() {
  const steps = ["Lock", "Relay", "Prove", "Release"];
  return (
    <div className="rounded-lg border border-sky-100 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-black text-gray-950">Operation status</h3>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-500"}`}>
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-gray-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OracleStatusPanel({ mode, result }: { mode: string; result: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-950 p-4 text-white">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black">
        <ShieldCheck className="h-4 w-4 text-neo" />
        Result verifier
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        Mode: <span className="font-bold text-white">{mode}</span>
      </p>
      <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-5 text-emerald-200">
        {result}
      </pre>
    </div>
  );
}

const FALLBACK_TAROT: TarotCard[] = [
  { id: 0, name: "The Fool", keyword: "Spark", meaning: "Leap", image: "/miniapps/on-chain-tarot/cards/00-the-fool.svg" },
  { id: 1, name: "The Magician", keyword: "Protocol", meaning: "Intent", image: "/miniapps/on-chain-tarot/cards/01-the-magician.svg" },
  { id: 2, name: "The High Priestess", keyword: "Oracle", meaning: "Signal", image: "/miniapps/on-chain-tarot/cards/02-the-high-priestess.svg" },
];
