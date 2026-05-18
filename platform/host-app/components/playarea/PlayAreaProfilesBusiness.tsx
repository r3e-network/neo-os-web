import {
  ArrowRightLeft,
  BadgeCheck,
  BookOpenCheck,
  Coins,
  CreditCard,
  FileKey,
  FileSignature,
  Hash,
  History,
  Hourglass,
  Landmark,
  Layers3,
  Medal,
  ShieldAlert,
  UserCheck,
  Users,
  Vault,
  WalletCards,
} from "lucide-react";

import type { PlayAreaProfile } from "./PlayAreaProfileTypes";

export const BUSINESS_PROFILED_PLAYAREAS: Record<string, PlayAreaProfile> = {
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
    primaryAction: "Enable sponsor policy",
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
    primaryAction: "Delegate voting power",
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
    primaryAction: "Bury record",
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
      { label: "Tribute", value: "message" },
      { label: "Proof", value: "on-chain" },
      { label: "Visitors", value: "shared page" },
    ],
    steps: ["Write tribute", "Preview wall", "Anchor proof", "Share memorial"],
    primaryAction: "Anchor tribute",
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
    primaryAction: "Fund escrow",
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
      "Build a token swap preview with route, slippage, and settlement state before wallet submission.",
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
    steps: ["Select assets", "Preview quote", "Check slippage", "Confirm swap"],
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
    primaryAction: "Create multisig request",
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
      { label: "Availability", value: "domain search" },
      { label: "Resolver", value: "wallet" },
      { label: "Renewal", value: "extension" },
    ],
    steps: ["Search name", "Resolve price", "Register", "Set resolver"],
    primaryAction: "Register domain",
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
    primaryAction: "Create shared stream",
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
    primaryAction: "Sign message",
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
      { label: "Balances", value: "chain reads" },
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
    primaryAction: "Prepare credential proof",
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
      { label: "Round", value: "funding" },
    ],
    steps: [
      "Choose grant",
      "Add contribution",
      "Preview match",
      "Submit donation",
    ],
    primaryAction: "Submit contribution",
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
      { label: "Ticket", value: "recovery request" },
      { label: "Timelock", value: "48h" },
      { label: "Recovery", value: "guarded" },
    ],
    steps: [
      "Open ticket",
      "Notify guardians",
      "Wait timelock",
      "Execute recovery",
    ],
    primaryAction: "Open recovery ticket",
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
      { label: "Issuer", value: "proof" },
    ],
    steps: [
      "Enter recipient",
      "Attach claim",
      "Mint certificate",
      "Share proof",
    ],
    primaryAction: "Issue certificate",
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
      { label: "Seal", value: "time lock" },
      { label: "Unlock", value: "scheduled" },
      { label: "Proof", value: "public hash" },
    ],
    steps: ["Hash message", "Set unlock", "Seal capsule", "Open later"],
    primaryAction: "Seal capsule",
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
    primaryAction: "Anchor timestamp",
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
    primaryAction: "Create vault",
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
      { label: "Risk", value: "checklist" },
      { label: "Approvals", value: "permissions" },
      { label: "Backup", value: "self-check" },
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
