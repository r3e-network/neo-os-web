import {
  Boxes,
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardCheck,
  Fingerprint,
  Flame,
  HeartHandshake,
  ImageIcon,
  KeyRound,
  Scale,
  Send,
  Ticket,
  WandSparkles,
  Workflow,
} from "lucide-react";

import type { PlayAreaProfile } from "./PlayAreaProfileTypes";

export const AA_PROFILED_PLAYAREAS: Record<string, PlayAreaProfile> = {
  "miniapp-aa-account-lab": {
    title: "AA account registration lab",
    subtitle:
      "Preview registration intent, predicted account id, and owner binding before wallet submission.",
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
    primaryAction: "Prepare account registration",
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
    primaryAction: "Create listing",
    visual: {
      headline: "Trustless listing board",
      slots: ["Draft", "Funded", "Accepted", "Settled"],
    },
  },
  "miniapp-aa-permissions-lab": {
    title: "AA permission binding console",
    subtitle:
      "Inspect verifier and hook bindings, then prepare permission updates with clear before and after state.",
    tone: "slate",
    icon: <ClipboardCheck className="h-5 w-5" />,
    fields: [
      { key: "verifier", label: "Verifier hash", defaultValue: "" },
      { key: "hook", label: "Hook binding", defaultValue: "spend-limit" },
    ],
    cards: [
      { label: "Verifier", value: "policy" },
      { label: "Hook", value: "binding" },
      { label: "Scope", value: "account" },
    ],
    steps: [
      "Read bindings",
      "Compare desired policy",
      "Apply update",
      "Verify event",
    ],
    primaryAction: "Prepare permission update",
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
      { label: "Nonce", value: "replay guard" },
      { label: "Relay", value: "payload" },
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
      { label: "Sponsor", value: "policy" },
      { label: "Verifier", value: "session key" },
    ],
    steps: ["Define scope", "Set limit", "Bind verifier", "Activate key"],
    primaryAction: "Activate session key",
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
      { label: "Runbook", value: "recipe" },
    ],
    steps: [
      "Select trigger",
      "Attach oracle",
      "Review action",
      "Enable monitor",
    ],
    primaryAction: "Enable automation",
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
      { label: "Agreement", value: "terms" },
      { label: "Counterparty", value: "approval" },
      { label: "Settlement", value: "split release" },
    ],
    steps: [
      "Draft terms",
      "Invite counterparty",
      "Lock assets",
      "Release split",
    ],
    primaryAction: "Prepare agreement",
    visual: {
      headline: "Split ledger",
      slots: ["Party A", "Party B", "Shared pool", "Release"],
    },
  },
  "miniapp-burn-league": {
    title: "Burn league arena",
    subtitle:
      "Enter a burn challenge, preview leaderboard impact, and submit the burn transaction intentionally.",
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
      { label: "Burn", value: "entry" },
      { label: "Leaderboard", value: "ranking" },
      { label: "Season", value: "round" },
    ],
    steps: ["Choose league", "Preview burn", "Submit burn", "Update rank"],
    primaryAction: "Submit burn entry",
    visual: {
      headline: "Leaderboard impact",
      slots: ["You", "Top 10", "Weekly", "Final"],
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
    primaryAction: "Send tip",
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
      { label: "Gate", value: "attendance" },
    ],
    steps: ["Create event", "Mint passes", "Scan QR", "Mark used"],
    primaryAction: "Issue ticket batch",
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
      "Prepare deployment",
    ],
    primaryAction: "Prepare NEP-17 launch",
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
      { label: "Royalty", value: "policy" },
    ],
    steps: [
      "Select collection template",
      "Attach metadata policy",
      "Review mint controls",
      "Prepare collection",
    ],
    primaryAction: "Prepare NEP-11 collection",
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
      { label: "Catalog", value: "publish entry" },
    ],
    steps: [
      "Pick app template",
      "Bind owner and modules",
      "Review OneGate launch URL",
      "Prepare catalog entry",
    ],
    primaryAction: "Prepare MiniApp launch",
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
    primaryAction: "Prepare flash route",
    visual: {
      headline: "Atomic loan path",
      slots: ["Borrow", "Trade", "Repay", "Profit"],
    },
  },
};
