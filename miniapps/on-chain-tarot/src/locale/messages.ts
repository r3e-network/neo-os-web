import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    // App translations
title: { en: "On-Chain Tarot", zh: "链上塔罗" },
  subtitle: { en: "Blockchain-powered divination", zh: "区块链占卜" },
  drawYourCards: { en: "Draw Your Cards", zh: "抽取您的牌" },
  drawCards: { en: "Draw 3 Cards (0.05 GAS)", zh: "抽取 3 张牌 (0.05 GAS)" },
  drawing: { en: "Drawing...", zh: "抽取中..." },
  drawAgain: { en: "Draw Again", zh: "再次抽取" },
  questionPlaceholder: { en: "Ask a question...", zh: "输入你的问题..." },
  defaultQuestion: { en: "tarot", zh: "塔罗" },
  yourReading: { en: "Your Reading", zh: "您的解读" },
  cardsDrawn: { en: "Cards drawn!", zh: "牌已抽取！" },
  drawingCards: { en: "Drawing cards...", zh: "正在抽取牌..." },
  past: { en: "Past", zh: "过去" },
  present: { en: "Present", zh: "现在" },
  future: { en: "Future", zh: "未来" },
  readingText: {
    en: "A three-card reading drawn on-chain for transparency.",
    zh: "链上抽取的三张牌解读。",
  },
  connectWallet: { en: "Connect wallet", zh: "请连接钱包" },
  readingPending: { en: "Reading pending", zh: "解读确认中" },
  cardsDrawnCount: { en: "Cards Drawn", zh: "抽取卡牌数" },
  totalSpent: { en: "Total Spent", zh: "总花费" },

  docSubtitle: {
    en: "Blockchain-verified tarot readings with verifiable randomness",
    zh: "区块链验证的塔罗牌解读，具有可验证随机性",
  },
  docDescription: {
    en: "On-Chain Tarot provides mystical three-card readings powered by blockchain randomness. Ask your question, pay a small fee, and receive Past-Present-Future cards drawn through verifiable on-chain oracles.",
    zh: "链上塔罗提供由区块链随机性驱动的神秘三牌解读。提出问题，支付少量费用，通过可验证的链上预言机获得过去-现在-未来的牌。",
  },
  step1: { en: "Connect your wallet and enter your question.", zh: "连接钱包并输入你的问题。" },
  step2: { en: "Pay 0.05 GAS to request an on-chain reading.", zh: "支付 0.05 GAS 请求链上解读。" },
  step3: { en: "Wait for the oracle to generate your cards.", zh: "等待预言机生成你的牌。" },
  step4: { en: "Flip each card to reveal your Past, Present, and Future.", zh: "翻转每张牌揭示你的过去、现在和未来。" },
  feature1Name: { en: "Verifiable Randomness", zh: "可验证随机性" },
  feature1Desc: {
    en: "Cards are drawn using on-chain VRF for provably fair results.",
    zh: "使用链上 VRF 抽取卡牌，确保可证明的公平结果。",
  },
  feature2Name: { en: "78-Card Deck", zh: "78 张牌组" },
  feature2Desc: {
    en: "Full Major and Minor Arcana for authentic tarot readings.",
    zh: "完整的大阿卡纳和小阿卡纳，提供真实的塔罗解读。",
  },
  feature3Name: { en: "Reading History", zh: "解读记录" },
  feature3Desc: {
    en: "Past readings are stored on-chain for reference.",
    zh: "历史解读记录上链可查。",
  },
  wrongChain: { en: "Wrong Chain", zh: "链错误" },
  wrongChainMessage: {
    en: "This app requires Neo N3. Please switch networks.",
    zh: "此应用需要 Neo N3 网络，请切换网络。",
  },
  readings: { en: "Readings", zh: "解读次数" },
  allRevealed: { en: "All Revealed", zh: "全部揭示" },
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
} as const;

export const messages = mergeMessages(appMessages);
