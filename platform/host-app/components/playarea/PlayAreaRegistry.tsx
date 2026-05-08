import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
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
  Ticket,
  Timer,
  UserCheck,
  Users,
  Vault,
  Vote,
  WalletCards,
  WandSparkles,
  Workflow,
} from "lucide-react";

import type {
  MiniAppInfo,
  MiniAppLaunchContext,
  OperationEntry,
  OperationParam,
} from "@/components/types";
import { getLaunchParam } from "@/lib/miniapp-launch-params";
import { buildOneGateDirectMiniAppUrl } from "../../../../apps/shared/utils/onegate-launch";
import {
  getExternalIntegrationConfig,
  resolveNeoNetwork,
} from "../../../../apps/shared/constants/rpc";
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
  "miniapp-gas-lucky-pool": GasLuckyPoolPlayArea,
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
  {
    title: string;
    mode: "http" | "vrf" | "compute" | "seal" | "neodid" | "price";
  }
> = {
  "miniapp-oracle-http-console": { title: "HTTP Oracle Console", mode: "http" },
  "miniapp-oracle-vrf-console": { title: "VRF Request Console", mode: "vrf" },
  "miniapp-oracle-compute-lab": {
    title: "Private Compute Lab",
    mode: "compute",
  },
  "miniapp-oracle-seal-console": { title: "Seal Console", mode: "seal" },
  "miniapp-oracle-neodid-console": {
    title: "NeoDID Oracle Console",
    mode: "neodid",
  },
  "miniapp-oracle-price-console": {
    title: "Price Oracle Console",
    mode: "price",
  },
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

type ProfileVisual = {
  headline: string;
  slots: string[];
  footnote?: string;
};

type PlayTone = "emerald" | "violet" | "amber" | "rose" | "sky" | "slate";

type PlayAreaProfile = {
  title: string;
  subtitle: string;
  tone: PlayTone;
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
    subtitle:
      "Preview registration intent, predicted account id, and owner binding before submitting through the action console.",
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
    steps: [
      "Resolve AA core",
      "Derive account id",
      "Bind owner witness",
      "Submit register",
    ],
    primaryAction: "Stage account registration",
    visual: {
      headline: "Registration flow",
      slots: ["Owner", "Salt", "Account ID", "AA Core"],
      footnote: "The preview mirrors the shared AA registration path.",
    },
  },
  "miniapp-aa-market-hub": {
    title: "AA escrow market desk",
    subtitle:
      "Create a listing, lock settlement terms, and track counterparty approval for AA-powered marketplace deals.",
    tone: "emerald",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    fields: [
      {
        key: "price",
        label: "Listing price",
        defaultValue: "18",
        suffix: "GAS",
        type: "number",
      },
      {
        key: "item",
        label: "Listing title",
        defaultValue: "AA service package",
      },
    ],
    cards: [
      { label: "Escrow", value: "funded on accept" },
      { label: "Settlement", value: "dual approval" },
      { label: "Disputes", value: "timelock" },
    ],
    steps: [
      "Draft listing",
      "Lock funds",
      "Accept counterparty",
      "Settle or dispute",
    ],
    primaryAction: "Stage listing",
    visual: {
      headline: "Trustless listing board",
      slots: ["Draft", "Funded", "Accepted", "Settled"],
    },
  },
  "miniapp-aa-permissions-lab": {
    title: "AA permission binding console",
    subtitle:
      "Inspect verifier and hook bindings, then stage permission updates with clear before and after state.",
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
    steps: [
      "Read bindings",
      "Compare desired policy",
      "Stage update",
      "Verify event",
    ],
    primaryAction: "Stage permission update",
    visual: {
      headline: "Binding matrix",
      slots: [
        "Verifier active",
        "Hook enabled",
        "Witness required",
        "Event audit",
      ],
    },
  },
  "miniapp-aa-relay-console": {
    title: "Relay payload console",
    subtitle:
      "Build relay-ready calldata, inspect sponsor metadata, and verify the envelope before relay submission.",
    tone: "sky",
    icon: <Send className="h-5 w-5" />,
    fields: [
      { key: "target", label: "Target method", defaultValue: "transfer" },
      {
        key: "gas",
        label: "Sponsor budget",
        defaultValue: "0.08",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Sponsor", value: "policy match" },
      { label: "Nonce", value: "fresh" },
      { label: "Relay", value: "ready" },
    ],
    steps: [
      "Encode payload",
      "Attach sponsor",
      "Check nonce",
      "Relay atomically",
    ],
    primaryAction: "Build relay package",
    visual: {
      headline: "Relay envelope",
      slots: ["method", "nonce", "sponsor", "signature"],
      footnote:
        "A relay package must be complete before it leaves the console.",
    },
  },
  "miniapp-aa-session-key-lab": {
    title: "Session key policy lab",
    subtitle:
      "Configure a scoped session key with limits, expiry, and sponsor readiness for AA flows.",
    tone: "violet",
    icon: <KeyRound className="h-5 w-5" />,
    fields: [
      { key: "scope", label: "Allowed method", defaultValue: "claimReward" },
      {
        key: "limit",
        label: "Spend limit",
        defaultValue: "2",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Expiry", value: "24h" },
      { label: "Sponsor", value: "enabled" },
      { label: "Verifier", value: "session key" },
    ],
    steps: ["Define scope", "Set limit", "Bind verifier", "Activate key"],
    primaryAction: "Stage session key",
    visual: {
      headline: "Scoped key lifecycle",
      slots: ["Issue", "Use", "Throttle", "Expire"],
    },
  },
  "miniapp-automation-copilot": {
    title: "Automation runbook cockpit",
    subtitle:
      "Compose price alerts, AA recipes, private oracle jobs, and datafeed runbooks from one operator surface.",
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
    steps: [
      "Select trigger",
      "Attach oracle",
      "Review action",
      "Enable monitor",
    ],
    primaryAction: "Stage automation",
    visual: {
      headline: "Runbook chain",
      slots: ["Trigger", "Oracle", "Policy", "Action"],
    },
  },
  "miniapp-breakupcontract": {
    title: "Agreement split workspace",
    subtitle:
      "Draft a breakup agreement, split shared assets fairly, and keep the settlement path legible.",
    tone: "rose",
    icon: <Scale className="h-5 w-5" />,
    fields: [
      {
        key: "partyA",
        label: "Party A share",
        defaultValue: "50",
        suffix: "%",
        type: "number",
      },
      { key: "asset", label: "Shared asset", defaultValue: "GAS balance" },
    ],
    cards: [
      { label: "Agreement", value: "draft" },
      { label: "Counterparty", value: "pending" },
      { label: "Settlement", value: "fair split" },
    ],
    steps: [
      "Draft terms",
      "Invite counterparty",
      "Lock assets",
      "Release split",
    ],
    primaryAction: "Stage agreement",
    visual: {
      headline: "Split ledger",
      slots: ["Party A", "Party B", "Shared pool", "Release"],
    },
  },
  "miniapp-burn-league": {
    title: "Burn league arena",
    subtitle:
      "Enter a burn challenge, preview leaderboard impact, and stage the burn transaction intentionally.",
    tone: "amber",
    icon: <Flame className="h-5 w-5" />,
    fields: [
      {
        key: "amount",
        label: "Burn amount",
        defaultValue: "10",
        suffix: "points",
        type: "number",
      },
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
      headline: "Leaderboard impact",
      slots: ["You", "Top 10", "Weekly", "Final"],
    },
  },
  "miniapp-council-governance": {
    title: "Council voting chamber",
    subtitle:
      "Review proposals, stage a council vote, and verify voting power before signing.",
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
      headline: "Council ballot",
      slots: ["Approve", "Reject", "Abstain", "Needs quorum"],
    },
  },
  "miniapp-dev-tipping": {
    title: "Developer tip jar",
    subtitle:
      "Send an appreciation tip with a message and clear wallet preview before payment.",
    tone: "rose",
    icon: <HeartHandshake className="h-5 w-5" />,
    fields: [
      { key: "recipient", label: "Developer", defaultValue: "" },
      {
        key: "amount",
        label: "Tip amount",
        defaultValue: "1",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Message", value: "public thanks" },
      { label: "Asset", value: "GAS" },
      { label: "Receipt", value: "on-chain" },
    ],
    steps: ["Pick developer", "Write note", "Preview tip", "Send receipt"],
    primaryAction: "Stage tip",
    visual: {
      headline: "Tip flow",
      slots: ["Sender", "Message", "Developer", "Receipt"],
    },
  },
  "miniapp-event-ticket-pass": {
    title: "Ticket issuer and check-in",
    subtitle:
      "Issue NEP-11 event passes, preview QR check-in, and track used versus active tickets.",
    tone: "sky",
    icon: <Ticket className="h-5 w-5" />,
    fields: [
      { key: "event", label: "Event", defaultValue: "Neo meetup" },
      {
        key: "supply",
        label: "Ticket supply",
        defaultValue: "120",
        type: "number",
      },
    ],
    cards: [
      { label: "Token", value: "NEP-11" },
      { label: "Check-in", value: "QR" },
      { label: "Status", value: "draft" },
    ],
    steps: ["Create event", "Mint passes", "Scan QR", "Mark used"],
    primaryAction: "Stage ticket batch",
    visual: {
      headline: "Event pass preview",
      slots: ["NEP-11", "QR", "Gate", "Used"],
    },
  },
  "miniapp-asset-factory": {
    title: "NEP-17 asset factory",
    subtitle:
      "Prepare a token launch from audited on-chain templates; only safe template parameters are customized at publish time.",
    tone: "emerald",
    icon: <Boxes className="h-5 w-5" />,
    fields: [
      { key: "symbol", label: "Symbol", defaultValue: "YIWU" },
      { key: "name", label: "Asset name", defaultValue: "Yiwu Credits" },
      {
        key: "supply",
        label: "Initial supply",
        defaultValue: "1000000",
        type: "number",
      },
    ],
    cards: [
      { label: "Symbol", value: "YIWU" },
      { label: "Asset name", value: "Yiwu Credits" },
      { label: "Supply", value: "1000000" },
    ],
    steps: [
      "Choose audited template",
      "Set token parameters",
      "Review owner controls",
      "Stage deployment",
    ],
    primaryAction: "Stage NEP-17 launch",
    visual: {
      headline: "Token launch checklist",
      slots: ["Template", "Symbol", "Supply", "Owner"],
      footnote:
        "The factory flow references pre-published templates instead of uploading arbitrary NEF/manifest files.",
    },
  },
  "miniapp-nft-factory": {
    title: "NEP-11 collection factory",
    subtitle:
      "Configure collection metadata, mint rules, and royalty policy while keeping the audited template fixed.",
    tone: "violet",
    icon: <ImageIcon className="h-5 w-5" />,
    fields: [
      { key: "symbol", label: "Collection symbol", defaultValue: "ART" },
      { key: "name", label: "Collection name", defaultValue: "Neo Editions" },
      {
        key: "royalty",
        label: "Royalty",
        defaultValue: "5",
        suffix: "%",
        type: "number",
      },
    ],
    cards: [
      { label: "Symbol", value: "ART" },
      { label: "Collection", value: "Neo Editions" },
      { label: "Royalty", value: "5%" },
    ],
    steps: [
      "Select collection template",
      "Attach metadata policy",
      "Review mint controls",
      "Stage collection",
    ],
    primaryAction: "Stage NEP-11 collection",
    visual: {
      headline: "Collection launch board",
      slots: ["Template", "Metadata", "Mint policy", "Royalty"],
    },
  },
  "miniapp-miniapp-factory": {
    title: "MiniApp factory",
    subtitle:
      "Assemble a platform MiniApp from approved modules, launch metadata, OneGate parameters, and template-bound contracts.",
    tone: "sky",
    icon: <WandSparkles className="h-5 w-5" />,
    fields: [
      { key: "appName", label: "MiniApp name", defaultValue: "Focused Asset" },
      { key: "template", label: "Template", defaultValue: "utility" },
      { key: "owner", label: "Owner address", defaultValue: "" },
    ],
    cards: [
      { label: "Modules", value: "approved" },
      { label: "OneGate", value: "URL params" },
      { label: "Catalog", value: "ready" },
    ],
    steps: [
      "Pick app template",
      "Bind owner and modules",
      "Review OneGate launch URL",
      "Stage catalog entry",
    ],
    primaryAction: "Stage MiniApp launch",
    visual: {
      headline: "MiniApp publish path",
      slots: ["Template", "Owner", "Launch URL", "Catalog"],
      footnote:
        "The factory keeps the generated app focused and avoids custom contract uploads in the user flow.",
    },
  },
  "miniapp-flashloan": {
    title: "Flash loan route builder",
    subtitle:
      "Build a single-transaction loan route with borrow, execute, repay, and profit checks visible.",
    tone: "emerald",
    icon: <CircleDollarSign className="h-5 w-5" />,
    fields: [
      {
        key: "borrow",
        label: "Borrow amount",
        defaultValue: "100",
        suffix: "GAS",
        type: "number",
      },
      {
        key: "route",
        label: "Execution route",
        defaultValue: "borrow -> swap -> repay",
      },
    ],
    cards: [
      { label: "Atomicity", value: "required" },
      { label: "Repay", value: "same tx" },
      { label: "Profit", value: "preview" },
    ],
    steps: ["Borrow", "Execute route", "Repay", "Keep surplus"],
    primaryAction: "Stage flash route",
    visual: {
      headline: "Atomic loan path",
      slots: ["Borrow", "Trade", "Repay", "Profit"],
    },
  },
  "miniapp-forever-album": {
    title: "Encrypted album desk",
    subtitle:
      "Prepare photo metadata, choose encryption mode, and preview the per-wallet album surface.",
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
      headline: "Wallet album preview",
      slots: ["Photo", "Hash", "Owner", "Album"],
    },
  },
  "miniapp-gas-sponsor": {
    title: "Gas sponsor policy desk",
    subtitle:
      "Define who receives sponsored GAS, cap the budget, and make onboarding rules transparent.",
    tone: "emerald",
    icon: <Coins className="h-5 w-5" />,
    fields: [
      { key: "contract", label: "Allowed contract", defaultValue: "" },
      {
        key: "budget",
        label: "Daily budget",
        defaultValue: "5",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Recipients", value: "low balance" },
      { label: "Cap", value: "daily" },
      { label: "Mode", value: "gasless" },
    ],
    steps: ["Choose contract", "Set cap", "Enable sponsor", "Audit usage"],
    primaryAction: "Stage sponsor policy",
    visual: {
      headline: "Sponsorship rules",
      slots: ["Low balance", "Contract allowlist", "Daily cap", "Usage log"],
    },
  },
  "miniapp-gov-merc": {
    title: "Governance delegation market",
    subtitle:
      "List, compare, and delegate voting power through transparent governance offers.",
    tone: "sky",
    icon: <Users className="h-5 w-5" />,
    fields: [
      { key: "delegate", label: "Delegate", defaultValue: "Council desk" },
      {
        key: "power",
        label: "Voting power",
        defaultValue: "40",
        suffix: "NEO",
        type: "number",
      },
    ],
    cards: [
      { label: "Offers", value: "market" },
      { label: "Duration", value: "epoch" },
      { label: "Reward", value: "negotiated" },
    ],
    steps: [
      "Compare delegates",
      "Set duration",
      "Delegate power",
      "Track result",
    ],
    primaryAction: "Stage delegation",
    visual: {
      headline: "Voting power offers",
      slots: ["Delegate", "Rate", "Epoch", "Reward"],
    },
  },
  "miniapp-graveyard": {
    title: "Encrypted memory burial",
    subtitle:
      "Seal a memory, set a forgetting price, and keep the privacy envelope explicit.",
    tone: "slate",
    icon: <History className="h-5 w-5" />,
    fields: [
      { key: "memory", label: "Memory label", defaultValue: "private note" },
      {
        key: "price",
        label: "Forgetting price",
        defaultValue: "3",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Encryption", value: "sealed" },
      { label: "Reveal", value: "never by default" },
      { label: "Payment", value: "forgetting" },
    ],
    steps: ["Encrypt memory", "Commit hash", "Set price", "Bury record"],
    primaryAction: "Stage burial",
    visual: {
      headline: "Sealed memory",
      slots: ["Ciphertext", "Hash", "Price", "Buried"],
    },
  },
  "miniapp-memorial-shrine": {
    title: "Memorial tribute wall",
    subtitle:
      "Compose a permanent tribute with message, donation state, and on-chain memorial proof.",
    tone: "rose",
    icon: <BookOpenCheck className="h-5 w-5" />,
    fields: [
      { key: "name", label: "Memorial name", defaultValue: "Loved one" },
      {
        key: "message",
        label: "Tribute line",
        defaultValue: "Always remembered",
      },
    ],
    cards: [
      { label: "Tribute", value: "draft" },
      { label: "Proof", value: "on-chain" },
      { label: "Visitors", value: "open" },
    ],
    steps: ["Write tribute", "Preview wall", "Anchor proof", "Share memorial"],
    primaryAction: "Stage tribute",
    visual: {
      headline: "Shrine wall",
      slots: ["Portrait", "Message", "Proof", "Visitors"],
    },
  },
  "miniapp-milestone-escrow": {
    title: "Milestone escrow board",
    subtitle:
      "Lock project funds, approve completed milestones, and release payments step by step.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    fields: [
      {
        key: "total",
        label: "Escrow total",
        defaultValue: "50",
        suffix: "GAS",
        type: "number",
      },
      {
        key: "milestone",
        label: "Next milestone",
        defaultValue: "M2 delivery",
      },
    ],
    cards: [
      { label: "Locked", value: "escrow" },
      { label: "Approval", value: "buyer" },
      { label: "Release", value: "milestone" },
    ],
    steps: ["Fund escrow", "Submit milestone", "Approve work", "Release funds"],
    primaryAction: "Stage escrow",
    visual: {
      headline: "Milestone release plan",
      slots: ["Fund", "M1", "M2", "Release"],
    },
  },
  "miniapp-neo-convert": {
    title: "Neo conversion workbench",
    subtitle:
      "Convert addresses, script hashes, and key formats locally before using them in a wallet operation.",
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
      headline: "Address converter",
      slots: ["Address", "Script hash", "Endian", "Copy"],
    },
  },
  "miniapp-neo-swap": {
    title: "Neo swap quote desk",
    subtitle:
      "Build a token swap preview with route, slippage, and settlement state before submitting through the shared action console.",
    tone: "emerald",
    icon: <ArrowRightLeft className="h-5 w-5" />,
    fields: [
      { key: "from", label: "From asset", defaultValue: "NEO" },
      {
        key: "amount",
        label: "Amount",
        defaultValue: "10",
        suffix: "NEO",
        type: "number",
      },
    ],
    cards: [
      { label: "Route", value: "best path" },
      { label: "Slippage", value: "0.5%" },
      { label: "Settlement", value: "wallet" },
    ],
    steps: ["Select assets", "Preview quote", "Check slippage", "Stage swap"],
    primaryAction: "Preview swap route",
    visual: {
      headline: "Swap quote route",
      slots: ["NEO", "Route", "GAS", "Confirm"],
      footnote:
        "The shared operation panel handles wallet submission after the quote is reviewed.",
    },
  },
  "miniapp-neo-multisig": {
    title: "Multisig signing room",
    subtitle:
      "Create a multisig request, collect signatures, and keep threshold progress visible.",
    tone: "slate",
    icon: <Users className="h-5 w-5" />,
    fields: [
      { key: "threshold", label: "Threshold", defaultValue: "2 of 3" },
      {
        key: "amount",
        label: "Transfer amount",
        defaultValue: "8",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Signers", value: "3" },
      { label: "Threshold", value: "2" },
      { label: "State", value: "collecting" },
    ],
    steps: [
      "Draft transfer",
      "Invite signers",
      "Collect threshold",
      "Broadcast",
    ],
    primaryAction: "Stage multisig request",
    visual: {
      headline: "Signature progress",
      slots: ["Signer 1", "Signer 2", "Signer 3", "Threshold"],
    },
  },
  "miniapp-neo-ns": {
    title: ".neo domain desk",
    subtitle:
      "Search, register, and manage human-readable Neo names from a focused registration surface.",
    tone: "emerald",
    icon: <FileKey className="h-5 w-5" />,
    fields: [
      { key: "name", label: "Domain", defaultValue: "" },
      {
        key: "years",
        label: "Registration",
        defaultValue: "1",
        suffix: "year",
        type: "number",
      },
    ],
    cards: [
      { label: "Availability", value: "checking" },
      { label: "Resolver", value: "wallet" },
      { label: "Renewal", value: "enabled" },
    ],
    steps: ["Search name", "Resolve price", "Register", "Set resolver"],
    primaryAction: "Stage domain registration",
    visual: {
      headline: "Name resolution",
      slots: ["name", "owner", "resolver", "expiry"],
    },
  },
  "miniapp-neo-pay-shared-example": {
    title: "Shared payment stream builder",
    subtitle:
      "Demonstrate the shared-mode NeoPay recipe with funding vault and stream vesting modules.",
    tone: "emerald",
    icon: <CreditCard className="h-5 w-5" />,
    fields: [
      { key: "beneficiary", label: "Beneficiary", defaultValue: "" },
      {
        key: "amount",
        label: "Total amount",
        defaultValue: "20",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Recipe", value: "shared mode" },
      { label: "Vault", value: "funding" },
      { label: "Vesting", value: "stream" },
    ],
    steps: ["Fund vault", "Create stream", "Claim vested", "Cancel if needed"],
    primaryAction: "Stage shared stream",
    visual: {
      headline: "Shared runtime stream",
      slots: ["Vault", "Stream", "Claim", "Cancel"],
    },
  },
  "miniapp-neo-sign-anything": {
    title: "Message signing desk",
    subtitle:
      "Prepare a message, preview the digest, and request a wallet signature with clear verification output.",
    tone: "violet",
    icon: <FileSignature className="h-5 w-5" />,
    fields: [
      {
        key: "message",
        label: "Message",
        defaultValue: "I control this Neo address",
      },
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
      headline: "Signature envelope",
      slots: ["Message", "Digest", "Signature", "Verifier"],
    },
  },
  "miniapp-neo-treasury": {
    title: "Treasury balance monitor",
    subtitle:
      "Track foundation and ecosystem fund balances with asset rows and balance change context.",
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
      headline: "Treasury ledger",
      slots: ["NEO", "GAS", "NEP-17", "History"],
    },
  },
  "miniapp-neodid-passport": {
    title: "NeoDID passport composer",
    subtitle:
      "Compose portable credential previews and prepare verification payloads for identity flows.",
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
      headline: "Passport card",
      slots: ["DID", "Claim", "Issuer", "Proof"],
    },
  },
  "miniapp-quadratic-funding": {
    title: "Quadratic funding round",
    subtitle:
      "Create grant allocations, preview matching pool impact, and keep donor count visible.",
    tone: "emerald",
    icon: <Medal className="h-5 w-5" />,
    fields: [
      { key: "grant", label: "Grant", defaultValue: "Open-source SDK" },
      {
        key: "amount",
        label: "Contribution",
        defaultValue: "5",
        suffix: "GAS",
        type: "number",
      },
    ],
    cards: [
      { label: "Matching", value: "quadratic" },
      { label: "Donors", value: "weighted" },
      { label: "Round", value: "open" },
    ],
    steps: [
      "Choose grant",
      "Add contribution",
      "Preview match",
      "Submit donation",
    ],
    primaryAction: "Stage contribution",
    visual: {
      headline: "Matching pool impact",
      slots: ["Grant A", "Grant B", "Your match", "Pool"],
    },
  },
  "miniapp-recovery-guardian": {
    title: "Recovery guardian console",
    subtitle:
      "Review AA guardian policy, recovery ticket state, timelock, and final execution readiness.",
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
    steps: [
      "Open ticket",
      "Notify guardians",
      "Wait timelock",
      "Execute recovery",
    ],
    primaryAction: "Stage recovery ticket",
    visual: {
      headline: "Recovery path",
      slots: ["Ticket", "Guardian", "Timelock", "Recover"],
    },
  },
  "miniapp-soulbound-certificate": {
    title: "Certificate issuer",
    subtitle:
      "Issue non-transferable NEP-11 certificates with recipient, claim, and metadata preview.",
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
    steps: [
      "Enter recipient",
      "Attach claim",
      "Mint certificate",
      "Share proof",
    ],
    primaryAction: "Stage certificate",
    visual: {
      headline: "Soulbound credential",
      slots: ["Recipient", "Claim", "Issuer", "Token ID"],
    },
  },
  "miniapp-time-capsule": {
    title: "Time capsule locker",
    subtitle:
      "Seal a message hash until a future unlock date with clear public proof and retrieval state.",
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
      headline: "Capsule schedule",
      slots: ["Seal", "Wait", "Unlock", "Reveal"],
    },
  },
  "miniapp-timestamp-proof": {
    title: "Timestamp proof journal",
    subtitle:
      "Hash local content, anchor the digest, and keep proof lookup straightforward.",
    tone: "slate",
    icon: <Hash className="h-5 w-5" />,
    fields: [
      {
        key: "content",
        label: "Content label",
        defaultValue: "release-notes.pdf",
      },
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
      headline: "Proof journal",
      slots: ["File", "SHA-256", "Block", "Verify"],
    },
  },
  "miniapp-unbreakablevault": {
    title: "Hash bounty vault",
    subtitle:
      "Create a bounty vault, lock secret hash conditions, and expose the claim path clearly.",
    tone: "rose",
    icon: <Vault className="h-5 w-5" />,
    fields: [
      {
        key: "bounty",
        label: "Bounty",
        defaultValue: "100",
        suffix: "GAS",
        type: "number",
      },
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
      headline: "Bounty vault",
      slots: ["Hash", "Bounty", "Preimage", "Release"],
    },
  },
  "miniapp-wallet-health": {
    title: "Wallet safety checkup",
    subtitle:
      "Run a wallet readiness checklist covering balance, permissions, suspicious approvals, and backup posture.",
    tone: "emerald",
    icon: <WalletCards className="h-5 w-5" />,
    fields: [
      { key: "wallet", label: "Wallet", defaultValue: "connected wallet" },
      {
        key: "scope",
        label: "Audit scope",
        defaultValue: "balances + approvals",
      },
    ],
    cards: [
      { label: "Risk", value: "medium" },
      { label: "Approvals", value: "review" },
      { label: "Backup", value: "check" },
    ],
    steps: [
      "Read balances",
      "Check approvals",
      "Review activity",
      "Export checklist",
    ],
    primaryAction: "Run health check",
    visual: {
      headline: "Safety checklist",
      slots: [
        "Balance ok",
        "No risky approvals",
        "Backup checked",
        "Recent tx clean",
      ],
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

export function getNativePlayAreaOperationFallback(
  appId: string,
): OperationEntry[] {
  if (appId === "miniapp-gasbox") {
    return [
      {
        name: "Draw Capsule",
        method: "prepareMiniAppOperation",
        description:
          "Choose the machine and draw count in the action console, then use the prepared values for the wallet action.",
        button_style: "success",
        params: [
          {
            name: "machine",
            type: "integer",
            label: "Machine",
            default_value: "1",
            required: true,
          },
          {
            name: "draws",
            type: "integer",
            label: "Draw count",
            default_value: "1",
            required: true,
          },
        ],
      },
    ];
  }

  const profile = PROFILED_PLAYAREAS[appId];
  if (!profile) return [];
  return [
    {
      name: profile.primaryAction,
      method: "prepareMiniAppOperation",
      description:
        "Prepare app-specific parameters in the shared action console. The center playarea stays focused on state, preview, and workflow.",
      button_style: "primary",
      params: profile.fields.map(profileFieldToOperationParam),
    },
  ];
}

function profileFieldToOperationParam(field: ProfileField): OperationParam {
  const defaultValue = profileDefaultValue(field);
  const label = field.label || field.key;
  const lower = `${field.key} ${label}`.toLowerCase();
  const type: OperationParam["type"] =
    field.type === "number"
      ? field.suffix?.toUpperCase().includes("GAS") ||
        field.suffix?.toUpperCase().includes("NEO")
        ? "amount"
        : "integer"
      : lower.includes("address") ||
          lower.includes("recipient") ||
          lower.includes("owner")
        ? "address"
        : lower.includes("hash")
          ? "hash256"
          : "string";

  return {
    name: field.key,
    type,
    label,
    default_value: defaultValue || undefined,
    placeholder: defaultValue ? undefined : field.defaultValue || undefined,
  };
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
      className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-sm shadow-gray-950/5 sm:rounded-[26px]"
      data-testid={`native-playarea-${props.app.app_id}`}
    >
      <Component {...props} />
    </div>
  );
}

function getMetric(
  stats: Record<string, string>,
  label: string,
  fallback = "0",
) {
  return stats[label] || fallback;
}

function statsMapFromStats(stats: PlayMetric[]): Record<string, string> {
  return Object.fromEntries(stats.map((item) => [item.label, item.value]));
}

function parseGas(value: string): number {
  const match = String(value || "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function parseNumericMetric(value: string): number {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  if (field.type === "number" || field.suffix) return value;
  if (
    [
      "action",
      "asset",
      "format",
      "mode",
      "route",
      "scope",
      "threshold",
      "trigger",
      "vote",
    ].includes(field.key)
  ) {
    return value;
  }
  if (
    /^(approve|transfer|script hash|connected wallet|balances \+ approvals)$/i.test(
      value,
    )
  )
    return value;
  return "";
}

function shortHash(value?: string | null) {
  if (!value) return "shared runtime";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

const TONE_STYLES: Record<
  PlayTone,
  {
    accent: string;
    soft: string;
    active: string;
    text: string;
    ring: string;
  }
> = {
  emerald: {
    accent: "bg-emerald-500",
    soft: "bg-emerald-50",
    active: "border-emerald-500 bg-emerald-50 text-emerald-950",
    text: "text-emerald-700",
    ring: "focus-visible:ring-emerald-400/40",
  },
  violet: {
    accent: "bg-violet-500",
    soft: "bg-violet-50",
    active: "border-violet-500 bg-violet-50 text-violet-950",
    text: "text-violet-700",
    ring: "focus-visible:ring-violet-400/40",
  },
  amber: {
    accent: "bg-amber-500",
    soft: "bg-amber-50",
    active: "border-amber-500 bg-amber-50 text-amber-950",
    text: "text-amber-700",
    ring: "focus-visible:ring-amber-400/40",
  },
  rose: {
    accent: "bg-rose-500",
    soft: "bg-rose-50",
    active: "border-rose-500 bg-rose-50 text-rose-950",
    text: "text-rose-700",
    ring: "focus-visible:ring-rose-400/40",
  },
  sky: {
    accent: "bg-sky-500",
    soft: "bg-sky-50",
    active: "border-sky-500 bg-sky-50 text-sky-950",
    text: "text-sky-700",
    ring: "focus-visible:ring-sky-400/40",
  },
  slate: {
    accent: "bg-slate-800",
    soft: "bg-slate-50",
    active: "border-slate-700 bg-slate-50 text-slate-950",
    text: "text-slate-700",
    ring: "focus-visible:ring-slate-400/40",
  },
};

function toneStyle(tone: PlayTone = "emerald") {
  return TONE_STYLES[tone];
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
  tone?: PlayTone;
  children: React.ReactNode;
  side?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const styles = toneStyle(tone);

  return (
    <div className="bg-white">
      <div className="hidden border-b border-gray-100 bg-white px-4 py-3 sm:block sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
              <span className="truncate text-xs font-black uppercase tracking-wide text-gray-500">
                {app.name}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">
                Native dApp
              </span>
            </div>
            <h2 className="m-0 text-base font-black tracking-tight text-gray-950 sm:text-lg">
              {title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-600">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="min-w-0 space-y-3">{children}</div>
        {side && (
          <div className="mt-3">
            <SecondaryInfo
              title="Activity and details"
              description="Recent events, raw readings, and diagnostic context are available when needed."
            >
              <div className="min-w-0 space-y-3">{side}</div>
            </SecondaryInfo>
          </div>
        )}
      </div>
      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-2.5 sm:px-5">
          {footer}
        </div>
      )}
    </div>
  );
}

function SecondaryInfo({
  title,
  description,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-[18px] border border-gray-200 bg-gray-50/70 shadow-sm shadow-gray-950/5"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30">
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-gray-900">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs leading-5 text-gray-500">
              {description}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {meta && (
            <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">
              {meta}
            </span>
          )}
          <ChevronDown
            className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="border-t border-gray-200 px-3.5 py-3">{children}</div>
    </details>
  );
}

function ChainStateStrip({
  loading,
  error,
  contractHash,
  network,
  onRefresh,
}: Pick<
  PlayAreaRegistryProps,
  "loading" | "error" | "contractHash" | "network" | "onRefresh"
>) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            {loading ? "Syncing" : error ? "Local preview" : "Live state"}
          </span>
          <span className="font-semibold uppercase text-gray-400">
            {network}
          </span>
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
      <details
        className="group rounded-xl border border-gray-200 bg-white/70"
        data-testid="chain-technical-details"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 marker:content-none">
          Technical chain details
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-gray-200 px-2.5 py-2">
          <span className="block truncate font-mono text-gray-600">
            Contract: {shortHash(contractHash)}
          </span>
          {error && (
            <span className="mt-1 block text-[11px] font-semibold text-amber-700">
              {error}
            </span>
          )}
        </div>
      </details>
    </div>
  );
}

function MetricGrid({ stats }: { stats: PlayMetric[] }) {
  if (!stats.length) return null;
  return (
    <SecondaryInfo
      title="Additional metrics"
      description="Raw app counters and diagnostic readings."
      meta={`${stats.length} items`}
    >
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
        {stats.slice(0, 8).map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm shadow-gray-950/5"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {item.label}
            </p>
            <p
              className={`m-0 mt-1 truncate text-sm font-black sm:text-base ${item.accent ? "text-emerald-600" : "text-gray-950"}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </SecondaryInfo>
  );
}

function ActivityPanel({ activity }: { activity: PlayActivity | null }) {
  return (
    <div className="rounded-[18px] border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5">
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
            <div
              key={`${row.primary}:${index}`}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold text-gray-900">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="m-0 mt-0.5 truncate text-xs text-gray-500">
                      {row.secondary}
                    </p>
                  )}
                </div>
                {row.amount && (
                  <span className="shrink-0 text-xs font-bold text-emerald-700">
                    {row.amount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm leading-6 text-gray-500">
          {activity?.emptyText ||
            "No live on-chain events are available for this miniapp yet."}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  label,
  detail,
  value,
  valueLabel,
  tone = "emerald",
  active,
  icon,
}: {
  label: string;
  detail?: string;
  value?: string;
  valueLabel?: string;
  tone?: PlayTone;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  const styles = toneStyle(tone);
  const className = `group flex w-full flex-col items-stretch justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl sm:py-3 ${
    active ? styles.active : "border-gray-200 bg-white text-gray-950"
  }`;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${active ? "bg-white/75" : styles.soft} ${styles.text}`}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0">
          <span className="block break-words text-[13px] font-black sm:text-sm">
            {label}
          </span>
          {detail && (
            <span className="mt-0.5 block break-words text-[11px] font-semibold leading-4 text-gray-500 sm:text-xs sm:leading-5">
              {detail}
            </span>
          )}
        </span>
      </div>
      {(value || valueLabel) && (
        <span className="shrink-0 pl-12 text-left sm:pl-0 sm:text-right">
          {value && (
            <span className="block text-[13px] font-black tabular-nums text-gray-950 sm:text-sm">
              {value}
            </span>
          )}
          {valueLabel && (
            <span className="block text-[10px] font-black uppercase tracking-wide text-gray-400">
              {valueLabel}
            </span>
          )}
        </span>
      )}
    </>
  );

  return <div className={className}>{content}</div>;
}

function ActionBoard({
  title,
  subtitle,
  rows,
  tone = "emerald",
}: {
  title: string;
  subtitle?: string;
  rows: Array<{
    label: string;
    detail?: string;
    value?: string;
    valueLabel?: string;
    active?: boolean;
    icon?: React.ReactNode;
  }>;
  tone?: PlayTone;
}) {
  const styles = toneStyle(tone);
  return (
    <section className="rounded-[16px] border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:rounded-[20px] sm:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-black text-gray-950">{title}</h3>
          {subtitle && (
            <p className="m-0 mt-1 text-xs leading-5 text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${styles.accent}`} />
      </div>
      <div className="space-y-2">
        {rows.slice(0, 4).map((row) => (
          <ActionRow
            key={`${row.label}:${row.detail || row.value || ""}`}
            {...row}
            tone={tone}
          />
        ))}
      </div>
    </section>
  );
}

function LastSurvivorPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [keys] = useLaunchParamState(launchContext, ["keys", "keyCount"], "3");
  const keyPrice =
    parseGas(getMetric(statsMap, "Key Price", "0.01 GAS")) || 0.01;
  const projected = Math.max(1, Number(keys) || 1) * keyPrice;
  const status = getMetric(statsMap, "Status", "Ready");
  const countdown = getMetric(statsMap, "Countdown", "--:--:--");
  const needsRollover =
    /rollover|pending|settlement|restart/i.test(status) ||
    /rollover/i.test(countdown);
  const legacyMainnetDeployment =
    app.app_id === "miniapp-last-survivor" && network === "mainnet";

  return (
    <PlayShell
      app={app}
      title="Countdown auction arena"
      subtitle="Buy keys, extend the timer, and become the current leader before the round settles on-chain."
      tone="rose"
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        {needsRollover && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="m-0 text-sm font-bold text-amber-900">
              Next round is ready to start
            </p>
            <p className="m-0 mt-1 text-xs leading-5 text-amber-800">
              {legacyMainnetDeployment
                ? "This legacy mainnet deployment needs a one-time contract update or admin restart. The updated PlatformGame rolls future expirations into the next live countdown automatically."
                : "The lifecycle keeper settles expired rounds automatically. New key purchases also roll the game forward before applying the bid."}
            </p>
          </div>
        )}
        <div className="grid gap-3">
          <ActionBoard
            title="Live round market"
            subtitle="Timer, pool, and key price stay visible so the user understands the round before buying."
            tone="rose"
            rows={[
              {
                label: "Countdown",
                detail: status,
                value: countdown,
                valueLabel: "time left",
                active: true,
                icon: <Timer className="h-4 w-4" />,
              },
              {
                label: "Prize pool",
                detail: "Winner receives the current round pool",
                value: getMetric(statsMap, "Prize Pool", "0 GAS"),
                valueLabel: "pool",
              },
              {
                label: "Key price",
                detail: "Each purchase extends the active timer",
                value: formatGas(keyPrice),
                valueLabel: "per key",
              },
              {
                label: "Staged buy",
                detail: `${keys || "1"} keys from the right action console`,
                value: formatGas(projected),
                valueLabel: "preview",
              },
            ]}
          />
          <PlayAreaConsoleHint label="Buy-key inputs and wallet signing stay in the right action console; the playarea only shows live round state and the current preview." />
        </div>
        <div className="space-y-3">
          <MetricGrid stats={stats} />
        </div>
      </div>
    </PlayShell>
  );
}

function FogPlayPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [side] = useLaunchChoiceState(
    launchContext,
    ["side", "choice"],
    ["heads", "tails"] as const,
    "heads",
  );
  const [amount] = useLaunchParamState(
    launchContext,
    ["amount", "stake", "bet"],
    "0.10",
  );
  const payout = (Number(amount) || 0) * 2;

  return (
    <PlayShell
      app={app}
      title="Coin flip table"
      subtitle="Choose heads or tails, size the bet, then submit from the shared action console when the preview looks right."
      tone="violet"
      side={<MetricGrid stats={stats} />}
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
      <div className="grid gap-3">
        <ActionBoard
          title="Flip market"
          subtitle="Pick one outcome and see the exact payout preview before signing."
          tone="violet"
          rows={(["heads", "tails"] as const).map((option) => ({
            label: option === "heads" ? "Heads" : "Tails",
            detail:
              option === "heads"
                ? "Oracle result equals heads"
                : "Oracle result equals tails",
            value: "2.00x",
            valueLabel: "payout",
            active: side === option,
            icon: <Dice5 className="h-4 w-4" />,
          }))}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Outcome" value={side} />
          <PreviewStat label="Potential payout" value={formatGas(payout)} />
          <PreviewStat
            label="Limits"
            value={`${getMetric(statsMap, "Min Bet", "--")} - ${getMetric(statsMap, "Max Bet", "--")}`}
          />
        </div>
        <PlayAreaConsoleHint label="Choose side, stake amount, and submit the flip from the right action console." />
      </div>
    </PlayShell>
  );
}

function GasBoxPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [selectedRaw] = useLaunchParamState(
    launchContext,
    ["machine", "machineId", "box"],
    "1",
  );
  const selected = Math.max(1, Number(selectedRaw) || 1);
  const machines = Math.max(
    1,
    Number(getMetric(statsMap, "Total Machines", "3")) || 3,
  );

  return (
    <PlayShell
      app={app}
      title="GASBox gacha machine"
      subtitle="Pick a machine, inspect its capsule pool, and stage a draw before sending the on-chain play operation."
      tone="amber"
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        <div className="grid gap-3">
          <ActionBoard
            title="Machine selector"
            subtitle="Each machine is a separate prize pool. Pick the active machine before staging a draw."
            tone="amber"
            rows={Array.from({ length: Math.min(machines, 6) }, (_, index) => {
              const machine = index + 1;
              return {
                label: `Machine #${machine}`,
                detail:
                  machine === selected
                    ? "Selected for next draw"
                    : "Available draw pool",
                value: machine === selected ? "selected" : "ready",
                valueLabel: "state",
                active: selected === machine,
                icon: <Boxes className="h-4 w-4" />,
              };
            })}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Selected machine" value={`#${selected}`} />
            <PreviewStat label="Machines online" value={String(machines)} />
            <PreviewStat label="Draw asset" value="GAS" />
          </div>
          <PlayAreaConsoleHint label="Machine selection and capsule draw submission are handled in the right action console." />
        </div>
        <div className="space-y-3">
          <MetricGrid stats={stats} />
        </div>
      </div>
    </PlayShell>
  );
}

function RedEnvelopePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [envelopeId] = useLaunchParamState(
    launchContext,
    ["envelopeId", "id", "packet"],
    "",
  );
  const hasEnvelopeId = Boolean(envelopeId.trim());
  const activeRows = activity?.rows ?? [];

  return (
    <PlayShell
      app={app}
      title="Open red envelope"
      subtitle="Recipients should see one clear job first: open the shared envelope and claim once. Sending and active lists stay secondary."
      tone="rose"
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        <section
          className={`rounded-[18px] border p-3.5 shadow-sm shadow-gray-950/5 sm:rounded-[22px] sm:p-4 ${hasEnvelopeId ? "border-rose-200 bg-rose-50" : "border-gray-200 bg-white"}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div
                className={`mb-2 grid h-10 w-10 place-items-center rounded-xl sm:mb-3 sm:h-11 sm:w-11 sm:rounded-2xl ${hasEnvelopeId ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="m-0 text-lg font-black tracking-tight text-gray-950 sm:text-xl">
                {hasEnvelopeId ? "Envelope ready" : "Open a shared envelope"}
              </h3>
              <p className="m-0 mt-1 max-w-2xl text-xs font-semibold leading-5 text-gray-600 sm:mt-1.5 sm:text-sm">
                {hasEnvelopeId
                  ? "The shared envelope ID is loaded. Claim from the action console; the wallet signs the on-chain claim."
                  : "Use a shared link, QR code, or enter an envelope ID in the action console to claim."}
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-left sm:min-w-36 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-right">
              <p className="m-0 text-[11px] font-black uppercase tracking-wide text-gray-400">
                Envelope ID
              </p>
              <p className="m-0 mt-0.5 text-lg font-black text-gray-950 sm:text-xl">
                {hasEnvelopeId ? envelopeId : "not loaded"}
              </p>
            </div>
          </div>
        </section>

        <SecondaryInfo
          title="Active envelopes"
          description="Optional list for browsing live envelopes. Claim stays the primary task."
          meta={`${activeRows.length} items`}
        >
          {activeRows.length > 0 ? (
            <div className="space-y-2">
              {activeRows.slice(0, 6).map((row, index) => (
                <div
                  key={`${row.primary}:${index}`}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2"
                >
                  <p className="m-0 text-sm font-black text-gray-950">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="m-0 mt-0.5 text-xs font-semibold text-gray-500">
                      {row.secondary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm leading-6 text-gray-500">
              No active envelopes returned by the live data source.
            </p>
          )}
        </SecondaryInfo>
        <MetricGrid stats={stats} />
      </div>
    </PlayShell>
  );
}

function GasLuckyPoolPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [claimKey] = useLaunchParamState(
    launchContext,
    ["claimKey", "key", "code", "k"],
    "",
  );
  const [minClaim] = useLaunchParamState(
    launchContext,
    ["minClaim", "min"],
    "1",
  );
  const [maxClaim] = useLaunchParamState(
    launchContext,
    ["maxClaim", "max"],
    "50",
  );
  const hasClaimKey = Boolean(claimKey.trim());

  return (
    <PlayShell
      app={app}
      title="OneGate Vault"
      subtitle="Scan with OneGate, claim once, and receive a random GAS reward directly in your wallet."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        <section
          className={`rounded-[18px] border p-3.5 shadow-sm shadow-gray-950/5 sm:rounded-[20px] sm:p-4 ${
            hasClaimKey
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div
                className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${
                  hasClaimKey
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="m-0 text-lg font-black tracking-tight text-gray-950 sm:text-xl">
                {hasClaimKey ? "Reward ready" : "Scan to claim"}
              </h3>
              <p className="m-0 mt-1 max-w-xl text-xs font-semibold leading-5 text-gray-600 sm:mt-1.5 sm:text-sm">
                {hasClaimKey
                  ? "Your OneGate scan is verified. Claim once to receive GAS in your wallet."
                  : "Open this reward from a OneGate QR code to load your claim automatically."}
              </p>
            </div>
            <div className="w-fit rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-left sm:min-w-36 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-right">
              <p className="m-0 text-[11px] font-black uppercase tracking-wide text-gray-400">
                Reward range
              </p>
              <p className="m-0 mt-0.5 text-lg font-black text-gray-950 sm:text-xl">
                {minClaim || "1"}-{maxClaim || "50"} GAS
              </p>
            </div>
          </div>
        </section>
      </div>
    </PlayShell>
  );
}

function DailyCheckinPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    loading,
    error,
    contractHash,
    network,
    onRefresh,
  } = props;
  const claimed = clampNumber(
    parseNumericMetric(
      getMetric(statsMap, "Current Streak", getMetric(statsMap, "Streak", "0")),
    ),
    0,
    7,
  );
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <PlayShell
      app={app}
      title="Daily streak board"
      subtitle="One daily check-in keeps the streak alive. The seventh day unlocks the bigger reward."
      tone="emerald"
      side={<MetricGrid stats={stats} />}
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
      <div className="space-y-3">
        <div className="grid gap-3">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-sm font-black text-gray-950">
                  Weekly streak
                </h3>
                <p className="m-0 mt-1 text-xs leading-5 text-gray-500">
                  The streak path stays visible so the next claim feels
                  immediate and understandable.
                </p>
              </div>
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const active = index < claimed;
                const today = index + 1 === claimed;
                return (
                  <div
                    key={day}
                    className={`min-h-20 rounded-lg border px-2 py-3 text-center ${
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    <CalendarCheck
                      className={`mx-auto mb-2 h-5 w-5 ${active ? "text-emerald-600" : "text-gray-400"}`}
                    />
                    <span className="block text-xs font-black">{day}</span>
                    {today && (
                      <span className="mt-1 block text-[10px] font-black uppercase text-emerald-600">
                        today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Current streak" value={`${claimed} days`} />
            <PreviewStat
              label="7-day reward"
              value={getMetric(statsMap, "7-Day Reward", "--")}
            />
            <PreviewStat
              label="Total rewarded"
              value={getMetric(statsMap, "Total Rewarded", "0 GAS")}
            />
          </div>
          <PlayAreaConsoleHint label="Today's check-in and wallet confirmation are handled in the right action console." />
        </div>
        <ActionBoard
          title="Streak state"
          subtitle="The app keeps the user focused on the next claim and the weekly completion target."
          tone="emerald"
          rows={[
            {
              label: "Today",
              detail:
                claimed >= 1
                  ? "Eligible for today's daily claim"
                  : "Connect wallet to start",
              value: claimed >= 1 ? "eligible" : "not started",
              valueLabel: "state",
              active: true,
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
            {
              label: "Weekly progress",
              detail: "Seven consecutive claims unlock the bonus",
              value: `${claimed}/7`,
              valueLabel: "days",
            },
            {
              label: "Reset risk",
              detail: "Missing a day restarts the streak",
              value: claimed >= 7 ? "complete" : `${7 - claimed} left`,
              valueLabel: "target",
            },
          ]}
        />
      </div>
    </PlayShell>
  );
}

function SelfLoanPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [collateral] = useLaunchParamState(
    launchContext,
    ["collateral", "neo"],
    "20",
  );
  const ltv = 0.35;
  const borrowable = (Number(collateral) || 0) * ltv;

  return (
    <PlayShell
      app={app}
      title="Self-repaying loan panel"
      subtitle="Lock NEO, draw GAS, and route future yield toward repayment without liquidation."
      tone="sky"
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        <div className="grid gap-3">
          <ActionBoard
            title="Loan position"
            subtitle="Collateral, borrow capacity, and repayment state are visible before opening a position."
            tone="sky"
            rows={[
              {
                label: "NEO collateral",
                detail: "Locked collateral amount",
                value: `${collateral || "0"} NEO`,
                valueLabel: "input",
                active: true,
                icon: <Landmark className="h-4 w-4" />,
              },
              {
                label: "Borrowable GAS",
                detail: "Conservative LTV preview",
                value: formatGas(borrowable),
                valueLabel: "35% ltv",
              },
              {
                label: "Outstanding debt",
                detail: "Current contract read",
                value: getMetric(statsMap, "Outstanding Debt", "0 GAS"),
                valueLabel: "debt",
              },
              {
                label: "Locked collateral",
                detail: "Total collateral in the app",
                value: getMetric(statsMap, "Collateral Locked", "0 NEO"),
                valueLabel: "locked",
              },
            ]}
          />
          <PlayAreaConsoleHint label="Collateral amount and loan submission are controlled from the right action console." />
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <PreviewStat label="Borrowable GAS" value={formatGas(borrowable)} />
          <PreviewStat label="LTV preview" value="35%" />
          <PreviewStat
            label="Locked collateral"
            value={getMetric(statsMap, "Collateral Locked", "0 NEO")}
          />
          <PreviewStat
            label="Outstanding debt"
            value={getMetric(statsMap, "Outstanding Debt", "0 GAS")}
          />
        </div>
        <MetricGrid stats={stats} />
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

function AnchorPlayArea(
  props: PlayAreaRegistryProps & { mode: "profit" | "trust" },
) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
    mode,
  } = props;
  const [agentId] = useLaunchParamState(
    launchContext,
    ["agentId", "agent"],
    "1",
  );
  const [candidate] = useLaunchParamState(
    launchContext,
    ["candidate", "target", "voteTarget"],
    "",
  );
  const [amount] = useLaunchParamState(launchContext, ["amount", "neo"], "1");
  const isProfit = mode === "profit";
  const totalStaked = getMetric(statsMap, "Total Staked", "0 NEO");
  const agentCount = getMetric(
    statsMap,
    "Agents",
    getMetric(statsMap, "Agent Count", "0"),
  );
  const rewardReserve = getMetric(
    statsMap,
    "Reward Reserve",
    getMetric(statsMap, "Rewards", "0 GAS"),
  );
  const selectedAgent = getMetric(statsMap, "Selected Agent", "not selected");

  return (
    <PlayShell
      app={app}
      title={isProfit ? "ProfitAnchor stake desk" : "TrustAnchor stake desk"}
      subtitle={
        isProfit
          ? "Stake NEO, withdraw NEO, and claim GAS rewards. Operators handle the 21-agent profit route in secondary controls."
          : "Stake NEO, withdraw NEO, and claim GAS rewards. Operators handle the 21-agent trust route in secondary controls."
      }
      tone={isProfit ? "emerald" : "slate"}
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        <div className="grid gap-3">
          <ActionBoard
            title="User flow"
            subtitle="The primary workflow is intentionally small: stake, withdraw, claim. Routing details stay folded below."
            tone={isProfit ? "emerald" : "slate"}
            rows={[
              {
                label: "Stake NEO",
                detail: "Deposit a whole-number NEO amount into this anchor",
                value: amount || "1",
                valueLabel: "NEO",
                active: true,
                icon: <LockKeyhole className="h-4 w-4" />,
              },
              {
                label: "Withdraw",
                detail: "Exit your own stake without touching operator routing",
                value: "available",
                valueLabel: "user action",
                icon: <RotateCcw className="h-4 w-4" />,
              },
              {
                label: "Claim rewards",
                detail: "Claim accumulated GAS rewards after distribution",
                value: rewardReserve,
                valueLabel: "reserve",
                icon: <Coins className="h-4 w-4" />,
              },
            ]}
          />
          <PlayAreaConsoleHint label="Use the right action console for Stake, Withdraw, and Claim. Operator routing actions are secondary." />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Total NEO tracked" value={totalStaked} />
          <PreviewStat label="Reward reserve" value={rewardReserve} />
          <PreviewStat label="Routing mode" value="Manual" />
        </div>
        <SecondaryInfo
          title="Agent and accounting details"
          description="Secondary diagnostics only. The main screen stays dedicated to the user stake lifecycle."
          meta="advanced"
        >
          <div className="grid gap-3">
            <ActionBoard
              title="Live contract reads"
              subtitle="Values come from the configured chain/server data source. Missing values are shown as unavailable, not fabricated."
              tone={isProfit ? "emerald" : "slate"}
              rows={[
                {
                  label: "Registered agents",
                  detail: "Read from getAnchorStats.agentCount",
                  value: agentCount,
                  valueLabel: "count",
                  active: true,
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  label: "Reward reserve",
                  detail: "Reward accounting read from the anchor contract",
                  value: rewardReserve,
                  valueLabel: "GAS",
                  icon: <Coins className="h-4 w-4" />,
                },
                {
                  label: "Selected manual route",
                  detail: "Read from getAnchorStats.selectedAgentId",
                  value: selectedAgent,
                  valueLabel: "agent",
                  icon: <ArrowRightLeft className="h-4 w-4" />,
                },
              ]}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <PreviewStat
                label="Operator candidate input"
                value={candidate ? shortHash(candidate) : `agent ${agentId}`}
              />
              <PreviewStat
                label="AA derivation"
                value="anchor+appId+agentId+nonce"
              />
            </div>
          </div>
        </SecondaryInfo>
        <MetricGrid stats={stats} />
      </div>
    </PlayShell>
  );
}

function NeoPayPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [amount] = useLaunchParamState(
    launchContext,
    ["amount", "total"],
    "12",
  );
  const [rate] = useLaunchParamState(
    launchContext,
    ["rate", "releaseRate"],
    "1",
  );
  const duration = Math.ceil(
    (Number(amount) || 0) / Math.max(0.01, Number(rate) || 1),
  );

  return (
    <PlayShell
      app={app}
      title="Payment stream builder"
      subtitle="Compose a payroll, grant, or escrow stream with release cadence and beneficiary before submitting."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
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
      <div className="space-y-3">
        <div className="grid gap-3">
          <ActionBoard
            title="Payment stream"
            subtitle="Amount, cadence, and unlock horizon are visible before the stream is created."
            tone="emerald"
            rows={[
              {
                label: "Total amount",
                detail: "Funds streamed over time",
                value: formatGas(Number(amount) || 0),
                valueLabel: "total",
                active: true,
                icon: <CreditCard className="h-4 w-4" />,
              },
              {
                label: "Release rate",
                detail: "Linear release cadence",
                value: `${rate || "0"} GAS/day`,
                valueLabel: "rate",
              },
              {
                label: "Duration",
                detail: "Calculated from amount and rate",
                value: `${duration} days`,
                valueLabel: "length",
              },
              {
                label: "Active streams",
                detail: "Current contract read",
                value: getMetric(statsMap, "Total Streams", "0"),
                valueLabel: "count",
              },
            ]}
          />
          <PlayAreaConsoleHint label="Stream terms, beneficiary, and wallet signing stay in the right action console." />
        </div>
        <MetricGrid stats={stats} />
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
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [deck, setDeck] = useState<TarotCard[]>([]);
  const [drawn, setDrawn] = useState<TarotCard[]>([]);
  const [flipped, setFlipped] = useState(false);
  const handledOperationRef = useRef("");

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
    const picks = [0, 1, 2].map(
      (offset) => source[(seed + offset * 17) % source.length],
    );
    setDrawn(picks);
    setFlipped(false);
  }, [deck]);

  useEffect(() => {
    if (drawn.length === 0) drawCards();
  }, [drawCards, drawn.length]);

  useEffect(() => {
    const operation = launchContext?.operation;
    if (operation !== "drawTarotReading" && operation !== "flipTarotReading")
      return;
    const signature = `${operation}:${launchContext?.signature || ""}`;
    if (handledOperationRef.current === signature) return;
    handledOperationRef.current = signature;
    if (operation === "drawTarotReading") drawCards();
    if (operation === "flipTarotReading") setFlipped(true);
  }, [drawCards, launchContext?.operation, launchContext?.signature]);

  return (
    <PlayShell
      app={app}
      title="Draw, flip, read"
      subtitle="The first screen is the reading table: draw three cards, flip them, and use the action console for the on-chain request."
      tone="violet"
      side={
        <div className="rounded-lg border border-violet-100 bg-white/85 p-4">
          <h3 className="m-0 text-sm font-bold text-gray-950">
            Reading spread
          </h3>
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <PreviewStat
              label="Deck"
              value={`${deck.length || FALLBACK_TAROT.length} cards`}
            />
            <PreviewStat label="Spread" value="Past / Signal / Path" />
            <PreviewStat label="Randomness" value="Neo block seed" />
          </div>
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
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {(drawn.length ? drawn : FALLBACK_TAROT.slice(0, 3)).map(
            (card, index) => {
              const image = card.image?.replace(
                "./cards/",
                "/miniapps/on-chain-tarot/cards/",
              );
              return (
                <button
                  key={`${card.id}:${index}`}
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="group min-h-[260px] cursor-pointer rounded-lg border border-violet-100 bg-slate-950 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {flipped ? (
                    <div className="h-full">
                      <img
                        src={image}
                        alt={card.name}
                        className="mx-auto aspect-[2/3] h-44 rounded-md object-cover"
                      />
                      <p className="m-0 mt-3 text-sm font-black text-white">
                        {card.name}
                      </p>
                      <p className="m-0 mt-1 text-xs text-violet-200">
                        {card.keyword} / {card.meaning}
                      </p>
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
            },
          )}
        </div>
        <PlayAreaConsoleHint label="Use the action console to draw or flip a reading. Cards remain tappable for the reading table itself." />
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
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const launchNetwork = launchContext?.network ?? network;
  const [selectedNetwork, setSelectedNetwork] = useState<"mainnet" | "testnet">(
    launchNetwork,
  );
  const [query] = useLaunchParamState(
    launchContext,
    ["query", "q", "hash", "address", "height"],
    "",
  );
  const [stats, setStats] = useState<ExplorerStatsPayload | null>(null);
  const [recent, setRecent] = useState<ExplorerRecentTx[]>([]);
  const [result, setResult] = useState<ExplorerSearchPayload | null>(null);
  const [status, setStatus] = useState("Ready");
  const [isFetching, setIsFetching] = useState(false);
  const handledSearchRef = useRef("");

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
        const recentPayload = (await recentRes.json()) as {
          transactions?: ExplorerRecentTx[];
        };
        setRecent(
          Array.isArray(recentPayload.transactions)
            ? recentPayload.transactions
            : [],
        );
      } else {
        setRecent([]);
      }
      setStatus("Live chain data loaded");
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `Explorer API unavailable: ${err.message}`
          : "Explorer API unavailable",
      );
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
      const payload = (await res.json()) as ExplorerSearchPayload & {
        error?: string;
      };
      if (!res.ok || payload.error) {
        throw new Error(payload.error || `search ${res.status}`);
      }
      setResult(payload);
      setStatus(
        payload.found
          ? "Resolved from live data"
          : "No matching live record found",
      );
    } catch (err) {
      setStatus(
        err instanceof Error
          ? `Search failed: ${err.message}`
          : "Search failed",
      );
    } finally {
      setIsFetching(false);
    }
  }, [query, selectedNetwork]);

  useEffect(() => {
    if (launchContext?.operation !== "explorerSearch") return;
    const signature = `${launchContext.signature}:${query}:${selectedNetwork}`;
    if (!query.trim() || handledSearchRef.current === signature) return;
    handledSearchRef.current = signature;
    void runSearch();
  }, [
    launchContext?.operation,
    launchContext?.signature,
    query,
    runSearch,
    selectedNetwork,
  ]);

  const selectedStats = stats?.[selectedNetwork];
  const height = selectedStats?.height
    ? selectedStats.height.toLocaleString()
    : "Unavailable";
  const txCount =
    typeof selectedStats?.txCount === "number"
      ? selectedStats.txCount.toLocaleString()
      : "Indexer unavailable";
  const resultStats: PlayMetric[] = [
    { label: "Network", value: selectedNetwork, accent: true },
    { label: "Block height", value: height, accent: true },
    { label: "Indexed tx", value: txCount },
    {
      label: "Result",
      value: result?.found ? String(result.type || "found") : "none",
    },
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
                    <div
                      key={`${hash}:${index}`}
                      className="block w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left"
                    >
                      <span className="block truncate font-mono text-xs font-bold text-gray-950">
                        {shortHash(hash)}
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold text-gray-500">
                        {state || "state unavailable"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="m-0 text-sm leading-6 text-gray-500">
                  Recent transaction indexer is not configured or has no rows
                  for this network.
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
      <div className="space-y-3">
        <MetricGrid stats={resultStats} />
        <ActionBoard
          title="Search state"
          subtitle="Enter the query and network in the action console. This playarea stays focused on live chain results."
          tone="slate"
          rows={[
            {
              label: "Selected network",
              detail: "Mainnet and testnet requests are isolated",
              value: selectedNetwork,
              valueLabel: "scope",
              active: true,
              icon: <SearchCheck className="h-4 w-4" />,
            },
            {
              label: "Query",
              detail: "Block height, transaction, address, or contract",
              value: query.trim() ? shortHash(query.trim()) : "not set",
              valueLabel: "input",
            },
            {
              label: "Status",
              detail: "Live API response state",
              value: status,
              valueLabel: isFetching ? "loading" : "state",
            },
            {
              label: "Recent index",
              detail: "Latest fetched transaction rows",
              value: recent.length > 0 ? `${recent.length}` : "none",
              valueLabel: "rows",
            },
          ]}
        />
        <ExplorerResultPanel result={result} />
      </div>
    </PlayShell>
  );
}

function ExplorerResultPanel({
  result,
}: {
  result: ExplorerSearchPayload | null;
}) {
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
        No live record found for this query on{" "}
        {result.network || "the selected network"}.
        {result.source === "indexer_unavailable"
          ? " Address history requires the indexer service."
          : ""}
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
          <PreviewStat
            key={label}
            label={label}
            value={value || "Unavailable"}
          />
        ))}
      </div>
    </div>
  );
}

function NeoXBridgePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [amount] = useLaunchParamState(launchContext, ["amount"], "");
  const [direction] = useLaunchChoiceState(
    launchContext,
    ["direction", "route"],
    ["Neo N3 -> Neo X", "Neo X -> Neo N3"] as const,
    "Neo N3 -> Neo X",
  );
  const [targetContract] = useLaunchParamState(
    launchContext,
    ["targetContract", "contract", "to"],
    "",
  );
  const [bridgeMessage] = useLaunchParamState(
    launchContext,
    ["message", "payload"],
    "",
  );

  return (
    <PlayShell
      app={app}
      title="Neo X bridge control console"
      subtitle="Operate asset bridge, Message Bridge, and operation status tracking without leaving the platform shell."
      tone="sky"
      side={<BridgeStatusPanel />}
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
      <div className="space-y-3">
        <ActionBoard
          title="Bridge route"
          subtitle="Bridge inputs live in the right action console. The playarea summarizes the chosen route and current tracking state."
          tone="sky"
          rows={[
            {
              label: "Asset bridge",
              detail: "Direction selected from OneGate / action console",
              value: direction,
              valueLabel: amount ? `${amount} GAS` : "route",
              active: true,
              icon: <ArrowRightLeft className="h-4 w-4" />,
            },
            {
              label: "Target contract",
              detail: "Message Bridge target",
              value: targetContract ? shortHash(targetContract) : "not set",
              valueLabel: "hash",
              icon: <MessageSquareText className="h-4 w-4" />,
            },
            {
              label: "Message",
              detail: bridgeMessage || "Payload set in action console",
              value: bridgeMessage ? "ready" : "waiting",
              valueLabel: "payload",
              icon: <ReceiptText className="h-4 w-4" />,
            },
            {
              label: "Relay",
              detail: "Release once lock, relay, and proof are confirmed",
              value: "waiting proof",
              valueLabel: "state",
            },
          ]}
        />
        <MetricGrid
          stats={[
            { label: "Route", value: direction, accent: true },
            {
              label: "Amount",
              value: amount ? `${amount} GAS` : "Set in action console",
            },
            {
              label: "Target",
              value: targetContract ? shortHash(targetContract) : "No target",
            },
            { label: "Payload", value: bridgeMessage ? "Ready" : "Empty" },
          ]}
        />
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
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [recipient] = useLaunchParamState(
    launchContext,
    ["recipient", "to", "address"],
    "",
  );
  const [amount] = useLaunchParamState(launchContext, ["amount"], "");
  const [asset] = useLaunchChoiceState(
    launchContext,
    ["asset", "token"],
    ["GAS", "NEO"] as const,
    "GAS",
  );
  const [memo] = useLaunchParamState(launchContext, ["memo", "note"], "");
  const [result, setResult] = useState<PrivateTransferResult>({
    status: "idle",
    message: "Ready to seal transfer instructions locally.",
  });
  const handledSealRef = useRef("");

  const sealTransfer = useCallback(async () => {
    setResult({
      status: "sealing",
      message:
        "Fetching Morpheus public key and building a local X25519 envelope.",
    });
    try {
      const keyResponse = await fetch(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(
          keyMeta?.error || "Morpheus oracle public key is unavailable",
        );
      }
      if (
        keyMeta.algorithm &&
        keyMeta.algorithm !== "X25519-HKDF-SHA256-AES-256-GCM"
      ) {
        throw new Error(
          `Unsupported Morpheus encryption algorithm: ${keyMeta.algorithm}`,
        );
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
        throw new Error(
          stored?.error ||
            stored?.message ||
            "Morpheus confidential store is unavailable",
        );
      }
      const storedRef = String(
        stored.secret_ref || stored.id || stored.ref || "",
      ).trim();
      if (!storedRef) {
        throw new Error(
          "Morpheus confidential store did not return a secret reference",
        );
      }

      setResult({
        status: "stored",
        message:
          "Encrypted transfer intent stored. Only the TEE can decrypt recipient, amount, memo, and note secret.",
        noteCommitment: transferPackage.publicEnvelope.note_commitment,
        nullifier: transferPackage.publicEnvelope.nullifier_hash,
        secretRef: storedRef,
        contract: String(keyMeta.contract || ""),
      });
    } catch (sealError) {
      setResult({
        status: "error",
        message:
          sealError instanceof Error ? sealError.message : String(sealError),
      });
    }
  }, [amount, app.app_id, asset, memo, network, recipient]);

  useEffect(() => {
    if (launchContext?.operation !== "sealPrivateTransfer") return;
    const signature = `${launchContext.signature}:${recipient}:${amount}:${asset}:${memo}`;
    if (!recipient || !amount || handledSealRef.current === signature) return;
    handledSealRef.current = signature;
    void sealTransfer();
  }, [
    amount,
    asset,
    launchContext?.operation,
    launchContext?.signature,
    memo,
    recipient,
    sealTransfer,
  ]);

  return (
    <PlayShell
      app={app}
      title="Confidential transfer desk"
      subtitle="A zERC20-style private transfer workflow without on-chain zk curve assumptions: seal transfer details locally, let Morpheus confidential compute validate them inside the TEE, then return a signed settlement intent."
      tone="slate"
      side={<PrivateTransferStatusPanel result={result} />}
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
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
        <ActionBoard
          title="Private transfer intent"
          subtitle="Recipient, asset, amount, and memo are submitted from the right action console, then sealed locally for Morpheus confidential compute."
          tone="slate"
          rows={[
            {
              label: "Recipient",
              detail: recipient || "Set in action console",
              value: recipient ? shortHash(recipient) : "waiting",
              valueLabel: "address",
              active: Boolean(recipient),
              icon: <LockKeyhole className="h-4 w-4" />,
            },
            {
              label: "Amount",
              detail: "Asset and amount remain private inside the envelope",
              value: amount ? `${amount} ${asset}` : `0 ${asset}`,
              valueLabel: "sealed",
            },
            {
              label: "Private memo",
              detail: memo || "Optional private note",
              value: memo ? "included" : "empty",
              valueLabel: "private",
            },
            {
              label: "Result",
              detail: result.message,
              value: result.status,
              valueLabel: "state",
            },
          ]}
        />

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

function PrivateTransferStatusPanel({
  result,
}: {
  result: PrivateTransferResult;
}) {
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
        {result.secretRef && (
          <PreviewStat label="Secret ref" value={result.secretRef} />
        )}
        {result.noteCommitment && (
          <PreviewStat label="Note commitment" value={result.noteCommitment} />
        )}
        {result.nullifier && (
          <PreviewStat label="Nullifier hash" value={result.nullifier} />
        )}
        {result.contract && (
          <PreviewStat
            label="Oracle contract"
            value={shortHash(result.contract)}
          />
        )}
      </div>
    </div>
  );
}

function OracleConsolePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const config = ORACLE_APP_LABELS[app.app_id] || {
    title: app.name,
    mode: "http" as const,
  };
  const defaultOracleEndpoint =
    config.mode === "price"
      ? "TWELVEDATA:NEO-USD"
      : `${getExternalIntegrationConfig(resolveNeoNetwork(network)).morpheusPublicApiUrl}/health`;
  const [endpoint] = useLaunchParamState(
    launchContext,
    ["endpoint", "url", "feed", "symbol"],
    defaultOracleEndpoint,
  );
  const [result, setResult] = useState("Ready to build request package.");
  const [sealing, setSealing] = useState(false);
  const handledOracleRef = useRef("");
  const confidentialMode =
    config.mode === "compute" ||
    config.mode === "seal" ||
    config.mode === "neodid";

  const build = useCallback(() => {
    const payload = {
      app_id: app.app_id,
      mode: config.mode,
      endpoint,
      callback: "onOracleResult(requestId, result)",
      nep21: true,
    };
    setResult(JSON.stringify(payload, null, 2));
  }, [app.app_id, config.mode, endpoint]);

  const seal = useCallback(async () => {
    setSealing(true);
    try {
      const keyResponse = await fetch(
        `/api/morpheus/oracle/public-key?network=${encodeURIComponent(network)}`,
      );
      const keyMeta = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyMeta?.public_key) {
        throw new Error(
          keyMeta?.error || "Morpheus oracle public key is unavailable",
        );
      }
      const confidentialPayload = {
        kind: `oracle.${config.mode}.confidential.v1`,
        app_id: app.app_id,
        mode: config.mode,
        target_chain: "neo_n3",
        network,
        request:
          config.mode === "compute"
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
      setResult(
        JSON.stringify(
          {
            status: storeResponse.ok ? "sealed_ref" : "sealed_inline",
            mode: config.mode,
            encryption: keyMeta.algorithm || "X25519-HKDF-SHA256-AES-256-GCM",
            encrypted_payload: storeResponse.ok ? undefined : ciphertext,
            secret_ref: storeResponse.ok
              ? stored.secret_ref || stored.id || stored.ref || "stored"
              : undefined,
            public_key_contract: keyMeta.contract,
          },
          null,
          2,
        ),
      );
    } catch (sealError) {
      setResult(
        JSON.stringify(
          {
            status: "seal_failed",
            error:
              sealError instanceof Error
                ? sealError.message
                : String(sealError),
          },
          null,
          2,
        ),
      );
    } finally {
      setSealing(false);
    }
  }, [app.app_id, config.mode, endpoint, network]);

  useEffect(() => {
    const operation = launchContext?.operation;
    if (operation !== "buildOraclePackage" && operation !== "sealOracleRequest")
      return;
    const signature = `${operation}:${launchContext?.signature || ""}:${endpoint}`;
    if (handledOracleRef.current === signature) return;
    handledOracleRef.current = signature;
    if (operation === "sealOracleRequest" && confidentialMode) {
      void seal();
      return;
    }
    build();
  }, [
    build,
    confidentialMode,
    endpoint,
    launchContext?.operation,
    launchContext?.signature,
    seal,
  ]);

  return (
    <PlayShell
      app={app}
      title={config.title}
      subtitle="Build a Morpheus request, inspect the callback shape, and verify the result envelope in the same native console."
      tone="slate"
      side={<OracleStatusPanel mode={config.mode} result={result} />}
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
      <div className="space-y-3">
        <ActionBoard
          title="Oracle request state"
          subtitle="Request inputs are owned by the right action console. This playarea verifies the package, privacy mode, and result envelope."
          tone="slate"
          rows={[
            {
              label: config.mode === "price" ? "Feed symbol" : "Endpoint",
              detail: endpoint || "Set in action console",
              value: endpoint ? shortHash(endpoint) : "waiting",
              valueLabel: "input",
              active: Boolean(endpoint),
              icon: <Radio className="h-4 w-4" />,
            },
            {
              label: "Privacy",
              detail: confidentialMode
                ? "Morpheus public key required"
                : "Plain oracle request",
              value: confidentialMode ? "sealed" : "optional",
              valueLabel: "mode",
              icon: <LockKeyhole className="h-4 w-4" />,
            },
            {
              label: "Verification",
              detail: "Callback and result envelope remain inspectable",
              value: "verifiable",
              valueLabel: "state",
              icon: <BadgeCheck className="h-4 w-4" />,
            },
            {
              label: "Builder",
              detail: sealing
                ? "Sealing request with Morpheus"
                : "Ready for action-console submit",
              value: sealing ? "sealing" : "ready",
              valueLabel: "state",
            },
          ]}
        />
        <PlayAreaConsoleHint label="Use the action console to build or seal the request. Mainnet and testnet oracle records remain separated by the selected network." />
      </div>
    </PlayShell>
  );
}

function ProfiledPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
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
      : [
          {
            label: "Live data",
            value: contractHash ? "Awaiting read" : "No binding",
          },
          { label: "Inputs", value: "Action console" },
          { label: "Network", value: network, accent: true },
        ];

  return (
    <PlayShell
      app={app}
      title={profile.title}
      subtitle={profile.subtitle}
      tone={profile.tone}
      side={
        <div className="space-y-3">
          <PlayAreaConsoleHint
            label={`${profile.primaryAction} inputs and wallet handoff are handled in the right action console.`}
          />
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
      <div className="space-y-3">
        <ProfileMarketPanel
          profile={profile}
          values={values}
          network={network}
        />
        <MetricGrid stats={profileMetrics} />
      </div>
    </PlayShell>
  );
}

function ProfileMarketPanel({
  profile,
  values,
  network,
}: {
  profile: PlayAreaProfile;
  values: Record<string, string>;
  network: "mainnet" | "testnet";
}) {
  const cards =
    profile.cards.length > 0
      ? profile.cards
      : [{ label: "Primary action", value: "Action console" }];
  const rows = cards.slice(0, 4).map((card, index) => ({
    label: card.label,
    detail:
      profile.steps[index] ||
      profile.visual.slots[index] ||
      profile.visual.headline,
    value: profile.fields[index]
      ? values[profile.fields[index].key]?.trim() || "from console"
      : "workflow",
    valueLabel: profile.fields[index]?.label || "state",
    active: index === 0,
    icon: index === 0 ? profile.icon : undefined,
  }));

  const visualRows = [
    {
      label: "Network",
      detail: "Mainnet/testnet state is isolated",
      value: network,
      valueLabel: "scope",
      active: true,
    },
    {
      label: "Operation",
      detail: profile.primaryAction,
      value: "user input",
      valueLabel: "phase",
    },
    {
      label: "Review",
      detail: profile.steps[1] || profile.visual.headline,
      value: "wallet",
      valueLabel: "phase",
    },
    {
      label: "Submit",
      detail: "Wallet handoff is in the action console",
      value: "signature",
      valueLabel: "phase",
    },
  ];

  return (
    <div className="space-y-3">
      <ActionBoard
        title={profile.visual.headline}
        subtitle={profile.visual.footnote || profile.subtitle}
        rows={rows}
        tone={profile.tone}
      />
      <SecondaryInfo
        title="Execution details"
        description="Network, review, and submit phases stay available without taking over the main playarea."
        meta="flow"
      >
        <ActionBoard
          title="Execution state"
          subtitle="A compact state board for the app-specific flow."
          rows={visualRows}
          tone={profile.tone}
        />
      </SecondaryInfo>
    </div>
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

function GenericPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    onRefresh,
  } = props;

  return (
    <PlayShell
      app={app}
      title={`${app.name} action console`}
      subtitle="Review live state, prepare the primary action, and hand off the final signature through the shared platform controls."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
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
      <div className="grid gap-4">
        <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
          <h3 className="m-0 text-lg font-black text-gray-950">{app.name}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {app.description}
          </p>
          <PlayAreaConsoleHint label="Use the right action console for wallet signing, OneGate launch parameters, and any app-specific operation inputs." />
        </div>
        <MetricGrid stats={stats} />
      </div>
    </PlayShell>
  );
}

function ToolCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="m-0 mt-1 break-words text-sm font-black text-gray-950">
        {value}
      </p>
    </div>
  );
}

function PlayAreaConsoleHint({ label }: { label: string }) {
  return (
    <div className="mt-3 inline-flex max-w-full rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
      {label}
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
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-500"}`}
            >
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
  {
    id: 0,
    name: "The Fool",
    keyword: "Spark",
    meaning: "Leap",
    image: "/miniapps/on-chain-tarot/cards/00-the-fool.svg",
  },
  {
    id: 1,
    name: "The Magician",
    keyword: "Protocol",
    meaning: "Intent",
    image: "/miniapps/on-chain-tarot/cards/01-the-magician.svg",
  },
  {
    id: 2,
    name: "The High Priestess",
    keyword: "Oracle",
    meaning: "Signal",
    image: "/miniapps/on-chain-tarot/cards/02-the-high-priestess.svg",
  },
];
