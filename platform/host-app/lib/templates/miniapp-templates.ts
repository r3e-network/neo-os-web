import type { MiniAppDetailTemplate, OperationEntry, OperationParam } from "@/components/types";

type AppTemplate = { detail_template: MiniAppDetailTemplate; operations: OperationEntry[] };
type KV = { key: string; value: string };

const amt = (name = "amount", label = "Amount (GAS)", ph = "1"): OperationParam => ({ name, type: "amount", label, required: true, placeholder: ph });
const sel = (name: string, label: string, opts: string[]): OperationParam => ({ name, type: "select", label, required: true, options: opts.map(o => ({ label: o, value: o.toLowerCase().replace(/\s+/g, "_") })) });
const int = (name: string, label: string, ph = ""): OperationParam => ({ name, type: "integer", label, required: true, placeholder: ph });

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
      operation_panel: { title: "Play", subtitle: "Configure game parameters and start playing.", cta_label: "Launch Game", operations: [] },
    },
    operations: ops,
  };
}

const T_LOTTERY = gaming("Experience the thrill of provably fair lottery draws.", [{ key: "Randomness", value: "VRF" }], ["Buy tickets.", "Wait for the draw.", "Claim your prize."], [op("Buy Tickets", "buyTicket", "primary", [int("tickets", "Number of Tickets", "1")])]);
const T_COINFLIP = gaming("Classic 50/50 coin flip.", [{ key: "Randomness", value: "VRF" }], ["Choose Heads or Tails.", "Set your wager.", "Flip and win double."], [op("Flip", "flip", "primary", [sel("side", "Side", ["Heads", "Tails"]), amt()])]);
const T_DICE = gaming("Roll the dice and test your luck.", [{ key: "Randomness", value: "VRF" }], ["Choose your winning range.", "Place your bet.", "Watch the VRF-powered dice."], [op("Roll", "roll", "primary", [int("range", "Range (1-100)", "50"), amt()])]);

const T_PREDICTION: AppTemplate = {
  detail_template: {
    layout: "prediction",
    hero: { eyebrow: "Prediction Market", disclaimer: "Probabilities are market-implied." },
    tabs: [{ id: "market-info", label: "Market Info", type: "content" }, { id: "reviews", label: "Reviews", type: "reviews" }],
    operation_panel: { title: "Trade Position", subtitle: "Choose side, set amount, submit on-chain.", cta_label: "Open Full Experience", operations: [] }
  },
  operations: [op("Buy YES", "buyYes", "success", [amt()]), op("Buy NO", "buyNo", "danger", [amt()])]
};

const T_AIRDROP: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "overview", label: "Overview", type: "content", blocks: [
        { type: "notice", tone: "success", content: "Claim Multi-Chain Tokens & NFTs directly to your wallet." },
        { type: "key_value", title: "Eligibility", items: [{ key: "Status", value: "Active" }, { key: "Network", value: "Neo N3 & Neo X" }] },
      ]},
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Claim", subtitle: "Check eligibility and claim tokens.", cta_label: "Connect to Claim", operations: [] },
  },
  operations: [op("Claim Tokens", "claim", "primary", [])]
};

const T_DAO: AppTemplate = {
  detail_template: {
    layout: "prediction", // Reuse prediction layout for split view
    hero: { eyebrow: "Governance", disclaimer: "1 Token = 1 Vote" },
    tabs: [
      { id: "proposal", label: "Proposal Info", type: "content", blocks: [
        { type: "markdown", title: "Summary", content: "Should we allocate 1,000 GAS to the community developer fund?" }
      ]},
      { id: "votes", label: "Votes", type: "content" }
    ],
    operation_panel: { title: "Cast Vote", subtitle: "Voting power is determined by snapshot.", cta_label: "Vote Now", operations: [] }
  },
  operations: [op("Vote FOR", "voteFor", "success", []), op("Vote AGAINST", "voteAgainst", "danger", []), op("Abstain", "abstain", "secondary", [])]
};

const T_GACHA: AppTemplate = {
  detail_template: {
    layout: "default",
    tabs: [
      { id: "prizes", label: "Prize Pool", type: "content", blocks: [
        { type: "key_value", title: "Drop Rates", items: [{ key: "Legendary NFT", value: "1%" }, { key: "100 GAS", value: "5%" }, { key: "Common Item", value: "94%" }] }
      ]},
      { id: "history", label: "Recent Drops", type: "content" }
    ],
    operation_panel: { title: "Draw", subtitle: "Open blind boxes to win on-chain prizes.", cta_label: "Open Gacha", operations: [] }
  },
  operations: [op("Draw x1", "drawOne", "primary", [amt("fee", "Cost", "1.0")]), op("Draw x10", "drawTen", "primary", [amt("fee", "Cost", "10.0")])]
};

const T_LAST_SURVIVOR = gaming(
  "Every contribution grows the jackpot and resets the 24-hour timer. Last buyer standing wins the pot.",
  [{ key: "Mode", value: "Countdown jackpot" }],
  ["Buy keys to reset the timer.", "Track the live countdown and pot size.", "Be the last buyer before expiry to win everything."],
  [op("Buy Keys", "buyKeys", "primary", [int("keyCount", "Key Count", "1")])]
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
        { type: "notice", tone: "info", content: "Lock NEO, borrow GAS up front, and let staking rewards repay the debt over time." },
        { type: "key_value", title: "Loan Terms", items: [{ key: "Collateral", value: "NEO" }, { key: "Borrow Asset", value: "GAS" }, { key: "Risk", value: "No liquidation" }] },
      ]},
      { id: "health", label: "Health", type: "content" },
      { id: "reviews", label: "Reviews", type: "reviews" }
    ],
    operation_panel: { title: "Open Loan", subtitle: "Choose your NEO collateral and borrow against future yield.", cta_label: "Start SelfLoan", operations: [] },
  },
  operations: [op("Create Loan", "createLoan", "primary", [int("neoAmount", "Collateral (NEO)", "10")]), op("Repay", "repay", "secondary", [amt()])],
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
    operation_panel: { title: "Create Stream", subtitle: "Configure amount, cadence, and beneficiary.", cta_label: "Open NeoPay", operations: [] },
  },
  operations: [op("Create Stream", "createStream", "primary", [amt("totalAmount", "Total Amount", "100"), sel("schedule", "Schedule", ["Monthly", "Weekly"]), int("installments", "Installments", "12")])],
};


export const MINIAPP_TEMPLATES: Record<string, AppTemplate> = {
  "miniapp-fogplay": T_COINFLIP,
  "miniapp-dailycheckin": T_DAILY_CHECKIN,
  "miniapp-last-survivor": T_LAST_SURVIVOR,
  "miniapp-gasbox": T_GACHA,
  "miniapp-redenvelope": T_AIRDROP,
  "miniapp-self-loan": T_SELF_LOAN,
  "miniapp-neo-pay": T_NEOPAY,
};
