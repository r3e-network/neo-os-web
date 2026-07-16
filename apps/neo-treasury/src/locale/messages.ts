import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Neo Treasury", zh: "Neo 国库" },
  docSubtitle: { en: "Public treasury watchlist", zh: "公开国库观察清单" },
  docDescription: {
    en: "Neo Treasury tracks a fixed public Mainnet watchlist attributed to Neo founders, then verifies direct NEO/GAS transfers made only from the connected wallet.",
    zh: "Neo 国库追踪一组社区归属于 Neo 创始人的主网公开观察地址，并核验仅从已连接钱包发起的 NEO/GAS 直接转账。",
  },
  feature1Name: { en: "Transparent Funds", zh: "透明资金" },
  feature1Desc: { en: "Balances are fetched from public chain data with no placeholder totals.", zh: "余额来自公开链上数据，不使用占位总额。" },
  feature2Name: { en: "Founder Wallets", zh: "创始人钱包" },
  feature2Desc: { en: "Community-attributed Da Hongfei and Erik Zhang wallet groups are separated for inspection; this is not an ownership registry.", zh: "社区归属的 Da Hongfei 与 Erik Zhang 钱包组分开展示；这里不是官方所有权登记。" },
  feature3Name: { en: "Verified Wallet Transfers", zh: "可核验钱包转账" },
  feature3Desc: {
    en: "Public watched wallets remain read-only; a transfer is confirmed only after its exact native-token event and balance readback match.",
    zh: "公开观察钱包保持只读；只有原生代币事件与余额回读均精确匹配后，转账才会被确认为成功。",
  },
  balance: { en: "Balance", zh: "余额" },
  deposit: { en: "Deposit", zh: "存入" },
  withdraw: { en: "Withdraw", zh: "提取" },
  proposals: { en: "Transparency", zh: "透明度" },
  loadFailed: { en: "Failed to load", zh: "加载失败" },
  refreshing: { en: "Refreshing...", zh: "刷新中..." },
  step1: { en: "Fetch live chain balances", zh: "读取实时链上余额" },
  step2: { en: "View treasury balance", zh: "查看国库余额" },
  step3: { en: "Open each wallet group", zh: "打开各钱包组明细" },
  step4: { en: "Review a connected-wallet transfer", zh: "审核已连接钱包转账" },
  tabTotal: { en: "Total", zh: "总计" },
  tabDa: { en: "Da Hongfei", zh: "达鸿飞" },
  tabErik: { en: "Erik Zhang", zh: "Erik Zhang" },
  sidebarTotalUsd: { en: "Total USD", zh: "总美元" },
  sidebarTotalNeo: { en: "Total NEO", zh: "总 NEO" },
  sidebarTotalGas: { en: "Total GAS", zh: "总 GAS" },
  sidebarFounders: { en: "Founders", zh: "创始人" },
  // Honest read-out for the shell's stat rail and sidebar while the public
  // watchlist sweep is still in flight. That chrome prints whatever string the
  // manifest binding hands it and has no skeleton vocabulary, so the unread
  // state has to arrive there as words. Deliberately short: it renders inside a
  // narrow stat tile beside its own label ("Total NEO", "Founders"), where the
  // PlayArea's fuller "Reading public chain data" would truncate.
  treasuryStatAwaitingRead: { en: "Reading…", zh: "读取中…" },
  treasuryInfo: { en: "Treasury Info", zh: "国库信息" },
  treasuryLiveStatus: { en: "Live balance status", zh: "实时余额状态" },
  treasuryLiveSynced: { en: "Live balances synced", zh: "实时余额已同步" },
  treasuryLiveLoading: { en: "Reading public chain data", zh: "正在读取公开链上数据" },
  treasuryLivePending: { en: "Live data pending", zh: "实时数据待同步" },
  treasuryStale: { en: "Showing cached data", zh: "显示缓存数据" },
  treasuryEstimatedValue: { en: "Estimated watchlist value", zh: "观察清单估算价值" },
  treasuryAllocationTitle: { en: "Watchlist allocation", zh: "观察清单分配" },
  treasuryAllocationCaption: {
    en: "USD valuation by attributed group — an estimate, not a spendable wallet balance.",
    zh: "按社区归属分组的美元估值 —— 这是估算值，不是可支出钱包余额。",
  },
  treasuryPartialTotals: {
    en: "Partial totals — unavailable wallets excluded",
    zh: "部分汇总 —— 已排除无法读取的钱包",
  },
  treasuryNativeOnly: { en: "Native balances only", zh: "仅显示原生余额" },
  treasuryPriceFresh: { en: "On-chain price quote is fresh", zh: "链上价格报价新鲜" },
  treasuryPriceDelayed: { en: "On-chain price quote is delayed", zh: "链上价格报价延迟" },
  treasuryPriceUnavailableShort: { en: "USD valuation unavailable", zh: "美元估值不可用" },
  treasuryPriceRecord: { en: "Price record", zh: "价格记录时间" },
  treasuryBalancesReadAt: { en: "Balances read", zh: "余额读取时间" },
  treasuryWalletsUnreachable: {
    en: "wallets unreachable",
    zh: "个钱包无法访问",
  },
  treasuryPriceFeedUnavailable: {
    en: "USD conversion paused — showing native NEO/GAS balances",
    zh: "美元换算已暂停 — 显示原生 NEO/GAS 余额",
  },
  treasuryWatchlistNetwork: { en: "Watchlist network", zh: "观察清单网络" },
  treasuryPendingHint: { en: "Public balances load independently from connected-wallet payout actions.", zh: "公开余额读取与连接钱包支出操作相互独立。" },
  treasurySyncedHint: { en: "Totals are assembled from public NEO and GAS balances.", zh: "总额由公开 NEO 与 GAS 余额汇总。" },
  treasuryReadOnlyRoute: { en: "Transparency and payout route", zh: "透明度与支出路径" },
  treasuryWatchlist: { en: "Watched treasury groups", zh: "已监控国库分组" },
  treasuryAttributionNotice: {
    en: "These addresses are community-attributed and read-only. This list is not an official ownership registry.",
    zh: "这些地址由社区归属且仅供只读观察；本清单不是官方所有权登记。",
  },
  treasuryAddressSource: { en: "Open address-list reference", zh: "打开地址清单参考来源" },
  treasuryBalanceUnavailable: { en: "Balance unavailable", zh: "余额不可用" },
  watchlistMainnetBadge: { en: "Mainnet watchlist", zh: "主网观察清单" },
  treasuryGroup: { en: "Treasury group", zh: "国库分组" },
  operationsTitle: { en: "Treasury operations", zh: "国库操作" },
  operationsEyebrow: { en: "Connected wallet", zh: "已连接钱包" },
  operationsGuardrail: { en: "Policy boundary", zh: "策略边界" },
  disbursementTitle: { en: "Transfer desk", zh: "转账台" },
  disbursementBoundary: {
    en: "Submit a native NEO/GAS transfer only from the connected wallet; watched public addresses remain strictly observational.",
    zh: "仅从已连接钱包提交原生 NEO/GAS 转账；公开观察地址始终保持严格只读。",
  },
  treasuryFlowTitle: { en: "Verified wallet transfer", zh: "可核验钱包转账" },
  treasuryFlowSubtitle: {
    en: "Review the exact network, native token, source wallet, recipient, and amount before the wallet opens.",
    zh: "在打开钱包前核查精确网络、原生代币、来源钱包、收款人和金额。",
  },
  treasuryFlowSource: { en: "Source wallet", zh: "来源钱包" },
  treasuryFlowAsset: { en: "Asset ready", zh: "资产就绪" },
  treasuryFlowRecipient: { en: "Recipient", zh: "收款人" },
  treasuryFlowSignature: { en: "Wallet signature", zh: "钱包签名" },
  treasuryFlowChecks: { en: "Payout readiness checks", zh: "支出就绪检查" },
  treasuryFlowIdle: { en: "Connect or draft a payout", zh: "连接钱包或起草支出" },
  treasuryFlowDraft: { en: "Draft in progress", zh: "草稿准备中" },
  treasuryFlowReady: { en: "Ready for wallet review", zh: "可进入钱包审核" },
  treasuryFlowSigning: { en: "Awaiting wallet signature", zh: "等待钱包签名" },
  treasuryFlowError: { en: "Fix payout details", zh: "修正支出详情" },
  policyTitle: { en: "Treasury control path", zh: "国库控制路径" },
  policyCopy: {
    en: "The public Mainnet watchlist and the connected-wallet transfer are separate. The app never controls or signs for watched wallets.",
    zh: "主网公开观察清单与已连接钱包转账彼此独立。本应用绝不控制观察地址，也不会代表其签名。",
  },
  policyStep1: { en: "Review public balances", zh: "核查公开余额" },
  policyStep2: { en: "Prepare payout intent", zh: "准备支出意图" },
  policyStep3: { en: "Match event and balance state", zh: "匹配事件与余额状态" },
  payoutNetwork: { en: "Transfer network", zh: "转账网络" },
  executionModel: { en: "Execution model", zh: "执行模式" },
  executionModelDirect: { en: "Direct native-token transfer", zh: "原生代币直接转账" },
  governanceLayer: { en: "Proposal / quorum", zh: "提案 / 法定人数" },
  governanceLayerNone: { en: "Not configured", zh: "未配置" },
  governanceBoundary: {
    en: "No treasury contract, proposal ID, quorum, admin role, or on-chain expiry is configured. Use a governed multisig product when those controls are required.",
    zh: "当前未配置国库合约、提案 ID、法定人数、管理员角色或链上到期时间。需要这些控制时，应使用治理型多签产品。",
  },
  walletRequired: { en: "Wallet required", zh: "需要钱包" },
  walletConnected: { en: "Wallet connected", zh: "钱包已连接" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  network: { en: "Network", zh: "网络" },
  networkMainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  networkTestnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  networkUnverified: { en: "Network unverified", zh: "网络未验证" },
  // A bare "Network unverified" badge sat directly above the scene's green
  // "Mainnet watchlist · Live balances synced" chip and read as a flat
  // contradiction — two different networks, one word. Name the subject: this
  // badge is about the payout network only. The unverified state itself is
  // unchanged (payouts still fail closed).
  payoutNetworkUnverified: { en: "Payout network unverified", zh: "支付网络未验证" },
  treasuryPayoutNetworkHint: {
    en: "Payouts stay closed until this app is opened with a Neo N3 Mainnet or Testnet launch network. The watchlist balances above are a public read and are unaffected.",
    zh: "在以 Neo N3 主网或测试网启动本应用之前，支付保持关闭。上方观察清单余额为公开读取数据，不受影响。",
  },
  status: { en: "Status", zh: "状态" },
  asset: { en: "Asset", zh: "资产" },
  assetGasHint: { en: "Fee token, fine-grained", zh: "手续费资产，支持小数" },
  assetGasMeta: { en: "8 decimals", zh: "8 位小数" },
  assetNeoHint: { en: "Governance token", zh: "治理资产" },
  assetNeoMeta: { en: "Whole units", zh: "整数转账" },
  amount: { en: "Amount", zh: "金额" },
  recipient: { en: "Recipient", zh: "收款地址" },
  // Source/destination clarity: the payout is funded by the connected wallet,
  // NOT the watched foundation treasury, and can go to any Neo address.
  fromYourWallet: { en: "From: your connected wallet", zh: "来源：你已连接的钱包" },
  recipientCaption: {
    en: "Any Neo address — paid from your wallet, not the watched treasury.",
    zh: "任意 Neo 地址 —— 由你的钱包支付，而非被监控的国库。",
  },
  yourWalletHeading: { en: "Your wallet", zh: "你的钱包" },
  useAsRecipient: { en: "Use as recipient", zh: "用作收款人" },
  // Price dashboard source disclosure — USD totals come from a Morpheus data
  // feed that may lag the live market.
  priceFeedSourceNote: {
    en: "USD totals use a Morpheus on-chain price feed and may be delayed or stale.",
    zh: "美元总额来自 Morpheus 链上价格源，可能存在延迟或过期。",
  },
  memo: { en: "Memo", zh: "备注" },
  memoDetails: { en: "Memo / reference", zh: "备注 / 参考信息" },
  amountPresets: { en: "Amount presets", zh: "金额预设" },
  intentTitle: { en: "Signing intent", zh: "签名意图" },
  intentReady: { en: "NEP-17 transfer ready", zh: "NEP-17 转账已就绪" },
  intentWaiting: { en: "Draft payout ticket", zh: "起草支出票据" },
  intentWaitingCopy: {
    en: "Enter an amount and recipient to preview the exact native contract, fixed amount, and Hash160 recipient before wallet signing.",
    zh: "输入金额和收款人后，可在钱包签名前预览原生合约、定点金额和 Hash160 收款人。",
  },
  intentIssue: { en: "Fix payout details", zh: "修正支出详情" },
  intentContract: { en: "Native contract", zh: "原生合约" },
  intentFixed8: { en: "Fixed amount", zh: "定点金额" },
  intentRecipientHash: { en: "Recipient Hash160", zh: "收款 Hash160" },
  intentExactBinding: { en: "Exact transfer binding", zh: "精确转账绑定" },
  intentSigner: { en: "Signer", zh: "签名钱包" },
  intentSignerConnect: { en: "Connect on submit", zh: "提交时连接" },
  submitDisbursement: { en: "Review in Wallet", zh: "在钱包中审核" },
  connectAndSignDisbursement: { en: "Connect & Review Transfer", zh: "连接并审核转账" },
  disbursementDraftReady: { en: "Draft ready", zh: "草稿就绪" },
  disbursementSigning: { en: "Awaiting wallet signature", zh: "等待钱包签名" },
  disbursementSubmitted: { en: "Transfer broadcast", zh: "转账已广播" },
  disbursementPendingTitle: { en: "Transfer awaiting proof", zh: "转账等待证明" },
  disbursementConfirmedTitle: { en: "Transfer confirmed", zh: "转账已确认" },
  disbursementConfirmationPending: {
    en: "Broadcast recorded; waiting for the exact Transfer event and balance readback.",
    zh: "已记录广播；正在等待精确 Transfer 事件与余额回读。",
  },
  disbursementCheckingConfirmation: { en: "Checking on-chain proof…", zh: "正在检查链上证明…" },
  disbursementConfirmed: {
    en: "Exact Transfer event and balance state confirmed",
    zh: "精确 Transfer 事件与余额状态均已确认",
  },
  disbursementBindingMismatch: {
    en: "The indexed transaction does not match this saved transfer binding. Do not resubmit; inspect the transaction before clearing recovery.",
    zh: "索引到的交易与已保存转账绑定不匹配。请勿重新提交；应先检查该交易再处理恢复记录。",
  },
  disbursementReadbackPending: {
    en: "Transfer event matched; authoritative balance readback is still catching up.",
    zh: "Transfer 事件已匹配；权威余额回读仍在同步。",
  },
  disbursementConfirmationUnavailable: {
    en: "Confirmation service is temporarily unavailable. The saved txid can be checked again without rebroadcasting.",
    zh: "确认服务暂时不可用。可稍后使用已保存交易 ID 再次检查，不会重复广播。",
  },
  disbursementRecoveryStorageUnavailable: {
    en: "Transfer was broadcast, but local recovery storage is unavailable. Keep this page open while confirmation is checked.",
    zh: "转账已广播，但本地恢复存储不可用。请保持此页面打开，等待确认检查完成。",
  },
  checkTransferConfirmation: { en: "Check Transfer Proof", zh: "检查转账证明" },
  pendingNoRebroadcast: {
    en: "Checking this record never signs or broadcasts another transfer.",
    zh: "检查此记录不会再次签名或广播转账。",
  },
  // Raised by `normalizeTreasuryNetwork` on the WALLET network at signing time
  // (see assertTreasuryWalletNetwork) — accurate there, where a wallet exists.
  treasuryErrorNetworkUnverified: {
    en: "Wallet network could not be verified as Neo N3 Mainnet or Testnet.",
    zh: "无法确认钱包是否处于 Neo N3 主网或测试网。",
  },
  // The launch-context counterpart. The PlayArea used to borrow the wallet
  // message above for this, so a cold visit with no wallet connected announced
  // that a wallet's network had failed verification — blaming a wallet that
  // does not exist for a fact about how the app was opened.
  treasuryErrorPayoutNetworkUnverified: {
    en: "Payout network could not be verified as Neo N3 Mainnet or Testnet. Open this app from the Neo MiniApp catalog.",
    zh: "无法确认支付网络为 Neo N3 主网或测试网。请从 Neo 小程序目录打开本应用。",
  },
  treasuryErrorNetworkMismatch: {
    en: "Wallet is on {current}; switch to Neo N3 {expected} before signing.",
    zh: "钱包当前位于 {current}；请在签名前切换到 Neo N3 {expected}。",
  },
  treasuryErrorAsset: { en: "Choose NEO or GAS.", zh: "请选择 NEO 或 GAS。" },
  treasuryErrorRecipient: {
    en: "Enter a valid Neo N3 recipient address or Hash160.",
    zh: "请输入有效的 Neo N3 收款地址或 Hash160。",
  },
  treasuryErrorAddress: {
    en: "The wallet address could not be verified.",
    zh: "无法验证钱包地址。",
  },
  treasuryErrorAmountNumber: { en: "Enter a positive amount.", zh: "请输入正数金额。" },
  treasuryErrorNeoWhole: { en: "NEO transfers use whole tokens only.", zh: "NEO 转账只支持整数代币。" },
  treasuryErrorGasDecimals: { en: "GAS supports at most eight decimal places.", zh: "GAS 最多支持八位小数。" },
  treasuryErrorAmountPositive: { en: "Amount must be greater than zero.", zh: "金额必须大于零。" },
  treasuryErrorWalletRequired: { en: "Connect a wallet before submitting.", zh: "请先连接钱包再提交。" },
  treasuryErrorSelfTransfer: {
    en: "Choose a recipient different from the connected wallet.",
    zh: "请选择与已连接钱包不同的收款人。",
  },
  treasuryErrorReviewTime: { en: "Transfer review time is invalid.", zh: "转账审核时间无效。" },
  treasuryErrorMemoLength: { en: "Memo must be 120 characters or fewer.", zh: "备注不能超过 120 个字符。" },
  treasuryErrorBalanceRead: {
    en: "Token balance could not be verified on-chain. Try again before signing.",
    zh: "无法在链上验证代币余额。请重试后再签名。",
  },
  treasuryErrorInsufficientBalance: {
    en: "Insufficient {asset} balance for this transfer.",
    zh: "{asset} 余额不足，无法完成此转账。",
  },
  treasuryErrorGasHeadroom: {
    en: "Keep some GAS for network fees; do not transfer the entire GAS balance.",
    zh: "请保留部分 GAS 支付网络费；不要转出全部 GAS 余额。",
  },
  treasuryErrorTxid: { en: "Wallet returned an invalid transaction hash.", zh: "钱包返回了无效的交易哈希。" },
  treasuryErrorBroadcastTime: { en: "Transaction broadcast time is invalid.", zh: "交易广播时间无效。" },
  disbursementFailed: { en: "Disbursement failed", zh: "支出失败" },
  lastTx: { en: "Last tx", zh: "最近交易" },
  refreshData: { en: "Refresh Data", zh: "刷新数据" },
  tokenNeo: { en: "NEO", zh: "NEO" },
  tokenGas: { en: "GAS", zh: "GAS" },
  // USD-denominated regardless of locale — both locales use the $ prefix so a
  // zh user never sees "¥4,123,456" for a dollar figure.
  currencySymbol: { en: "$", zh: "$" },
  trendUp: { en: "▲", zh: "▲" },
  trendDown: { en: "▼", zh: "▼" },
  approxEqual: { en: "≈ ", zh: "≈ " },
  idPrefix: { en: "#", zh: "#" },
  founders: { en: "Founders", zh: "创始人" },
  wallets: { en: "wallets", zh: "个钱包" },
  wallet: { en: "Wallet", zh: "钱包" },
  walletList: { en: "Wallet List", zh: "钱包列表" },
  addresses: { en: "addresses", zh: "个地址" },
  fullAddress: { en: "Full Address", zh: "完整地址" },
  breakdown: { en: "Breakdown", zh: "明细" },
  lastUpdated: { en: "Last updated", zh: "最后更新" },
  loading: { en: "Loading...", zh: "加载中..." },
  retry: { en: "Retry", zh: "重试" },
  // Watchdog empty state: shown when the first balance load has not resolved
  // within the timeout (e.g. no chain/host context), so the dashboard never
  // sits on an indefinite spinner.
  treasuryLoadTimeout: {
    en: "Public balances did not load",
    zh: "未能加载公开余额",
  },
  treasuryLoadTimeoutHint: {
    en: "The chain read is taking longer than expected. Retry to fetch live balances.",
    zh: "链上读取耗时超出预期。请重试以获取实时余额。",
  },
  // Compact reference shown in the resting watchlist viewport before the first
  // load resolves — keeps the lower viewport informative instead of blank.
  watchlistReference: {
    en: "Watched groups",
    zh: "监控分组",
  },
  watchlistReferenceHint: {
    en: "Da Hongfei and Erik Zhang wallet groups load read-only from public mainnet data.",
    zh: "Da Hongfei 与 Erik Zhang 钱包组以只读方式从公开主网数据加载。",
  },
  refresh: { en: "Refresh", zh: "刷新" },
} as const;

export const messages = mergeMessages(appMessages);
