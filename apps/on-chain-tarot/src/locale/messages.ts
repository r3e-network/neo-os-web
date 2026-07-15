import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // Machine-readable locale marker for card presentation. This deliberately
  // avoids inferring language from translated labels such as "Past" / "过去".
  localeCode: { en: "en", zh: "zh", ja: "en" },
  // App translations
  appEyebrow: { en: "Neo Tarot", zh: "Neo 塔罗" },
  appSubtitle: {
    en: "Ask a question, record a three-card draw on-chain, then reveal the spread.",
    zh: "提出问题，在链上记录三张牌的抽取结果，然后揭示牌阵。",
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
  readingRequested: {
    en: "Reading requested. The oracle is shuffling your spread.",
    zh: "读牌请求已提交，预言机正在洗牌。",
  },
  cardsReady: { en: "The oracle spread is ready to reveal.", zh: "预言机牌阵已就绪，可以揭示。" },
  readingRequestUnconfirmed: {
    en: "The request was submitted, but its reading ID could not be confirmed. Refresh before trying again.",
    zh: "请求已提交，但暂未确认读牌编号。请先刷新状态，不要重复提交。",
  },
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
    en: "Reading credit was deposited, but the oracle request did not start. The credit remains withdrawable or reusable.",
    zh: "读牌额度已存入，但预言机请求未启动。该额度仍可提取或再次使用。",
  },
  cardsDrawnCount: { en: "Cards Drawn", zh: "抽取卡牌数" },
  totalSpent: { en: "Total Spent", zh: "总花费" },
  oracleVerified: {
    en: "Morpheus returns signed randomness asynchronously. The contract binds it to this request, draws three distinct cards, and stores the terminal reading on-chain.",
    zh: "Morpheus 异步返回签名随机数；合约将其绑定到本次请求，抽取三张不同卡牌并保存最终链上读牌。",
  },
  fairnessTitle: { en: "On-chain draw proof", zh: "链上抽牌证明" },
  fairnessCopy: {
    en: "Your wallet deposits reusable credit and signs one oracle request. Cards remain sealed until the contract accepts the bound Morpheus result; oracle failure or timeout restores the full reading fee to your credit.",
    zh: "钱包存入可复用额度并签署一次预言机请求。合约接受绑定的 Morpheus 结果后才会生成牌阵；预言机失败或超时会将完整读牌费用退回额度。",
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
  readingStepOne: { en: "Choose an intention", zh: "选择意图" },
  readingStepOneShort: { en: "Intend", zh: "意图" },
  readingStepOneCopy: {
    en: "Pick Clarity, Decision, or Momentum. The selected focus stays on your device.",
    zh: "选择看清、选择或势能；所选读牌主题仅保存在你的设备上。",
  },
  readingStepTwo: { en: "Pay the draw fee", zh: "支付抽牌费用" },
  readingStepTwoShort: { en: "Pay", zh: "付款" },
  readingStepTwoCopy: {
    en: "If needed, approve the reusable GAS credit deposit. Then approve the oracle request; the cards arrive asynchronously.",
    zh: "如额度不足，先确认可复用的 GAS 额度存入；随后确认预言机请求，卡牌将异步返回。",
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
    en: "Choose one tactile intent token. The selected focus stays local; only a future verified GameFi draw would involve the chain.",
    zh: "选择一个意图令牌；所选主题保留在本地。只有未来经验证的 GameFi 抽牌才会涉及链上操作。",
  },
  moreActions: { en: "More actions", zh: "更多操作" },
  drawerSummaryLabel: { en: "Tarot reading summary", zh: "塔罗读牌摘要" },
  refreshReadingState: { en: "Refresh state", zh: "刷新状态" },
  checkingOracle: { en: "Checking the oracle...", zh: "正在检查预言机…" },
  checkOracleResult: { en: "Check oracle result", zh: "检查预言机结果" },
  recoverReadingFee: { en: "Recover reading fee", zh: "取回读牌费用" },
  oracleWaitingTitle: { en: "The oracle is shuffling", zh: "预言机正在洗牌" },
  oracleWaitingStatus: {
    en: "Your request is sealed on-chain. Check again when Morpheus returns the result.",
    zh: "请求已在链上封存。Morpheus 返回结果后再次检查即可。",
  },
  oracleTimeoutTitle: { en: "The oracle window has closed", zh: "预言机等待时间已结束" },
  oracleTimedOut: { en: "Fee recovery ready", zh: "可取回费用" },
  oracleFeeLabel: { en: "Oracle fee cap", zh: "预言机费用上限" },
  pendingReadingLabel: { en: "Pending reading", zh: "待完成读牌" },
  oracleRequestLabel: { en: "Oracle request", zh: "预言机请求" },
  expiresLabel: { en: "Recovery after", zh: "可恢复时间" },
  noPendingReading: { en: "No pending reading to recover", zh: "没有可恢复的待完成读牌" },
  readingNotExpired: {
    en: "The oracle still has time to settle this reading. Check again shortly.",
    zh: "预言机仍可完成本次读牌，请稍后再次检查。",
  },
  readingFeeRestored: { en: "Reading fee restored", zh: "读牌费用已退回" },
  readingFeeRecovered: {
    en: "Recovered {amount} {tokenGas} to prepaid credit",
    zh: "已将 {amount} {tokenGas} 退回预付额度",
  },
  currentSpreadTitle: { en: "Current spread", zh: "当前牌阵" },
  readingLeadLabel: { en: "Your question: ", zh: "你的问题是：" },
  sealedReadingHint: { en: "Tap the card to reveal.", zh: "点击卡牌揭示。" },
  // ── Card detail zoom overlay (tap a revealed card to enlarge + read) ──────
  detailClose: { en: "Close", zh: "关闭" },
  detailPosition: { en: "Position", zh: "位置" },
  detailElement: { en: "Element", zh: "元素" },
  detailKeywords: { en: "Keywords", zh: "关键词" },
  detailPastFrame: {
    en: "It mirrors a path you have already walked — the origin now legible.",
    zh: "它映照你已经走过的一段历程，来由如今清晰可辨。",
  },
  detailPresentFrame: {
    en: "It mirrors the core challenge you stand within right now.",
    zh: "它映照你正身处其中的核心课题。",
  },
  detailFutureFrame: {
    en: "It mirrors what may unfold — a possibility, not a verdict.",
    zh: "它映照即将展开的可能，而非定数。",
  },
  elementFire: { en: "Fire", zh: "火" },
  elementWater: { en: "Water", zh: "水" },
  elementAir: { en: "Air", zh: "风" },
  elementEarth: { en: "Earth", zh: "土" },
  elementNone: { en: "—", zh: "—" },
  readerWalletLabel: { en: "Wallet", zh: "钱包" },
  readerWalletMissing: { en: "Not connected", zh: "未连接" },
  intentionDeckLabel: { en: "Intention deck", zh: "意图牌组" },
  questionPreviewLabel: { en: "Focus", zh: "聚焦" },
  questionPreviewFallback: {
    en: "Set the tone for this spread.",
    zh: "为这次牌阵设定主题。",
  },
  ritualNetworkStatus: { en: "Neo N3 online", zh: "Neo N3 在线" },
  guestRitualStatus: { en: "Local · no wallet", zh: "本地 · 无需钱包" },
  ritualStepChooseIntent: {
    en: "Step one · Choose an intention",
    zh: "第一步 · 选择意图",
  },
  ritualIntentPrompt: {
    en: "What do you most want to understand right now?",
    zh: "此刻，你最想看清什么？",
  },
  ritualStepIntent: { en: "Intention", zh: "意图" },
  ritualStepDraw: { en: "Draw", zh: "抽牌" },
  ritualStepRead: { en: "Reading", zh: "解读" },
  ritualActionConfirm: {
    en: "Confirm intention · Draw 3 cards",
    zh: "确认意图，抽取 3 张牌",
  },
  ritualOpeningTable: {
    en: "Opening the ritual table",
    zh: "正在打开仪式牌桌",
  },
  gameFiMaintenanceShort: {
    en: "GameFi rewards under maintenance",
    zh: "GameFi 奖励维护中",
  },
  enableGameSound: { en: "Enable game sound", zh: "开启游戏声音" },
  muteGameSound: { en: "Mute game sound", zh: "关闭游戏声音" },
  gameActionFailed: { en: "The reading could not continue", zh: "读牌暂时无法继续" },
  retry: { en: "Retry", zh: "重试" },
  continue: { en: "Continue", zh: "继续" },
  rulesTitle: { en: "How to play", zh: "怎么玩" },
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
    en: "Confirm the credit and oracle request in your wallet.",
    zh: "请在钱包中确认额度与预言机请求。",
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
  oracleLaneLabel: { en: "On-chain draw lane", zh: "链上抽牌轨道" },
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
  loadingCard: { en: "Loading card…", zh: "正在加载卡牌…" },
  cardUnavailable: {
    en: "Card art unavailable · try a new reading",
    zh: "卡面暂不可用 · 请开启新读牌重试",
  },
  notDrawnYet: { en: "Not drawn yet", zh: "尚未抽取" },
  submitQuestionFirst: { en: "Submit a question first", zh: "先提交问题" },
  hiddenCard: { en: "Sealed card", zh: "封存卡牌" },
  oracleSealed: { en: "Sealed", zh: "封存" },
  revealProgress: { en: "Revealed", zh: "已揭示" },
  verificationPanelTitle: { en: "Transaction safety", zh: "交易安全" },
  verificationPanelCopy: {
    en: "The miniapp talks directly to the tarot VRF contract through the wallet. Deposits and requests are separately reviewed; the play area never treats submission as a completed reading.",
    zh: "小程序通过钱包直接与塔罗 VRF 合约交互。额度存入与请求分别确认；play area 不会把提交请求误当作读牌完成。",
  },
  verificationPointFee: {
    en: "0.1 GAS draw fee is shown in the wallet before you approve.",
    zh: "0.1 GAS 抽牌费用会在你确认前显示在钱包中。",
  },
  verificationPointRandom: {
    en: "Cards appear only after a bound Morpheus randomness result is stored on-chain.",
    zh: "只有绑定的 Morpheus 随机结果上链后，卡牌才会出现。",
  },
  verificationPointWallet: {
    en: "Oracle failure and timeout return the full reading fee to withdrawable credit.",
    zh: "预言机失败或超时会将完整读牌费用退回可提取额度。",
  },
  contractRouteLabel: { en: "Contract route", zh: "合约路径" },
  tarotContractRoute: {
    en: "GAS credit -> requestReading -> Morpheus callback",
    zh: "GAS 额度 -> requestReading -> Morpheus 回调",
  },
  feeLabel: { en: "Draw fee", zh: "抽牌费用" },
  tarotFee: { en: "0.1 GAS on-chain", zh: "0.1 GAS（链上）" },
  readingStateLabel: { en: "Reading state", zh: "读牌状态" },
  // Title case to match its three sibling tile labels ("Reading state",
  // "Readings", "Cards Drawn"). Only ever used as that tile's label, never
  // inline in a sentence, so the casing is the label's own.
  revealed: { en: "Revealed", zh: "已揭示" },
  oracleVerifiedShort: { en: "Recorded on-chain", zh: "链上已记录" },
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
    en: "On-Chain Tarot requests a Morpheus-backed three-card reading. The contract binds the asynchronous result to the player and request, stores three distinct Past-Present-Future cards, and restores the full reading fee if the oracle fails or times out.",
    zh: "链上塔罗通过 Morpheus 请求三牌解读。合约将异步结果绑定到玩家与请求，保存三张不重复的过去-现在-未来卡牌；预言机失败或超时则完整退回读牌费用。",
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
    en: "Morpheus settles the request asynchronously; refresh when the sealed spread is ready.",
    zh: "Morpheus 异步结算请求；封存牌阵就绪后刷新即可。",
  },
  step4: {
    en: "Flip each card to reveal your Past, Present, and Future.",
    zh: "翻转每张牌揭示你的过去、现在和未来。",
  },
  feature1Name: { en: "On-Chain Draw", zh: "链上抽牌" },
  feature1Desc: {
    en: "Cards are derived from a request-bound Morpheus result and accepted only after terminal contract readback.",
    zh: "卡牌由绑定请求的 Morpheus 结果生成，并且只有最终合约状态读回后才会被接受。",
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
    en: "Choose an intent, draw three Neo-styled cards, and reveal the spread — free, on this device.",
    zh: "选择意图，抽取三张 Neo 风格塔罗牌并揭示牌阵——本地免费。",
  },
  guestDrawnBadge: { en: "Drawn locally", zh: "本地抽取" },
  guestAwaitingBadge: { en: "Ready to shuffle", zh: "等待洗牌" },
  guestSealed: { en: "Dealt locally", zh: "本地已发牌" },
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
    en: "Choose Clarity, Decision, or Momentum. The intent and draw stay on this device — a free local reading.",
    zh: "选择看清、选择或势能。意图和抽牌都留在当前设备——免费的本地读牌。",
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
  secureRandomUnavailable: {
    en: "Secure shuffle is unavailable on this device. Nothing was drawn — please retry in a supported browser.",
    zh: "当前设备无法安全洗牌，本次没有抽牌。请在受支持的浏览器中重试。",
  },
  assetErrorTitle: {
    en: "Ritual artwork unavailable",
    zh: "读牌资源暂时不可用",
  },
  assetErrorBody: {
    en: "The game could not load its visual assets. Check your connection and try again.",
    zh: "游戏资源加载失败。请检查网络后重试。",
  },
  assetRetry: { en: "Retry artwork", zh: "重新加载资源" },
  assetRetrying: { en: "Reloading the original artwork...", zh: "正在重新加载原始资源……" },
  guestRouteLabel: { en: "Draw path", zh: "抽牌路径" },
  guestContractRoute: { en: "local shuffle -> deal", zh: "本地洗牌 -> 发牌" },
  guestStepTwoShort: { en: "Draw", zh: "抽牌" },
  guestStepTwoCopy: {
    en: "Tap the deck to shuffle and deal three cards instantly — no payment.",
    zh: "点击牌组即可洗牌并立即发出三张牌——无需付款。",
  },
} as const;

export const messages = mergeMessages(appMessages);
