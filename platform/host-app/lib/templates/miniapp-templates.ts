import type { MiniAppDetailTemplate, OperationEntry, OperationParam } from "@/components/types";

type AppTemplate = { detail_template: MiniAppDetailTemplate; operations: OperationEntry[] };
type KV = { key: string; value: string };

const amt = (name = "amount", label = "Amount (GAS)", ph = "1"): OperationParam => ({ name, type: "amount", label, required: true, placeholder: ph });
const sel = (name: string, label: string, opts: string[]): OperationParam => ({ name, type: "select", label, required: true, options: opts.map(o => ({ label: o, value: o.toLowerCase().replace(/\s+/g, "_") })) });
const int = (name: string, label: string, ph = ""): OperationParam => ({ name, type: "integer", label, required: true, placeholder: ph });
const str = (name: string, label: string, value?: string, hidden = false): OperationParam => ({ name, type: "string", label, required: true, default_value: value, hidden });
const wallet = (name = "user", label = "User"): OperationParam => ({ name, type: "hash160", label, required: true, default_value: "$wallet", hidden: true });

const op = (name: string, method: string, style: OperationEntry["button_style"] = "primary", params: OperationParam[] = []): OperationEntry => ({ name, method, button_style: style, params });

function gaming(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Quick Facts", items: [{ key: "Category", value: "Gaming" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How To Play", items: steps },
        ]},
        { id: "leaderboard", label: "Leaderboard", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" }
      ],
      operation_panel: { title: "Play", subtitle: "Configure game parameters and start playing.", cta_label: "Open Game", operations: [] },
    },
    operations: ops,
  };
}

const T_COINFLIP = gaming("Classic 50/50 coin flip with a 2x payout — resolved via Morpheus VRF.", [{ key: "Randomness", value: "VRF" }, { key: "Payout", value: "2x on win" }], ["Choose Heads or Tails.", "Set your wager (0.05 – 100 GAS).", "Flip — win 2x or lose your stake."], [op("Place Bet", "placeBet", "primary", [sel("side", "Side", ["Heads", "Tails"]), amt()])]);

const T_RED_ENVELOPE: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "Send GAS red envelopes to friends. Recipients claim a random share using Morpheus VRF — lucky, transparent, on-chain." },
        { type: "key_value", title: "Quick Facts", items: [{ key: "Asset", value: "GAS" }, { key: "Randomness", value: "VRF" }, { key: "Flow", value: "create → share link → recipients claim" }] },
        { type: "bullet_list", title: "How It Works", items: [
          "Create an envelope with a total amount and number of recipients.",
          "Share the envelope ID with your friends.",
          "Each claimer gets a random share until the envelope is empty.",
        ] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Claim Envelope", subtitle: "Enter an envelope ID to claim your random share.", cta_label: "Open Red Envelope", operations: [] },
  },
  operations: [op("Claim", "claim", "primary", [int("envelopeId", "Envelope ID", "1")])]
};

const T_GACHA: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "prizes", label: "How It Works", type: "content", blocks: [
        { type: "notice", tone: "info", content: "GASBox is a two-step gacha: you initiate a pull, then settle it after the VRF randomness arrives. Use the full app to pick a machine and draw." },
        { type: "key_value", title: "Quick Facts", items: [{ key: "Asset", value: "GAS" }, { key: "Randomness", value: "VRF" }, { key: "Flow", value: "initiate → settle" }] }
      ]},
      { id: "history", label: "Recent Drops", type: "content" }
    ],
    operation_panel: { title: "Draw", subtitle: "Pick a machine, pay the cost, and pull. Use the full app below for the two-step flow.", cta_label: "Open GASBox", operations: [] }
  },
  operations: []
};

const T_LAST_SURVIVOR = gaming(
  "Every contribution grows the jackpot and resets the countdown timer. Last buyer standing wins the pot.",
  [{ key: "Mode", value: "Countdown jackpot" }, { key: "Asset", value: "GAS" }],
  [
    "Each GAS transfer buys 1 key and resets the timer.",
    "First bid adds 60 min; each next bid adds slightly less, down to 1 min.",
    "When the timer hits zero, the last bidder wins the pot (minus platform fee).",
  ],
  []
);

const T_DAILY_CHECKIN: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "Check in daily, maintain your streak, and unlock GAS rewards plus NFT badges." },
        { type: "key_value", title: "Reward Schedule", items: [{ key: "Day 7", value: "1 GAS" }, { key: "Day 14", value: "2 GAS" }, { key: "Bonus", value: "Loyalty NFT badges" }] },
      ]},
      { id: "history", label: "History", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Check In", subtitle: "One tap per UTC day to maintain your streak.", cta_label: "Open Daily Check-in", operations: [] },
  },
  operations: [op("Check In", "checkIn"), op("Claim Rewards", "claimRewards", "secondary")],
};

const T_SELF_LOAN: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "info", content: "Lock NEO, borrow GAS up front, and let staking rewards repay the debt over time. Collateral can follow ProfitAnchor's best-profit vote signal while staying in SelfLoan custody." },
        { type: "key_value", title: "Loan Terms", items: [{ key: "Collateral", value: "NEO" }, { key: "Borrow Asset", value: "GAS" }, { key: "Risk", value: "No liquidation" }, { key: "Vote Signal", value: "ProfitAnchor" }] },
      ]},
      { id: "health", label: "Health", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Manage Loan", subtitle: "Repay debt or top up collateral on an existing loan.", cta_label: "Open SelfLoan", operations: [] },
  },
  operations: [
    op("Repay Loan", "repayLoan", "primary", [str("appId", "App ID", "miniapp-self-loan", true), int("loanId", "Loan ID", "1")]),
    op("Add Collateral", "addCollateral", "secondary", [str("appId", "App ID", "miniapp-self-loan", true), int("loanId", "Loan ID", "1")]),
    op("Sync Profit Vote", "syncProfitAnchorVote", "secondary", [str("appId", "App ID", "miniapp-self-loan", true)]),
  ],
};

const T_NEOPAY: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "info", content: "Recurring payrolls, subscriptions, memberships, and treasury releases with on-chain stream schedules." },
        { type: "key_value", title: "Use Cases", items: [{ key: "Payroll", value: "Monthly salaries" }, { key: "Subscription", value: "Auto-renewing memberships" }, { key: "Assets", value: "GAS / NEO" }] },
      ]},
      { id: "streams", label: "Streams", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Manage Streams", subtitle: "Claim from incoming streams or cancel ones you created.", cta_label: "Open NeoPay", operations: [] },
  },
  operations: [op("Claim Stream", "claimStream", "primary", [int("streamId", "Stream ID", "1")]), op("Cancel Stream", "cancelStream", "danger", [int("streamId", "Stream ID", "1")])],
};

const T_RECOVERY_GUARDIAN: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "warning", content: "Configure guardian-led AA recovery, issue private recovery tickets through Morpheus, and finalize ownership changes only after a visible timelock." },
        { type: "key_value", title: "Recovery Controls", items: [{ key: "Guardians", value: "Configurable verifier + backup policy" }, { key: "Evidence", value: "NeoDID recovery ticket" }, { key: "Safety", value: "Timelock before finalize" }] },
      ]},
      { id: "guardians", label: "Guardians", type: "content", blocks: [
        { type: "bullet_list", title: "Recommended Setup", items: ["Bind a recovery verifier.", "Set backup owner / threshold policy.", "Issue a recovery ticket only when needed.", "Finalize after review window expires."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Recovery Operations", subtitle: "Open the recovery workspace and manage guardian flows.", cta_label: "Open Recovery", operations: [] },
  },
  operations: [
    op("Open Guardian Setup", "openGuardianSetup", "primary"),
    op("Request Recovery Ticket", "requestRecoveryTicket", "secondary"),
    op("Finalize Recovery", "finalizeRecovery", "danger"),
  ],
};

const T_AUTOMATION_COPILOT: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "Create user-facing automation over price feeds, oracle callbacks, AA session execution, and delayed actions without embedding the scheduler inside the TEE." },
        { type: "key_value", title: "Automation Layers", items: [{ key: "Trigger", value: "Price / schedule / callback" }, { key: "Execute", value: "AA or oracle runtime" }, { key: "Priority", value: "Pricefeed remains isolated" }] },
      ]},
      { id: "recipes", label: "Recipes", type: "content", blocks: [
        { type: "bullet_list", title: "Starter Recipes", items: ["Price threshold alerts.", "Auto-repay loan positions.", "Scheduled treasury payouts.", "Conditional private compute jobs."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Automation Recipes", subtitle: "Select a trigger, execution surface, and fallback path.", cta_label: "Open Automation", operations: [] },
  },
  operations: [
    op("Price Alert", "createPriceAlert", "primary", [{ name: "pair", type: "string", label: "Pair", required: true, placeholder: "NEO-USD" }, { name: "target", type: "amount", label: "Target Price", required: true, placeholder: "20" }]),
    op("Schedule Runbook", "scheduleRunbook", "secondary", [{ name: "cron", type: "string", label: "Schedule", required: true, placeholder: "0 */6 * * *" }]),
    op("AA Auto-Action", "createAaAutomation", "secondary"),
  ],
};

const T_EVENT_TICKET_PASS: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "Issue event tickets, validate check-ins, and mint follow-up attendance credentials in one flow." },
        { type: "key_value", title: "Event Stack", items: [{ key: "Ticket", value: "NEP-11 pass" }, { key: "Check-in", value: "QR / operator scan" }, { key: "Badge", value: "Attendance credential" }] },
      ]},
      { id: "ops", label: "Operations", type: "content", blocks: [
        { type: "bullet_list", title: "Event Flow", items: ["Create event.", "Issue ticket batch.", "Scan / check in attendees.", "Grant post-event badge."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Ticket Operations", subtitle: "Manage issuance, attendee check-in, and follow-up badges.", cta_label: "Open Ticket Pass", operations: [] },
  },
  operations: [
    op("Create Event", "createEvent", "primary"),
    op("Issue Ticket", "issueTicket", "secondary", [{ name: "recipient", type: "address", label: "Recipient", required: true, placeholder: "N..." }]),
    op("Check In", "checkIn", "success"),
  ],
};

const T_QUADRATIC_FUNDING: AppTemplate = {
  detail_template: {
    layout: "prediction",
    hero: { eyebrow: "Grant Board", disclaimer: "Small donations can unlock larger public matching rounds." },
    tabs: [
      { id: "round", label: "Round", type: "content", blocks: [
        { type: "notice", tone: "info", content: "Run grant rounds with public matching pools, community signaling, and transparent payout logic." },
        { type: "key_value", title: "Round Design", items: [{ key: "Mechanism", value: "Quadratic matching" }, { key: "Signal", value: "Community grants" }, { key: "Payout", value: "On-chain distribution" }] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Fund A Project", subtitle: "Support a project or review the matching pool.", cta_label: "Open Grant Board", operations: [] },
  },
  operations: [
    op("Fund Project", "fundProject", "primary", [amt("amount", "Contribution", "5")]),
    op("Review Matching Pool", "reviewPool", "secondary"),
  ],
};

const T_TRUSTANCHOR: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "info", content: "Stake through AA agent vote routes while user NEO and reward GAS remain user-controlled. Admins manage agents and votes only." },
        { type: "key_value", title: "Trust Anchor Model", items: [{ key: "Mode", value: "Governance anchor pool" }, { key: "Asset", value: "NEO stake" }, { key: "Admin scope", value: "Vote routing only" }] },
      ]},
      { id: "governance", label: "Governance", type: "content", blocks: [
        { type: "bullet_list", title: "What It Adds", items: ["AA-generated agent vote identities.", "Shared governance visibility.", "Cleaner candidate operations.", "No admin transfer path for user stake or rewards."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Anchor Actions", subtitle: "Stake, review routing, and inspect governance posture.", cta_label: "Open Trust Anchor", operations: [] },
  },
  operations: [
    op("Stake NEO", "stake", "primary", [str("appId", "App ID", "miniapp-trustanchor", true), wallet(), int("amount", "Stake (NEO)", "10")]),
    op("Withdraw NEO", "withdraw", "secondary", [str("appId", "App ID", "miniapp-trustanchor", true), wallet(), int("amount", "NEO", "1")]),
    op("Withdraw Credit", "withdrawCredit", "secondary", [wallet(), str("asset", "Asset", "NEO", true), int("amount", "Amount", "1")]),
    op("Claim GAS", "claimRewards", "secondary", [str("appId", "App ID", "miniapp-trustanchor", true), wallet()]),
  ],
};

const T_PROFITANCHOR: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "ProfitAnchor routes pooled NEO votes to the highest recorded GAS-yield candidate while preserving the same user withdrawal and reward boundaries as TrustAnchor." },
        { type: "key_value", title: "Profit Anchor Model", items: [{ key: "Mode", value: "Highest-profit voting" }, { key: "Asset", value: "NEO stake" }, { key: "SelfLoan", value: "Best-candidate signal" }] },
      ]},
      { id: "profit", label: "Profit Routing", type: "content", blocks: [
        { type: "bullet_list", title: "Controls", items: ["Admins update candidate profit scores.", "Only the current best-profit agent can receive pooled ProfitAnchor votes.", "SelfLoan reads the best candidate and votes collateral from SelfLoan custody."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Profit Actions", subtitle: "Stake NEO, claim user-earned GAS, or sync the best-profit vote.", cta_label: "Open ProfitAnchor", operations: [] },
  },
  operations: [
    op("Stake NEO", "stake", "primary", [str("appId", "App ID", "miniapp-profitanchor", true), wallet(), int("amount", "Stake (NEO)", "10")]),
    op("Vote Best Candidate", "voteBestProfitCandidate", "secondary", [str("appId", "App ID", "miniapp-profitanchor", true)]),
    op("Withdraw NEO", "withdraw", "secondary", [str("appId", "App ID", "miniapp-profitanchor", true), wallet(), int("amount", "NEO", "1")]),
    op("Withdraw Credit", "withdrawCredit", "secondary", [wallet(), str("asset", "Asset", "NEO", true), int("amount", "Amount", "1")]),
    op("Claim GAS", "claimRewards", "secondary", [str("appId", "App ID", "miniapp-profitanchor", true), wallet()]),
  ],
};

const T_SOULBOUND_CERTIFICATE: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "Issue non-transferable credentials for memberships, attestations, certificates, and premium access passes." },
        { type: "key_value", title: "Credential Modes", items: [{ key: "Membership", value: "Subscription or community access" }, { key: "Proof", value: "Credential / completion / badge" }, { key: "Transferability", value: "Soulbound" }] },
      ]},
      { id: "membership", label: "Membership", type: "content", blocks: [
        { type: "bullet_list", title: "Typical Uses", items: ["Creator memberships.", "Event attendance badges.", "Course or training certificates.", "DAO role credentials."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Credential Actions", subtitle: "Issue or verify a non-transferable credential.", cta_label: "Open Certificate", operations: [] },
  },
  operations: [
    op("Issue Certificate", "issueCertificate", "primary", [{ name: "recipient", type: "address", label: "Recipient", required: true, placeholder: "N..." }]),
    op("Verify Holder", "verifyHolder", "secondary"),
  ],
};

const T_UNBREAKABLE_VAULT: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "warning", content: "Seal high-value claims, secrets, or files behind delayed release and optional proof workflows." },
        { type: "key_value", title: "Vault Surface", items: [{ key: "Storage", value: "Delayed / sealed" }, { key: "Proof", value: "Hash + claim workflow" }, { key: "Use Case", value: "Private proof box / sealed vault" }] },
      ]},
      { id: "proofs", label: "Proof Flow", type: "content", blocks: [
        { type: "bullet_list", title: "Suggested Flow", items: ["Seal a payload or claim.", "Store proof hash / metadata.", "Reveal or verify later.", "Keep audit trail on-chain."] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Vault Actions", subtitle: "Create a vault, verify a claim, or publish a reveal.", cta_label: "Open Vault", operations: [] },
  },
  operations: [
    op("Create Vault", "createVault", "primary"),
    op("Verify Proof", "verifyProof", "secondary", [{ name: "proofHash", type: "hash256", label: "Proof Hash", required: true, placeholder: "0x..." }]),
  ],
};

const T_SECRET_VOTE: AppTemplate = {
  detail_template: {
    layout: "prediction",
    hero: { eyebrow: "Private Vote", disclaimer: "Voter eligibility can be NeoDID-gated while ballot content stays opaque until reveal or tally." },
    tabs: [
      { id: "proposal", label: "Proposal", type: "content", blocks: [
        { type: "notice", tone: "info", content: "Run private or semi-private ballots with identity gating, clear proposal context, and controlled tally windows." },
        { type: "key_value", title: "Ballot Model", items: [{ key: "Eligibility", value: "NeoDID / credential-gated" }, { key: "Privacy", value: "Private ballot path" }, { key: "Tally", value: "Reveal or controlled result flow" }] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Vote Privately", subtitle: "Prepare a confidential vote or inspect the ballot state.", cta_label: "Open Secret Vote", operations: [] },
  },
  operations: [
    op("Cast Private Vote", "castPrivateVote", "primary"),
    op("Reveal / Finalize", "finalizeVote", "secondary"),
  ],
};


export const MINIAPP_TEMPLATES: Record<string, AppTemplate> = {
  "miniapp-fogplay": T_COINFLIP,
  "miniapp-dailycheckin": T_DAILY_CHECKIN,
  "miniapp-last-survivor": T_LAST_SURVIVOR,
  "miniapp-gasbox": T_GACHA,
  "miniapp-redenvelope": T_RED_ENVELOPE,
  "miniapp-self-loan": T_SELF_LOAN,
  "miniapp-profitanchor": T_PROFITANCHOR,
  "miniapp-neo-pay": T_NEOPAY,
  "miniapp-recovery-guardian": T_RECOVERY_GUARDIAN,
  "miniapp-automation-copilot": T_AUTOMATION_COPILOT,
  "miniapp-event-ticket-pass": T_EVENT_TICKET_PASS,
  "miniapp-quadratic-funding": T_QUADRATIC_FUNDING,
  "miniapp-trustanchor": T_TRUSTANCHOR,
  "miniapp-soulbound-certificate": T_SOULBOUND_CERTIFICATE,
  "miniapp-unbreakablevault": T_UNBREAKABLE_VAULT,
  "miniapp-secret-vote": T_SECRET_VOTE,
};
