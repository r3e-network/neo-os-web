import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  appEyebrow: { en: "Neo Tarot", zh: "Neo 塔罗" },
  appSubtitle: {
    en: "Ask a question, draw three Neo-styled cards, and reveal the spread on-chain.",
    zh: "提出问题，抽取三张 Neo 风格塔罗牌，并在链上揭示牌阵。",
  },
  title: { en: "On-Chain Tarot", zh: "链上塔罗" },
  subtitle: { en: "Blockchain-powered divination", zh: "区块链占卜" },
  drawYourCards: { en: "Draw the spread", zh: "抽取牌阵" },
  drawAction: { en: "Draw cards", zh: "抽牌" },
  newReading: { en: "New reading", zh: "新的读牌" },
  drawCards: { en: "Draw 3 Cards", zh: "抽取 3 张牌" },
  drawValueHint: {
    en: "Pay 0.1 GAS to draw your Past · Present · Future cards on-chain.",
    zh: "支付 0.1 GAS，在链上抽出你的过去 · 现在 · 未来三张牌。",
  },
  drawing: { en: "Drawing...", zh: "抽取中..." },
  drawAgain: { en: "Draw Again", zh: "再次抽取" },
  questionLabel: { en: "Your question", zh: "你的问题" },
  questionPlaceholder: {
    en: "Type a focused question, or pick an intent above.",
    zh: "输入一个明确问题，或选择上方意图。",
  },
  questionPresetClarity: {
    en: "What needs clarity right now?",
    zh: "现在最需要看清什么？",
  },
  questionPresetDecision: {
    en: "Which path should I choose?",
    zh: "我该选择哪条路径？",
  },
  questionPresetMomentum: {
    en: "Where is momentum building?",
    zh: "势能正在哪里聚集？",
  },
  intentClarityLabel: { en: "Clarity", zh: "看清" },
  intentDecisionLabel: { en: "Decision", zh: "选择" },
  intentMomentumLabel: { en: "Momentum", zh: "势能" },
  defaultQuestion: { en: "tarot", zh: "塔罗" },
  yourReading: { en: "Your Reading", zh: "您的解读" },
  readingSummary: { en: "Your Reading", zh: "您的解读" },
  cardsDrawn: { en: "Cards drawn!", zh: "牌已抽取！" },
  drawingCards: { en: "Drawing cards...", zh: "正在抽取牌..." },
  dealingCards: { en: "Dealing the spread...", zh: "正在发牌..." },
  flipCard: { en: "Flip card", zh: "翻开卡牌" },
  revealAllCards: { en: "Reveal cards", zh: "揭示卡牌" },
  tapToReveal: { en: "Tap to reveal", zh: "点击揭示" },
  past: { en: "Past", zh: "过去" },
  present: { en: "Present", zh: "现在" },
  future: { en: "Future", zh: "未来" },
  readingText: {
    en: "A three-card reading drawn on-chain for transparency.",
    zh: "链上抽取的三张牌解读。",
  },
  readingPending: { en: "Reading pending", zh: "解读确认中" },
  readingUnavailable: {
    en: "On-chain reading is not available yet",
    zh: "链上解读暂不可用",
  },
  walletNotConnected: {
    en: "Connect your wallet to draw",
    zh: "请连接钱包以抽牌",
  },
  depositPrepaidNoReading: {
    en: "Draw fee prepaid, but the reading did not complete. The credit is held on the contract and will be reused on your next draw.",
    zh: "抽牌费用已预付，但解读未完成。该额度已保存在合约中，将在你下次抽牌时复用。",
  },
  cardsDrawnCount: { en: "Cards Drawn", zh: "抽取卡牌数" },
  totalSpent: { en: "Total Spent", zh: "总花费" },
  oracleVerified: {
    en: "The three cards are drawn on-chain by the contract using Neo N3's Runtime.GetRandom and stored on-chain, so the reading is authoritative and auditable from the ReadingDrawn event.",
    zh: "三张牌由合约在链上使用 Neo N3 的 Runtime.GetRandom 抽取并上链存储，因此该解读具权威性，可凭 ReadingDrawn 事件审计。",
  },
  fairnessTitle: { en: "On-chain draw proof", zh: "链上抽牌证明" },
  fairnessCopy: {
    en: "The wallet pays the draw fee, then the contract draws three distinct cards using Neo N3 randomness and emits the reading event for audit.",
    zh: "钱包支付抽牌费用后，合约使用 Neo N3 随机数抽取三张不同卡牌，并发出读牌事件以供审计。",
  },
  tarotHeroTitle: { en: "On-Chain Tarot Reading Desk", zh: "链上塔罗读牌台" },
  tarotHeroSubtitle: {
    en: "Draw three Neo tarot cards on-chain, then reveal Past, Present, and Future.",
    zh: "链上抽取三张 Neo 塔罗牌，然后揭示过去、现在与未来。",
  },
  tarotStageAlt: {
    en: "Three Neo tarot cards arranged on a bright reading table.",
    zh: "三张 Neo 塔罗牌摆放在明亮读牌桌上。",
  },
  dealTableLabel: { en: "Reading table", zh: "读牌桌" },
  dealTableReady: {
    en: "Past, Present, Future ready",
    zh: "过去、现在、未来已就位",
  },
  oracleRequestTitle: {
    en: "Neo N3 share-ready reading",
    zh: "Neo N3 可分享读牌",
  },
  readingFlowTitle: { en: "Reading flow", zh: "读牌流程" },
  readingStepOne: { en: "Write the question", zh: "写下问题" },
  readingStepOneShort: { en: "Ask", zh: "提问" },
  readingStepOneCopy: {
    en: "The prompt is capped at 200 characters and kept on your device — it is not stored on-chain.",
    zh: "问题限制为 200 个字符，仅保存在你的设备上，不会上链存储。",
  },
  readingStepTwo: { en: "Pay the draw fee", zh: "支付抽牌费用" },
  readingStepTwoShort: { en: "Pay", zh: "付款" },
  readingStepTwoCopy: {
    en: "You pay the on-chain draw fee in GAS to the contract; it credits your draw balance, then the contract draws your three cards in the same transaction.",
    zh: "你向合约支付链上 GAS 抽牌费用；费用记入你的抽牌额度，随后合约在同一笔交易中抽出你的三张牌。",
  },
  readingStepThree: { en: "Reveal the spread", zh: "揭示牌阵" },
  readingStepThreeShort: { en: "Reveal", zh: "揭示" },
  readingStepThreeCopy: {
    en: "Each card stays sealed until the recipient taps Past, Present, and Future.",
    zh: "每张牌在用户点击过去、现在、未来前保持封存。",
  },
  oraclePromptLabel: { en: "Question prompt", zh: "问题提示" },
  readingIntentTitle: { en: "Reading intent", zh: "读牌意图" },
  readingIntentCopy: {
    en: "Choose a quick intent or write one focused question. The prompt stays local; only the draw and card ids are handled on-chain.",
    zh: "选择快捷意图或写下一个明确问题。问题保留在本地；链上只处理抽牌和卡牌编号。",
  },
  moreActions: { en: "More actions", zh: "更多操作" },
  drawerSummaryLabel: { en: "Tarot reading summary", zh: "塔罗读牌摘要" },
  refreshReadingState: { en: "Refresh state", zh: "刷新状态" },
  currentSpreadTitle: { en: "Current spread", zh: "当前牌阵" },
  sealedReadingHint: { en: "Tap the card to reveal.", zh: "点击卡牌揭示。" },
  readerWalletLabel: { en: "Wallet", zh: "钱包" },
  readerWalletMissing: { en: "Not connected", zh: "未连接" },
  intentionDeckLabel: { en: "Intention deck", zh: "意图牌组" },
  questionPreviewLabel: { en: "Focus", zh: "聚焦" },
  questionPreviewFallback: {
    en: "Set the tone for this spread.",
    zh: "为这次牌阵设定主题。",
  },
  // ── In-canvas tarot table strings (fed to the Phaser scene) ─────────────
  sceneChooseIntent: { en: "Choose an intent", zh: "选择意图" },
  sceneTapToReveal: { en: "Tap cards to reveal", zh: "点击卡牌揭示" },
  sceneHeaderTagline: {
    en: "Neo N3 · 0.1 GAS verified draw",
    zh: "Neo N3 · 0.1 GAS 链上抽牌",
  },
  sceneIdleStatus: {
    en: "Pick an intent, then draw three cards on-chain.",
    zh: "选择意图，然后在链上抽取三张牌。",
  },
  sceneDrawingStatus: {
    en: "Wallet confirms the draw, then the contract seals the spread.",
    zh: "钱包确认抽牌后，合约封存牌阵。",
  },
  sceneRevealedStatus: {
    en: "All three cards are revealed from the contract reading.",
    zh: "三张牌均已从合约读牌中揭示。",
  },
  sceneRevealCount: {
    en: "{revealed} / 3 revealed",
    zh: "已揭示 {revealed} / 3",
  },
  tapToDraw: { en: "Tap to draw", zh: "点击抽牌" },
  oracleLaneLabel: { en: "Oracle draw lane", zh: "预言抽牌轨道" },
  oracleLaneIntent: { en: "Intent", zh: "意图" },
  oracleLaneDraw: { en: "Draw", zh: "抽牌" },
  oracleLaneReveal: { en: "Reveal", zh: "揭示" },
  questionCharacterCount: {
    en: "{count}/{max} characters",
    zh: "{count}/{max} 字",
  },
  quickIntentLabel: { en: "Quick reading intents", zh: "快捷读牌意图" },
  requestReady: { en: "Ready", zh: "就绪" },
  awaitingCards: { en: "Awaiting draw", zh: "等待抽牌" },
  awaitingDraw: { en: "Awaiting draw", zh: "等待抽牌" },
  notDrawnYet: { en: "Not drawn yet", zh: "尚未抽取" },
  submitQuestionFirst: { en: "Submit a question first", zh: "先提交问题" },
  hiddenCard: { en: "Sealed card", zh: "封存卡牌" },
  oracleSealed: { en: "Sealed", zh: "封存" },
  revealProgress: { en: "Revealed", zh: "已揭示" },
  verificationPanelTitle: { en: "Transaction safety", zh: "交易安全" },
  verificationPanelCopy: {
    en: "The miniapp talks directly to the on-chain tarot contract through the wallet. Every draw is a wallet-reviewed GAS transfer plus a draw call — no silent raw transaction is built inside the play area.",
    zh: "小程序通过钱包直接与链上塔罗合约交互。每次抽牌都是经钱包确认的 GAS 转账加一次抽牌调用，不会在 play area 内静默构造原始交易。",
  },
  verificationPointFee: {
    en: "0.1 GAS draw fee is shown in the wallet before you approve.",
    zh: "0.1 GAS 抽牌费用会在你确认前显示在钱包中。",
  },
  verificationPointRandom: {
    en: "Cards are picked on-chain via Runtime.GetRandom — not by this app.",
    zh: "卡牌由链上 Runtime.GetRandom 抽取，而非本应用。",
  },
  verificationPointWallet: {
    en: "The result is recorded in the ReadingDrawn event for auditing.",
    zh: "结果记录在 ReadingDrawn 事件中以供审计。",
  },
  contractRouteLabel: { en: "Contract route", zh: "合约路径" },
  tarotContractRoute: { en: "transfer -> draw()", zh: "transfer -> draw()" },
  feeLabel: { en: "Draw fee", zh: "抽牌费用" },
  tarotFee: { en: "0.1 GAS on-chain", zh: "0.1 GAS（链上）" },
  readingStateLabel: { en: "Reading state", zh: "读牌状态" },
  revealed: { en: "revealed", zh: "已揭示" },
  oracleVerifiedShort: { en: "On-chain verified", zh: "链上已验证" },
  oraclePendingShort: { en: "Waiting", zh: "等待中" },
  deckPanelTitle: { en: "Neo tarot deck", zh: "Neo 塔罗牌组" },
  spreadPanelTitle: { en: "Three-card spread", zh: "三张牌阵" },
  neoDeck: { en: "Neo Oracle Deck", zh: "Neo 预言机牌组" },
  fullDeck: { en: "78 Neo-styled tarot cards", zh: "78 张 Neo 风格塔罗牌" },
  deckHint: {
    en: "Major and Minor Arcana are rendered as a full Neo deck with shield marks, oracle circuitry, and verifiable reading motifs.",
    zh: "完整大阿卡纳和小阿卡纳，牌背与牌面融合 Neo 盾牌、预言机线路和可验证抽牌风格。",
  },
  cardBackAlt: { en: "Neo Tarot card back", zh: "Neo 塔罗牌背" },
  cardImageAlt: { en: "{name} tarot card", zh: "{name} 塔罗牌" },

  docSubtitle: {
    en: "Three-card readings drawn on-chain by the contract, stored on-chain and auditable",
    zh: "由合约在链上抽取、上链存储且可审计的三牌解读",
  },
  docDescription: {
    en: "On-Chain Tarot provides mystical three-card readings drawn on-chain. Ask your question, pay a 0.1 GAS draw fee to the contract, and the contract picks three distinct Past-Present-Future cards using Neo N3's Runtime.GetRandom in the same transaction, so the reading is authoritative and auditable from the ReadingDrawn event.",
    zh: "链上塔罗提供在链上抽取的神秘三牌解读。提出问题，向合约支付 0.1 GAS 抽牌费用，合约即在同一笔交易中使用 Neo N3 的 Runtime.GetRandom 抽出三张不同的过去-现在-未来牌，解读具权威性，可凭 ReadingDrawn 事件审计。",
  },
  step1: {
    en: "Connect your wallet and enter your question.",
    zh: "连接钱包并输入你的问题。",
  },
  step2: {
    en: "Pay the 0.1 GAS draw fee to the contract.",
    zh: "向合约支付 0.1 GAS 抽牌费用。",
  },
  step3: {
    en: "The contract draws your three cards on-chain in the same transaction.",
    zh: "合约在同一笔交易中于链上抽出你的三张牌。",
  },
  step4: {
    en: "Flip each card to reveal your Past, Present, and Future.",
    zh: "翻转每张牌揭示你的过去、现在和未来。",
  },
  feature1Name: { en: "On-Chain Draw", zh: "链上抽牌" },
  feature1Desc: {
    en: "Cards are drawn on-chain by the contract using Neo N3's Runtime.GetRandom, so anyone can audit the reading from the ReadingDrawn event.",
    zh: "卡牌由合约在链上使用 Neo N3 的 Runtime.GetRandom 抽取，任何人都可凭 ReadingDrawn 事件审计该解读。",
  },
  feature2Name: { en: "78-Card Deck", zh: "78 张牌组" },
  feature2Desc: {
    en: "Full Major and Minor Arcana for authentic tarot readings.",
    zh: "完整的大阿卡纳和小阿卡纳，提供真实的塔罗解读。",
  },
  feature3Name: { en: "Reading History", zh: "解读记录" },
  feature3Desc: {
    en: "Past readings are stored on-chain and can be replayed via getReading.",
    zh: "历史解读记录上链存储，可通过 getReading 复现。",
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
  neoTarot: { en: "NEO TAROT", zh: "NEO 塔罗" },
  blockLabel: { en: "Block:", zh: "区块:" },
  tarotPage: { en: "Page", zh: "侍卫" },
  tarotKnight: { en: "Knight", zh: "骑士" },
  tarotQueen: { en: "Queen", zh: "女王" },
  tarotKing: { en: "King", zh: "国王" },
  copyReading: { en: "Copy reading", zh: "复制解读" },
  readingCopied: { en: "Reading copied", zh: "解读已复制" },
  // ── Exit path (withdraw unused prepaid draw-credit) ────────────────────
  prepaidCreditLabel: { en: "Prepaid credit", zh: "预付额度" },
  prepaidCreditHint: {
    en: "Unused GAS from a draw fee that didn't complete. Reused on your next draw, or withdraw it now.",
    zh: "未完成的抽牌费用所剩的 GAS。下次抽牌会复用，也可立即提取。",
  },
  withdrawCredit: { en: "Withdraw credit", zh: "提取额度" },
  creditWithdrawn: {
    en: "Withdrew {amount} {tokenGas} prepaid credit",
    zh: "已提取预付额度 {amount} {tokenGas}",
  },
  noCredit: { en: "No prepaid credit to withdraw", zh: "没有可提取的预付额度" },
  tokenGas: { en: "GAS", zh: "GAS" },

  // ── Guest (free / local) mode copy ─────────────────────────────────────────
  // Guest is a purely local tarot reading — no fee, no wallet, no chain. These
  // strings reframe every GAS-at-stake / draw-fee label for local play. The
  // gamefi copy above is unchanged.
  guestBadge: { en: "Local reading", zh: "本地读牌" },
  guestSubtitle: {
    en: "Ask a question, draw three Neo-styled cards, and reveal the spread — free, on this device.",
    zh: "提出问题，抽取三张 Neo 风格塔罗牌，并揭示牌阵——本地免费。",
  },
  guestDrawnBadge: { en: "Drawn locally", zh: "本地抽取" },
  guestRevealed: { en: "Reading revealed", zh: "读牌已揭示" },
  guestDrawHint: {
    en: "Draw your Past · Present · Future cards — free, on this device.",
    zh: "抽取你的过去 · 现在 · 未来三张牌——本地免费。",
  },
  guestSceneTagline: {
    en: "Local draw · secure device shuffle",
    zh: "本地抽牌 · 设备安全洗牌",
  },
  guestSceneIdleStatus: {
    en: "Pick an intent, then draw three cards locally.",
    zh: "选择意图，然后在本地抽取三张牌。",
  },
  guestSceneDrawingStatus: {
    en: "Shuffling the deck for your spread.",
    zh: "正在为你的牌阵洗牌。",
  },
  guestSceneRevealedStatus: {
    en: "All three cards from your local spread are revealed.",
    zh: "本地牌阵的三张牌均已揭示。",
  },
  guestReadingIntentCopy: {
    en: "Choose a quick intent or write one focused question. Everything stays on your device — a free local reading.",
    zh: "选择快捷意图或写下一个明确问题。一切都保留在你的设备上——免费的本地读牌。",
  },
  guestVerificationTitle: { en: "Local reading", zh: "本地读牌" },
  guestVerificationPointOne: {
    en: "No fee — this is a free local reading.",
    zh: "无需费用——这是免费的本地读牌。",
  },
  guestVerificationPointTwo: {
    en: "Cards are shuffled on your device with a secure random generator.",
    zh: "卡牌在你的设备上使用安全随机数生成器洗牌。",
  },
  guestVerificationPointThree: {
    en: "Nothing is sent on-chain in guest mode.",
    zh: "游客模式下不会向链上发送任何内容。",
  },
  guestFairnessCopy: {
    en: "Guest mode shuffles the deck locally with your device's secure random generator and deals three distinct cards — no wallet, no fee, no chain.",
    zh: "游客模式使用你设备的安全随机数生成器在本地洗牌，并发出三张不同的卡牌——无需钱包、无需费用、不上链。",
  },
  guestRouteLabel: { en: "Draw path", zh: "抽牌路径" },
  guestContractRoute: { en: "local shuffle -> deal", zh: "本地洗牌 -> 发牌" },
  guestStepTwoShort: { en: "Draw", zh: "抽牌" },
  guestStepTwoCopy: {
    en: "Tap the deck to shuffle and deal three cards instantly — no payment.",
    zh: "点击牌组即可洗牌并立即发出三张牌——无需付款。",
  },
} as const;

export const messages = mergeMessages(appMessages);
