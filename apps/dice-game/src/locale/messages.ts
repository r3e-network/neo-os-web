import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  rollTab: { en: "Roll", zh: "掷骰" },
  rulesTab: { en: "Rules", zh: "规则" },
  rollSummary: { en: "Roll summary", zh: "掷骰摘要" },
  selectedFace: { en: "Face", zh: "点数" },
  stakeAmount: { en: "Stake", zh: "下注" },
  payoutPreview: { en: "Win payout", zh: "中奖赔付" },
  rollDice: { en: "Roll Dice", zh: "掷骰" },
  rollDescription: {
    en: "Choose one face and stake GAS. A matching VRF roll pays 5.70x.",
    zh: "选择 1-6 的点数并下注 GAS，VRF 命中后按 5.70 倍赔付。",
  },
  rollAction: { en: "Roll with VRF", zh: "用 VRF 掷骰" },
  howItWorks: { en: "How it works", zh: "如何运行" },
  safetyModel: { en: "Safety model", zh: "安全模型" },
  docHowItWorks: {
    en: "1. Connect OneGate. 2. Choose a face from 1 to 6. 3. Submit a GAS-backed roll. 4. Morpheus VRF settles the result on-chain.",
    zh: "1. 连接 OneGate。2. 选择 1-6 的点数。3. 提交带 GAS 筹码的掷骰。4. Morpheus VRF 在链上结算结果。",
  },
  docSafetyModel: {
    en: "The contract stores the player, stake, chosen face and oracle request id before settlement. Only the configured oracle can resolve or refund a pending roll.",
    zh: "合约会先保存玩家、下注额、选择点数和 oracle request id。只有配置的预言机可以结算或退款待处理掷骰。",
  },
  readyTitle: { en: "Choose a face and roll", zh: "选一个点数，然后掷骰" },
  readyBody: {
    en: "The result is settled by Morpheus VRF. The play area stays focused on the roll; the action box holds the transaction.",
    zh: "结果由 Morpheus VRF 结算。中间区域只展示游戏状态，真正的交易动作放在右侧操作框。",
  },
  pendingTitle: { en: "VRF request submitted", zh: "VRF 请求已提交" },
  pendingBody: {
    en: "Your roll is now waiting for the oracle callback. Keep this page open to watch the status.",
    zh: "掷骰已经提交，正在等待预言机回调。保持页面打开即可观察状态。",
  },
  lastTx: { en: "Transaction", zh: "交易" },
  oddsLabel: { en: "Chance", zh: "胜率" },
  feeLabel: { en: "Platform fee", zh: "平台费" },
  rangeLabel: { en: "Stake range", zh: "下注范围" },
  statusReady: { en: "Ready", zh: "就绪" },
  statusSubmitting: { en: "Submitting roll...", zh: "正在提交掷骰..." },
  statusSubmitted: { en: "Roll submitted", zh: "掷骰已提交" },
  statusFailed: { en: "Roll failed", zh: "掷骰失败" },
} as const;

export const messages = mergeMessages(appMessages);
