import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Time Capsule", zh: "时间胶囊" },
  subtitle: {
    en: "Lock content until future date",
    zh: "锁定内容直到未来日期",
  },
  vaultEyebrow: { en: "ON-CHAIN VAULT", zh: "链上金库" },
  heroStageAlt: {
    en: "Glass time capsule chamber sealing a glowing message",
    zh: "玻璃时间胶囊舱封存发光消息",
  },
  yourCapsules: { en: "Your Capsules", zh: "你的胶囊" },
  noCapsules: {
    en: "No capsules yet. Create your first one!",
    zh: "还没有胶囊。创建你的第一个吧！",
  },
  noLocalCapsules: {
    en: "No local capsules on this device yet. Seal your first capsule to get started.",
    zh: "本设备还没有本地胶囊。封存你的第一个胶囊开始吧。",
  },
  timeRemaining: { en: "Time Remaining", zh: "剩余时间" },
  unlocks: { en: "Unlocks:", zh: "解锁时间：" },
  unlocked: { en: "Unlocked", zh: "已解锁" },
  locked: { en: "Locked", zh: "锁定中" },
  revealed: { en: "Revealed", zh: "已揭示" },
  reveal: { en: "Reveal Capsule", zh: "揭示胶囊" },
  open: { en: "Open Capsule", zh: "打开胶囊" },
  createCapsule: { en: "Create New Capsule", zh: "创建新胶囊" },
  sealWorkbenchEyebrow: { en: "Seal workspace", zh: "封存工作台" },
  sealWorkbenchCopy: {
    en: "Write the local message, set the unlock window, then review what will be sealed on-chain.",
    zh: "写入本地消息，设置解锁窗口，然后复核即将封存上链的内容。",
  },
  messageStage: { en: "Message core", zh: "消息核心" },
  messageStageCopy: {
    en: "The full message stays on this device; the chain stores its hash.",
    zh: "完整消息保存在本设备，链上只保存哈希。",
  },
  letterDockLabel: { en: "Message sealing dock", zh: "消息封存坞" },
  letterDockKicker: { en: "Letter loading", zh: "信件装填" },
  letterDockEmpty: {
    en: "Write a title or message to load the capsule.",
    zh: "写入标题或消息后，胶囊会开始装填。",
  },
  letterDockCount: {
    en: "{count} characters ready to seal",
    zh: "{count} 个字符准备封存",
  },
  timeLockStage: { en: "Time lock", zh: "时间锁" },
  timeLockStageCopy: {
    en: "Choose when the capsule becomes revealable.",
    zh: "选择胶囊何时可揭示。",
  },
  categoryStageCopy: {
    en: "Give the capsule a recognizable intent.",
    zh: "为胶囊选择清晰用途。",
  },
  visibilityStageCopy: {
    en: "Control who can reveal after unlock.",
    zh: "控制解锁后谁可以揭示。",
  },
  sealPreview: { en: "Seal preview", zh: "封存预览" },
  capsuleBoardTitle: { en: "Capsule seal board", zh: "胶囊封存棋盘" },
  capsuleBoardDraft: { en: "Draft slot", zh: "草稿槽" },
  capsuleBoardReadySeal: { en: "Ready to seal", zh: "准备封存" },
  capsuleBoardLocked: { en: "Unlock slot", zh: "解锁槽" },
  unlockPreview: { en: "Unlock preview", zh: "解锁预览" },
  depositLabel: { en: "Refundable deposit", zh: "可退还押金" },
  storageLabel: { en: "Chain record", zh: "链上记录" },
  titleLabel: { en: "Capsule Title", zh: "胶囊标题" },
  titlePlaceholder: { en: "Give your capsule a name", zh: "给胶囊取个名字" },
  secretMessage: { en: "Secret Message", zh: "秘密消息" },
  secretMessagePlaceholder: {
    en: "Enter your secret message",
    zh: "输入你的秘密消息",
  },
  contentStorageNote: {
    en: "Your full message is stored locally on this device. Keep a backup if you want to reveal it later.",
    zh: "完整消息仅保存在本设备本地。请自行备份以便日后揭示。",
  },
  categoryLabel: { en: "Category", zh: "类别" },
  categoryPersonal: { en: "Personal", zh: "私人" },
  categoryGift: { en: "Gift", zh: "礼物" },
  categoryMemorial: { en: "Memorial", zh: "纪念" },
  categoryAnnouncement: { en: "Announcement", zh: "公告" },
  categorySecret: { en: "Secret", zh: "秘密" },
  categoryPersonalShort: { en: "Me", zh: "私人" },
  categoryGiftShort: { en: "Gift", zh: "礼物" },
  categoryMemorialShort: { en: "Memory", zh: "纪念" },
  categoryAnnouncementShort: { en: "News", zh: "公告" },
  categorySecretShort: { en: "Secret", zh: "秘密" },
  categoryPersonalHint: {
    en: "A note for your future self",
    zh: "写给未来自己的笔记",
  },
  categoryGiftHint: {
    en: "A timed reveal for someone else",
    zh: "给他人的定时揭晓",
  },
  categoryMemorialHint: {
    en: "Preserve a milestone or memory",
    zh: "保存重要节点或回忆",
  },
  categoryAnnouncementHint: {
    en: "Publish when the date arrives",
    zh: "到期后公开发布",
  },
  categorySecretHint: {
    en: "Keep the tone private and sealed",
    zh: "保持私密且封存",
  },
  unlockIn: { en: "Lock Duration", zh: "锁定时长" },
  daysPlaceholder: { en: "30", zh: "30" },
  durationPresets: { en: "Duration presets", zh: "常用锁定时长" },
  decreaseLockDuration: { en: "Decrease lock duration", zh: "减少锁定时长" },
  increaseLockDuration: { en: "Increase lock duration", zh: "增加锁定时长" },
  daysShort: { en: "D", zh: "天" },
  hoursShort: { en: "H", zh: "时" },
  minShort: { en: "M", zh: "分" },
  unlockDateHelper: {
    en: "Set between 1 and 3650 days before unlock",
    zh: "设置 1 到 3650 天后解锁",
  },
  visibility: { en: "Visibility", zh: "可见性" },
  private: { en: "Private", zh: "私密" },
  public: { en: "Public", zh: "公开" },
  privateHint: {
    en: "Only you can reveal after unlock",
    zh: "仅您可在解锁后揭示",
  },
  publicHint: {
    en: "Anyone can reveal after unlock",
    zh: "解锁后任何人可揭示",
  },
  createCapsuleButton: {
    en: "Create Capsule (0.2 GAS deposit)",
    zh: "创建胶囊 (0.2 GAS 押金)",
  },
  depositNote: {
    en: "The 0.2 GAS is a refundable deposit, locked in the vault and returned to you when you reveal — not a spent fee.",
    zh: "0.2 GAS 是可退还押金，会锁定在金库中，在你揭示胶囊时退回给你，并非花掉的手续费。",
  },
  creatingCapsule: { en: "Sealing capsule...", zh: "封存胶囊中..." },
  capsuleCreated: { en: "Capsule sealed on-chain!", zh: "胶囊已封存上链！" },
  capsuleRevealed: { en: "Capsule revealed", zh: "胶囊已揭示" },
  revealing: { en: "Revealing capsule...", zh: "揭示胶囊中..." },
  fish: { en: "Tip a public capsule", zh: "打赏公开胶囊" },
  fishSummary: {
    en: "Cheer on a sealed public capsule without revealing it.",
    zh: "鼓励一个公开封存胶囊，但不会揭示内容。",
  },
  fishFactTip: {
    en: "0.05 GAS goes to the capsule owner",
    zh: "0.05 GAS 会进入胶囊所有者名下",
  },
  fishFactSealed: { en: "The message stays sealed", zh: "消息仍保持封存" },
  fishFactCharged: {
    en: "Charged only when a tippable capsule exists",
    zh: "仅存在可打赏胶囊时才会扣费",
  },
  fishing: { en: "Sending tip...", zh: "打赏中..." },
  fishButton: { en: "Send 0.05 GAS Tip", zh: "打赏 0.05 GAS" },
  fishDescription: {
    en: 'This is a tip, not a reveal. Send a 0.05 GAS tip to the owner of a public, unrevealed capsule to cheer them on — the fee is credited on-chain to that owner, who collects it with "Collect tips". You do NOT see the message: it stays sealed until its owner reveals it. You get back only a public acknowledgement (the capsule id). Charged only when a tippable capsule exists.',
    zh: "这是打赏，不是揭示。向某个公开且未揭示胶囊的所有者发送 0.05 GAS 打赏以示鼓励——费用会在链上记入该所有者名下，由其通过“领取打赏”自行领取。你看不到消息内容：消息会一直封存，直到所有者本人揭示。你只会得到一个公开的确认（胶囊编号）。仅在存在可打赏胶囊时收取。",
  },
  collectTips: { en: "Collect tips", zh: "领取打赏" },
  collectingTips: { en: "Collecting...", zh: "领取中..." },
  tipsCollected: {
    en: "Collected {amount} GAS in fishing tips",
    zh: "已领取 {amount} GAS 打赏",
  },
  noTipsToCollect: {
    en: "No fishing tips to collect yet.",
    zh: "暂无可领取的打赏。",
  },
  collectTipsHint: {
    en: "Owners of public capsules collect any 0.05 GAS tips their capsules received here.",
    zh: "公开胶囊的所有者可在此领取胶囊收到的 0.05 GAS 打赏。",
  },
  fishResult: {
    en: "Tipped capsule {id} — it stays sealed until its owner reveals it",
    zh: "已打赏胶囊 {id}——在所有者揭示前仍保持封存",
  },
  fishNone: {
    en: "No public capsule available to tip",
    zh: "没有可打赏的公开胶囊",
  },
  fishCandidatesTitle: {
    en: "Public capsules you can tip",
    zh: "可打赏的公开胶囊",
  },
  fishCandidatesHint: {
    en: "Pick a capsule to tip its owner. The message stays sealed — you are only cheering them on.",
    zh: "选择一个胶囊为其所有者打赏。消息仍保持封存——你只是表示鼓励。",
  },
  fishCandidatesLoading: {
    en: "Looking for public capsules...",
    zh: "正在查找公开胶囊...",
  },
  fishCandidatesEmpty: {
    en: "No public, unrevealed capsules from other users right now.",
    zh: "目前没有其他用户公开且未揭示的胶囊。",
  },
  fishCandidatesRefresh: { en: "Refresh list", zh: "刷新列表" },
  fishTipThis: { en: "Tip (0.05 GAS)", zh: "打赏 (0.05 GAS)" },
  hashStored: { en: "Content hash stored on-chain", zh: "内容哈希已上链" },
  hashLabel: { en: "Hash:", zh: "哈希：" },
  contentUnavailable: {
    en: "No local message found. The on-chain hash is shown below.",
    zh: "未找到本地消息，下面展示链上哈希。",
  },
  notUnlocked: { en: "Capsule is still locked", zh: "胶囊仍处于锁定状态" },
  notUnlockedYet: { en: "Not unlocked yet", zh: "尚未到解锁时间" },
  invalidLockDuration: {
    en: "Lock duration must be between 1 and 3650 days.",
    zh: "锁定时长需在 1 到 3650 天之间。",
  },
  walletRequired: {
    en: "Connect your Neo wallet to seal a capsule.",
    zh: "请先连接 Neo 钱包再封存胶囊。",
  },
  contractNotReady: {
    en: "Time Capsule contract is not available on this network.",
    zh: "时间胶囊合约在当前网络上不可用。",
  },
  depositPrepaidNoCapsule: {
    en: "The 0.2 GAS deposit was prepaid but the capsule was not buried. The deposit is held on the contract as reusable credit—seal again to use it, or withdraw it below.",
    zh: "0.2 GAS 押金已预付，但胶囊未能封存。押金会作为可复用余额保留在合约中——可重试封存使用，或在下方提取。",
  },
  prepaidCreditLabel: { en: "Reusable Deposit Credit", zh: "可复用押金余额" },
  prepaidCreditHint: {
    en: "A 0.2 GAS deposit landed but its capsule was not sealed. It is reused on your next capsule, or withdraw it back to your wallet now.",
    zh: "一笔 0.2 GAS 押金已到账但胶囊未封存。下次封存会自动复用，也可现在提取回钱包。",
  },
  withdrawCredit: { en: "Withdraw Credit", zh: "提取余额" },
  withdrawingCredit: { en: "Withdrawing...", zh: "提取中..." },
  creditWithdrawn: {
    en: "Withdrew {amount} GAS deposit credit",
    zh: "已提取 {amount} GAS 押金余额",
  },
  noCreditToWithdraw: {
    en: "No reusable deposit credit to withdraw.",
    zh: "没有可提取的押金余额。",
  },
  untitledCapsule: { en: "Untitled capsule", zh: "无标题胶囊" },
  message: { en: "Message:", zh: "消息：" },
  tabCapsules: { en: "Capsules", zh: "胶囊" },
  tabCreate: { en: "Create", zh: "创建" },
  docSubtitle: {
    en: "Lock message hashes and tip public capsules",
    zh: "封存消息哈希并打赏公开胶囊",
  },
  docDescription: {
    en: "Time Capsule seals a message hash on-chain with a future unlock date. Keep the full message locally, choose public or private visibility, and optionally send a small on-chain tip to the owner of another user's public, unrevealed capsule — tipping does not reveal the message.",
    zh: "时间胶囊会将消息哈希与未来解锁时间封存上链。请本地保存完整内容，选择公开或私密可见性，并可向其他用户公开且未揭示胶囊的所有者发送小额链上打赏——打赏不会揭示消息内容。",
  },
  step1: {
    en: "Connect your Neo wallet and create a new time capsule",
    zh: "连接您的 Neo 钱包并创建新的时间胶囊",
  },
  step2: {
    en: "Enter your secret message and set the lock duration in days",
    zh: "输入您的秘密消息并设置锁定天数",
  },
  step3: {
    en: "Lock a 0.2 GAS refundable deposit to seal your capsule on-chain",
    zh: "锁定 0.2 GAS 可退还押金，将您的胶囊封存在链上",
  },
  step4: {
    en: "Reveal your capsule when the unlock date arrives to get your deposit back",
    zh: "当解锁日期到达时揭示您的胶囊，押金将退回给您",
  },
  feature1Name: { en: "Refundable Vault", zh: "可退还金库" },
  feature1Desc: {
    en: "Lock a refundable GAS deposit with the message hash until the unlock date; reveal returns it to you.",
    zh: "将可退还的 GAS 押金与消息哈希一起锁定至解锁日期，揭示时押金退回给你。",
  },
  feature2Name: { en: "Tip Public Capsules", zh: "打赏公开胶囊" },
  feature2Desc: {
    en: "Send a small on-chain tip to the owner of a public, unrevealed capsule to cheer them on. The message stays sealed — tipping does not reveal it.",
    zh: "向某个公开且未揭示胶囊的所有者发送小额链上打赏以示鼓励。消息仍保持封存——打赏不会揭示它。",
  },
  feature3Name: { en: "Local Content Vault", zh: "本地内容库" },
  feature3Desc: {
    en: "Only the hash is on-chain; your message stays on your device.",
    zh: "链上仅存哈希，完整消息保存在本地设备。",
  },
  wrongChain: { en: "Wrong Chain", zh: "链错误" },
  wrongChainMessage: {
    en: "This app requires Neo N3. Please switch networks.",
    zh: "此应用需要 Neo N3 网络，请切换网络。",
  },
  sidebarTotalCapsules: { en: "Total Capsules", zh: "总胶囊数" },
  sidebarLocked: { en: "Locked", zh: "已锁定" },
  sidebarRevealed: { en: "Revealed", zh: "已揭示" },
} as const;

export const messages = mergeMessages(appMessages);
