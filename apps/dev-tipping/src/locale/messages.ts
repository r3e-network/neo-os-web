import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Dev Tipping", zh: "开发者打赏" },
  subtitle: { en: "Support developers", zh: "支持开发者" },
  stats: { en: "Stats", zh: "统计" },
  developers: { en: "Developers", zh: "开发者" },
  topDevelopers: { en: "Top Developers", zh: "顶级开发者" },
  tipsCount: { en: "tips", zh: "打赏次数" },
  totalTips: { en: "Total Tips", zh: "总打赏" },
  sendTip: { en: "Send Tip", zh: "发送打赏" },
  selectDeveloper: { en: "Select Developer", zh: "选择开发者" },
  developerId: { en: "Who are you supporting?", zh: "你想支持谁？" },
  developerIdPlaceholder: { en: "Registered developer ID", zh: "已注册开发者 ID" },
  developerIdHelp: {
    en: "Ask the developer for their registered ID, or register yourself in the Developer Zone below.",
    zh: "向开发者索取其已注册 ID，或在下方「开发者专区」注册你自己。",
  },
  tipAmount: { en: "How much GAS?", zh: "打赏多少 GAS？" },
  customAmount: { en: "Custom", zh: "自定义" },
  walletGasBalance: { en: "Verified wallet balance", zh: "已验证钱包余额" },
  quickTipLabel: { en: "Quick tip", zh: "快捷打赏" },
  tipPresetLabel: { en: "Tip amount presets", zh: "打赏金额快捷选项" },
  tipPreviewTitle: { en: "Tip preview", zh: "打赏预览" },
  tipRecipientPending: { en: "Choose a developer", zh: "选择开发者" },
  tipAmountPending: { en: "Choose amount", zh: "选择金额" },
  directTipRoute: { en: "Direct contract tip", zh: "直达合约打赏" },
  optionalMessage: { en: "Optional Message", zh: "可选消息" },
  messagePlaceholder: { en: "Say thanks...", zh: "说声谢谢..." },
  tipperName: { en: "Your Name (optional)", zh: "您的昵称（可选）" },
  tipperNamePlaceholder: { en: "Anonymous", zh: "匿名" },
  anonymousLabel: { en: "Send Anonymously", zh: "匿名发送" },
  tipVisibility: { en: "Tip visibility", zh: "打赏署名" },
  anonymousOn: { en: "Anonymous", zh: "匿名" },
  anonymousOff: { en: "Show wallet address", zh: "显示钱包地址" },
  sending: { en: "Sending...", zh: "发送中..." },
  sendTipBtn: { en: "Send Tip", zh: "发送打赏" },
  sendTipBtnIdle: { en: "Pick a developer & amount", zh: "选择开发者和金额" },
  sendTipHint: {
    en: "Enter a developer ID and a tip amount, then send your support.",
    zh: "输入开发者 ID 和打赏金额，然后送出你的支持。",
  },
  tipSent: { en: "Tip sent successfully!", zh: "打赏发送成功！" },
  invalidAmount: { en: "Invalid amount", zh: "无效金额" },
  minTip: { en: "Minimum tip is 0.001 GAS", zh: "最低打赏为 0.001 GAS" },
  insufficientGas: { en: "Your verified GAS balance is too low for this tip.", zh: "已验证的 GAS 余额不足以完成本次打赏。" },
  operationBusy: { en: "Another wallet action is still in progress.", zh: "另一项钱包操作仍在进行中。" },
  walletChangedDuringAction: {
    en: "The connected wallet changed. Review the current account before trying again.",
    zh: "连接的钱包已变化；请核对当前账户后再操作。",
  },
  invalidVisibility: { en: "Choose a valid visibility setting.", zh: "请选择有效的署名设置。" },
  recentTips: { en: "Recent Tips", zh: "最近打赏" },
  totalDonated: { en: "Total Donated", zh: "总打赏额" },
  wallet: { en: "Wallet", zh: "钱包" },
  tipRouteTitle: { en: "Tip route", zh: "打赏路径" },
  tipRouteDirect: { en: "GAS goes through the tip contract", zh: "GAS 经由打赏合约处理" },
  tipRouteClaimable: { en: "Developers withdraw claimable tips", zh: "开发者领取可提取打赏" },
  tipRouteAnonymous: { en: "Anonymous mode is contract-backed", zh: "匿名模式由合约记录" },
  supportStageEyebrow: { en: "Support board", zh: "支持看板" },
  supportStageTitle: {
    en: "Send a GAS tip to a builder.",
    zh: "给建设者发送 GAS 打赏。",
  },
  supportStageCopy: {
    en: "Pick the recipient, choose an amount, then confirm one wallet action.",
    zh: "选择接收方和金额，然后确认一次钱包操作。",
  },
  supportStageDevelopers: { en: "Builders", zh: "建设者" },
  supportStageDirectTips: { en: "Direct tips", zh: "直接打赏" },
  supportOptions: { en: "Support options", zh: "支持选项" },
  supportTabDirect: { en: "Direct ID", zh: "直接 ID" },
  supportTabCreator: { en: "Creator tools", zh: "创作者工具" },
  supportTabHistory: { en: "History", zh: "历史" },
  // Honest zero-state for the board's lifetime total. A visitor without a
  // wallet has no network bound, so the board cannot be read — that is a fact
  // to state, not a void to paper over, and emphatically not a "0 GAS" that
  // would assert nobody has ever tipped.
  totalDonatedUnread: { en: "Connect to load", zh: "连接后加载" },
  directSupportTitle: { en: "Direct support ID", zh: "直接支持 ID" },
  noDevelopers: { en: "Be the first to say thanks", zh: "成为第一个道谢的人" },
  noDevelopersHint: {
    en: "No public builders yet. Open Support options to enter a registered developer ID.",
    zh: "暂无公开建设者。打开「支持选项」即可输入已注册开发者 ID。",
  },
  noRecentTips: { en: "No tips recorded yet", zh: "暂无打赏记录" },
  noRecentTipsHint: {
    en: "Confirmed tips will appear here after the event index catches up.",
    zh: "确认后的打赏会在事件索引同步后显示在这里。",
  },
  activityUnavailable: { en: "Tip activity is temporarily unavailable", zh: "打赏动态暂时不可用" },
  activityUnavailableHint: {
    en: "The support board is still available. Retry before treating this history as complete.",
    zh: "支持看板仍可浏览；请重试后再将这里视为完整历史。",
  },
  supportBoardTitle: { en: "Support board is waiting", zh: "支持榜单等待点亮" },
  supportBoardHint: {
    en: "Use Direct support ID when a builder is not listed publicly yet.",
    zh: "如果建设者尚未出现在公开列表中，可使用「直接支持 ID」。",
  },
  supportBoardStageLabel: {
    en: "Developer support board",
    zh: "开发者支持台",
  },
  supportBoardStageAlt: {
    en: "Warm Neo developer support board with GAS tips and builder cards",
    zh: "温暖的 Neo 开发者支持台，展示 GAS 打赏和建设者卡片",
  },
  supportDeskTitle: {
    en: "Support desk",
    zh: "支持台",
  },
  supportDeskCopy: {
    en: "Choose a builder, set a GAS tip, and keep the technical details tucked away.",
    zh: "选择建设者、设置 GAS 打赏，把技术细节收进次级区域。",
  },
  howItWorks: { en: "How it works", zh: "使用说明" },
  defaultDevName: { en: "Dev #{id}", zh: "开发者 #{id}" },
  defaultDevRole: { en: "Neo Developer", zh: "Neo 开发者" },
  tipRecipientHint: {
    en: "Recipient developer (from the on-chain Tipped event's developer ID)",
    zh: "接收方开发者（来自链上 Tipped 事件的开发者 ID）",
  },

  // Developer self-service (register + withdraw)
  developerZone: { en: "Developer Zone", zh: "开发者专区" },
  registerHint: {
    en: "Register your wallet to receive tips from supporters.",
    zh: "注册您的钱包，即可接收支持者的打赏。",
  },
  registerHintShort: { en: "Register", zh: "注册" },
  claimableHint: {
    en: "Tips accumulate as a claimable on-chain balance shown here — tap Withdraw Tips to move them to your wallet.",
    zh: "打赏会以可领取的链上余额累积在此处 — 点击「领取打赏」即可转入您的钱包。",
  },
  registerConnectHint: {
    en: "Connect your wallet to register as a developer.",
    zh: "连接钱包以注册为开发者。",
  },
  connecting: { en: "Connecting...", zh: "连接中..." },
  connectFailed: { en: "Connect failed", zh: "连接失败" },
  devNameLabel: { en: "Display Name", zh: "显示名称" },
  devNamePlaceholder: { en: "e.g. Neo Core", zh: "例如：Neo Core" },
  devRoleLabel: { en: "Role (optional)", zh: "角色（可选）" },
  devRolePlaceholder: { en: "e.g. Protocol Maintainer", zh: "例如：协议维护者" },
  registerBtn: { en: "Register as Developer", zh: "注册为开发者" },
  registering: { en: "Registering...", zh: "注册中..." },
  registered: { en: "Registered successfully!", zh: "注册成功！" },
  invalidDevName: {
    en: "Name must be 1-64 bytes of UTF-8 (a CJK character uses 3 bytes)",
    zh: "名称需为 1-64 个 UTF-8 字节（每个中文字符占 3 字节）",
  },
  invalidDevRole: {
    en: "Role must be 64 bytes of UTF-8 or fewer (a CJK character uses 3 bytes)",
    zh: "角色不超过 64 个 UTF-8 字节（每个中文字符占 3 字节）",
  },
  alreadyRegistered: { en: "This wallet is already registered as a developer.", zh: "该钱包已注册为开发者。" },
  developerWalletMismatch: {
    en: "This developer profile belongs to another wallet.",
    zh: "该开发者档案属于另一个钱包。",
  },
  registeredAs: { en: "Registered as developer", zh: "已注册为开发者" },
  claimableBalance: { en: "Claimable Tips", zh: "可领取打赏" },
  withdrawTipsBtn: { en: "Withdraw Tips", zh: "领取打赏" },
  withdrawing: { en: "Withdrawing...", zh: "领取中..." },
  tipsWithdrawn: { en: "Tips withdrawn to your wallet", zh: "打赏已领取到您的钱包" },
  nothingToWithdraw: { en: "No tips to withdraw", zh: "暂无可领取打赏" },
  // Stranded-tip-credit reclaim (deposit landed, tip step failed).
  unusedCredit: { en: "Unused tip credit", zh: "未使用打赏额度" },
  withdrawCredit: { en: "Withdraw credit", zh: "取回额度" },
  creditWithdrawn: { en: "Tip credit withdrawn to your wallet", zh: "打赏额度已取回到您的钱包" },
  tipPrepaidNoTip: {
    en: "Deposit landed but the tip did not settle. Your credit is held on the contract and reused on your next tip.",
    zh: "已存入但打赏未结算。您的余额已保留在合约中，将用于下次打赏。",
  },
  registryUnavailable: {
    en: "The developer registry could not be read. Existing data is not being replaced with an empty list.",
    zh: "暂时无法读取开发者名录；现有数据不会被错误替换为空列表。",
  },
  walletSnapshotUnavailable: {
    en: "Wallet GAS, credit, and developer balances could not be verified. No zero balance is being assumed.",
    zh: "暂时无法验证钱包 GAS、预存额度和开发者余额；不会将其假定为零。",
  },
  runtimeNetworkMismatch: {
    en: "The wallet network does not match this Dev Tipping launch.",
    zh: "钱包网络与当前开发者打赏入口不一致。",
  },
  runtimeBindingMismatch: {
    en: "The live Tip Jar contract generation or ABI does not match this release.",
    zh: "线上 Tip Jar 合约版本或 ABI 与当前版本不匹配。",
  },
  runtimeUnavailable: {
    en: "The Tip Jar runtime could not be verified. Payments remain disabled until retry succeeds.",
    zh: "暂时无法验证 Tip Jar 运行环境；重试成功前将保持关闭支付。",
  },
  pendingTipBlocksAction: {
    en: "Check the pending tip receipt before sending another payment.",
    zh: "请先核对待确认的打赏收据，再发起下一笔支付。",
  },
  pendingActionBlocksAction: {
    en: "Check the pending wallet receipt before starting another action.",
    zh: "请先核对待确认的钱包收据，再发起其他操作。",
  },
  recoveryStorageUnavailable: {
    en: "This browser cannot safely save a transaction recovery receipt. Free storage or change browser before continuing.",
    zh: "当前浏览器无法安全保存交易恢复收据；请释放存储空间或更换浏览器后再继续。",
  },
  transactionIdInvalid: {
    en: "The wallet did not return an exact 0x-prefixed 64-byte transaction id.",
    zh: "钱包未返回精确的 0x 前缀 64 字节交易哈希。",
  },
  transactionIdConflict: {
    en: "The wallet returned conflicting transaction ids. The first saved receipt remains authoritative.",
    zh: "钱包返回了冲突的交易哈希；首个已保存收据仍作为核对依据。",
  },
  receiptPending: {
    en: "Transaction broadcast. Waiting for the exact contract event and authoritative state readback.",
    zh: "交易已广播，正在等待精确合约事件与权威状态读回。",
  },
  receiptReadbackPending: {
    en: "The event was found, but the recipient balance readback is not ready. Check again before retrying.",
    zh: "已找到事件，但接收方余额读回尚未就绪；请再次核对后再决定是否重试。",
  },
  receiptEventMissing: {
    en: "The transaction halted, but its exact Tipped event is not indexed yet. Keep this receipt pending.",
    zh: "交易已执行，但精确的 Tipped 事件尚未完成索引；请保留待确认收据。",
  },
  receiptEventMismatch: {
    en: "The observed event does not match this recipient, sender, amount, or visibility choice.",
    zh: "已观察到的事件与本次接收方、发送方、金额或署名设置不匹配。",
  },
  receiptConfirmed: {
    en: "Tip confirmed by its exact event and recipient balance readback.",
    zh: "打赏已通过精确事件与接收方余额读回确认。",
  },
  receiptFault: {
    en: "The transaction FAULTed. No tip was confirmed; correct the input before retrying.",
    zh: "交易执行失败（FAULT），未确认打赏；请修正后再重试。",
  },
  receiptExpired: {
    en: "No confirming record was found after 24 hours. The receipt remains locked to prevent a duplicate action; verify it on-chain.",
    zh: "24 小时后仍未找到确认记录；为避免重复操作，收据仍保持锁定，请先在链上核对。",
  },
  receiptCleanupPending: {
    en: "The transaction is confirmed, but its local recovery lock could not be cleared. Retry the receipt check before starting another wallet action.",
    zh: "交易已确认，但本地恢复锁尚未清除。发起下一次钱包操作前，请重试收据检查。",
  },
  receiptUnavailableAfterBroadcast: {
    en: "The transaction was broadcast, but its recovery receipt could not be saved. Record the wallet txid before leaving.",
    zh: "交易已广播，但无法保存恢复收据；离开前请记录钱包中的交易哈希。",
  },
  secondaryActionPending: {
    en: "Transaction broadcast and saved. Check its receipt after the expected event is indexed.",
    zh: "交易已广播并保存；请在预期事件完成索引后核对收据。",
  },
  secondaryActionConfirmed: {
    en: "The expected event and authoritative state readback agree.",
    zh: "预期事件与权威状态读回一致。",
  },
  dataRefreshPending: {
    en: "The transaction is confirmed, but the latest board data still needs a refresh.",
    zh: "交易已确认，但最新看板数据仍需刷新。",
  },
  operation_deposit: { en: "Recovered tip credit", zh: "已恢复打赏额度" },
  operation_tip: { en: "Developer tip", zh: "开发者打赏" },
  operation_register: { en: "Developer registration", zh: "开发者注册" },
  operation_withdrawTips: { en: "Tip withdrawal", zh: "打赏领取" },
  operation_withdrawCredit: { en: "Credit withdrawal", zh: "额度取回" },
  checkReceipt: { en: "Check receipt", zh: "核对收据" },
  checkingReceipt: { en: "Checking receipt…", zh: "正在核对收据…" },
  dataNeedsRetry: { en: "Live data needs attention", zh: "线上数据需要重试" },
  receiptStatus_pending: { en: "Awaiting confirmation", zh: "等待链上确认" },
  receiptStatus_readback: { en: "Awaiting balance readback", zh: "等待余额读回" },
  receiptStatus_confirmed: { en: "Transaction confirmed", zh: "交易已确认" },
  receiptStatus_fault: { en: "Transaction failed", zh: "交易执行失败" },
  receiptStatus_credit: { en: "Credit held for recovery", zh: "额度已保留待恢复" },
  receiptStatus_expired: { en: "Receipt check expired", zh: "收据核对已过期" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },
  contractNotReady: { en: "Contract not ready", zh: "合约未就绪" },
  error: { en: "Something went wrong", zh: "出现错误" },

  docSubtitle: {
    en: "Support developers with direct GAS tips",
    zh: "用 GAS 打赏直接支持开发者",
  },
  docDescription: {
    en: "Dev Tipping records GAS tips on-chain. 100% of each tip (no platform fee) accrues to the developer's claimable on-chain balance, which they withdraw to their wallet. Support open source builders, stay anonymous if you want, and track every contribution in your history.",
    zh: "Dev Tipping 将 GAS 打赏记录在链上。每笔打赏 100%（无平台费）累积到开发者的链上可领取余额，由开发者自行领取到钱包。可匿名支持开源建设者，并在历史中追踪每一次贡献。",
  },
  step1: {
    en: "Connect your Neo wallet",
    zh: "连接您的 Neo 钱包",
  },
  step2: {
    en: "Choose a listed developer or enter their registered ID",
    zh: "选择榜单开发者，或输入已注册开发者 ID",
  },
  step3: {
    en: "Choose a GAS amount and visibility mode",
    zh: "选择 GAS 金额和可见模式",
  },
  step4: {
    en: "Confirm transaction - your tip accrues to the developer's claimable balance",
    zh: "确认交易 - 打赏累积到开发者的可领取余额",
  },
  feature1Name: { en: "Full-Value Tips", zh: "全额打赏" },
  feature1Desc: {
    en: "100% of your tip (no platform fee) accrues to the developer's on-chain balance, which they withdraw to their wallet.",
    zh: "您的打赏 100%（无平台费）累积到开发者的链上余额，由开发者自行领取到钱包。",
  },
  feature2Name: { en: "Contribution Tracking", zh: "贡献追踪" },
  feature2Desc: {
    en: "All tips are recorded on-chain with full transparency.",
    zh: "所有打赏都记录在链上，完全透明。",
  },
  feature3Name: { en: "Contract-backed visibility", zh: "合约记录署名设置" },
  feature3Desc: {
    en: "Choose a public sender address or anonymous mode; the deployed contract stores no free-form message.",
    zh: "可选择公开发送地址或匿名模式；已部署合约不会存储自由文本留言。",
  },
} as const;

export const messages = mergeMessages(appMessages);
