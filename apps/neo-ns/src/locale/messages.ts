import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  // App translations
  title: { en: "Neo Name Service", zh: "Neo 域名服务" },
  searchPlaceholder: { en: "Search for a .neo domain", zh: "搜索 .neo 域名" },
  available: { en: "Available", zh: "可用" },
  taken: { en: "Taken", zh: "已被占用" },
  registrationPrice: { en: "Registration Price", zh: "注册价格" },
  perYear: { en: "/ year", zh: "/ 年" },
  registerNow: { en: "Register Now", zh: "立即注册" },
  processing: { en: "Processing...", zh: "处理中..." },
  owner: { en: "Owner", zh: "所有者" },
  noDomains: { en: "You don't own any domains yet", zh: "您还没有域名" },
  noDomainsHint: {
    en: "Search for a name above to claim your first .neo domain.",
    zh: "在上方搜索名称，认领您的第一个 .neo 域名。",
  },
  noDomainsConnectHint: {
    en: "Connect your wallet to see the domains you own, or search for a name above to claim one.",
    zh: "连接钱包以查看您拥有的域名，或在上方搜索名称进行认领。",
  },
  tryExample: { en: "Try an example", zh: "试试示例" },
  expires: { en: "Expires", zh: "到期时间" },
  // Post-expiry state: a lapsed domain shows an Expired badge + a hint that
  // renewal may no longer guarantee ownership (the name can be re-claimed).
  expired: { en: "Expired", zh: "已过期" },
  expiredHint: {
    en: "This name has lapsed. Renewing may no longer keep it — once expired, the name can be re-registered by anyone.",
    zh: "该域名已过期。续费可能无法保留它——过期后，任何人都可以重新注册该名称。",
  },
  manage: { en: "Manage", zh: "管理" },
  renew: { en: "Renew", zh: "续费" },
  registered: { en: "registered!", zh: "已注册！" },
  renewed: { en: "renewed!", zh: "已续费！" },
  registrationFailed: { en: "Registration failed", zh: "注册失败" },
  renewalFailed: { en: "Renewal failed", zh: "续费失败" },
  availabilityFailed: {
    en: "Failed to check availability",
    zh: "查询可用性失败",
  },
  connectWalletFirst: {
    en: "Please connect your wallet first",
    zh: "请先连接钱包",
  },
  unknownOwner: { en: "Unknown", zh: "未知" },
  managing: { en: "Managing", zh: "管理中" },
  tabRegister: { en: "Register", zh: "注册" },
  tabDomains: { en: "Domains", zh: "域名" },
  premium: { en: "Premium", zh: "高级" },
  docSubtitle: {
    en: "Human-readable .neo domain names for Neo addresses",
    zh: "Neo 地址的人类可读 .neo 域名",
  },
  heroCopy: {
    en: "Find a clean .neo name, check its owner and price, then register or manage it from the same focused workspace.",
    zh: "查找简洁的 .neo 名称，确认所有者与价格，然后在同一个专注工作台中注册或管理。",
  },
  heroAlt: {
    en: "Glass registry desk with floating identity cards for Neo names",
    zh: "带有悬浮身份卡片的 Neo 域名玻璃注册台",
  },
  routeLabel: { en: "Name lifecycle", zh: "域名生命周期" },
  routeSearch: { en: "Search", zh: "搜索" },
  routePrice: { en: "Price", zh: "价格" },
  routeOwn: { en: "Own", zh: "拥有" },
  walletReady: { en: "Wallet ready", zh: "钱包已就绪" },
  walletNeeded: { en: "Connect to register", zh: "连接后可注册" },
  finderEyebrow: { en: "Domain finder", zh: "域名查找器" },
  finderTitle: {
    en: "Search a name before you spend GAS",
    zh: "先查名称，再花费 GAS",
  },
  resultAvailableCopy: {
    en: "This name is open. Review the annual contract price, then register it; your wallet will also show the network fee.",
    zh: "该名称可注册。确认年度合约价格后即可注册；钱包还会显示网络手续费。",
  },
  resultTakenCopy: {
    en: "This name already belongs to another owner. Review the owner and expiry before choosing another name.",
    zh: "该名称已有所有者。请查看所有者和到期时间，再选择其他名称。",
  },
  resultIdleEyebrow: { en: "Ready to inspect", zh: "准备查询" },
  // Eyebrow for the pure-idle card, where there is no name and so no
  // availability to report. Naming the card keeps the eyebrow from echoing the
  // title (`resultIdleTitle`) directly beneath it.
  resultIdleStatus: { en: "Name lookup", zh: "名称查询" },
  resultIdleTitle: { en: "Choose a .neo name", zh: "选择一个 .neo 名称" },
  resultIdleCopy: {
    en: "Type a name or tap a suggestion. Availability, owner and annual price will appear here.",
    zh: "输入名称或选择建议。可用性、所有者和年度价格会显示在这里。",
  },
  docDescription: {
    en: "Neo Name Service lets you register memorable .neo domains that map to your wallet address. Send and receive assets using simple names like alice.neo instead of complex addresses.",
    zh: "Neo 域名服务让您注册易记的 .neo 域名，映射到您的钱包地址。使用简单的名称如 alice.neo 发送和接收资产，而不是复杂的地址。",
  },
  step1: {
    en: "Connect your Neo wallet and search for available domain names",
    zh: "连接您的 Neo 钱包并搜索可用域名",
  },
  step2: {
    en: "Check availability and pricing (shorter names are premium)",
    zh: "检查可用性和价格（较短的名称为高级域名）",
  },
  step3: {
    en: "Register your domain by paying the registration fee in GAS",
    zh: "支付 GAS 注册费来注册您的域名",
  },
  step4: {
    en: "Manage your domains - renew before expiry to keep ownership",
    zh: "管理您的域名 - 在到期前续费以保持所有权",
  },
  feature1Name: { en: "Simple Addresses", zh: "简单地址" },
  feature1Desc: {
    en: "Replace complex wallet addresses with memorable .neo names.",
    zh: "用易记的 .neo 名称替换复杂的钱包地址。",
  },
  feature2Name: { en: "Full Ownership", zh: "完全所有权" },
  feature2Desc: {
    en: "Your domain is an NFT - transfer, sell, or manage it freely.",
    zh: "您的域名是 NFT - 可自由转让、出售或管理。",
  },
  feature3Name: { en: "Renewal & Expiry", zh: "续费与到期" },
  feature3Desc: {
    en: "Track expiry dates and renew to keep ownership.",
    zh: "跟踪到期时间并续费保持所有权。",
  },
  invalidAddress: { en: "Invalid address", zh: "无效地址" },
  targetSet: { en: "Target address set!", zh: "目标地址已设置！" },
  transferred: { en: "Domain transferred!", zh: "域名已转让！" },
  setTarget: { en: "Set Target Address", zh: "设置目标地址" },
  transferDomain: { en: "Transfer Domain", zh: "转让域名" },
  targetAddress: { en: "Target Address", zh: "目标地址" },
  receiverAddress: { en: "Receiver Address", zh: "接收人地址" },
  cancelManage: { en: "Back to List", zh: "返回列表" },
  manageTitle: { en: "Manage Domain", zh: "管理域名" },
  currentOwner: { en: "Current Owner", zh: "当前所有者" },
  currentExpiry: { en: "Expiry Date", zh: "到期日期" },
  currentTarget: { en: "Current Target", zh: "当前目标地址" },
  notSet: { en: "Not Set", zh: "未设置" },
  invalidAddressHint: {
    en: "Enter a valid Neo N3 address (starts with N, 34 characters).",
    zh: "请输入有效的 Neo N3 地址（以 N 开头，共 34 个字符）。",
  },
  targetAlreadySet: {
    en: "This name already resolves to that address.",
    zh: "该域名当前已解析到这个地址。",
  },
  targetActionCopy: {
    en: "Point this name at the address people should pay or resolve.",
    zh: "把该域名指向他人应付款或解析到的地址。",
  },
  transferActionCopy: {
    en: "Move the domain NFT to another Neo address after you verify the receiver.",
    zh: "确认接收方后，将该域名 NFT 转移到另一个 Neo 地址。",
  },
  sidebarWallet: { en: "Wallet", zh: "钱包" },
  sidebarExpiringSoon: { en: "Expiring Soon", zh: "即将到期" },
  readyToSearch: { en: "Ready to search", zh: "可以查询" },
  checkingName: { en: "Checking name", zh: "正在查询" },
  readyToRegister: { en: "Ready to register", zh: "可以注册" },
  nameUnavailable: { en: "Name unavailable", zh: "名称不可用" },
  nameInputLabel: { en: "Find a name", zh: "查找名称" },
  suggestionsLabel: { en: "Try", zh: "试试" },
  resultPanelLabel: { en: "Registration status", zh: "注册状态" },
  registrationCostPending: { en: "Check after search", zh: "查询后显示" },
  searchHint: {
    en: "Names resolve to wallet addresses. Register only after you verify spelling and ownership.",
    zh: "域名会解析到钱包地址。请确认拼写与归属后再注册。",
  },
  drawerTitle: { en: "Domains and lifecycle", zh: "域名与生命周期" },
  drawerDomains: { en: "Domains", zh: "域名" },
  drawerExpiring: { en: "Expiring", zh: "即将到期" },
  drawerManage: { en: "Manage", zh: "管理" },
  drawerGuide: { en: "Guide", zh: "指南" },
  noExpiringDomains: {
    en: "No domains are expiring in the next 30 days.",
    zh: "未来 30 天内没有即将到期的域名。",
  },
  searchDomain: { en: "Search Domain", zh: "搜索域名" },
  expiringSoon: { en: "Expiring", zh: "即将到期" },
  walletStatus: { en: "Wallet", zh: "钱包" },
  connected: { en: "Connected", zh: "已连接" },
  disconnected: { en: "Disconnected", zh: "未连接" },
  domainSuffix: { en: ".neo", zh: ".neo" },
  myDomains: { en: "My Domains", zh: "我的域名" },
  registerDomain: { en: "Register", zh: "注册" },
  search: { en: "Search", zh: "搜索" },
  enterDomainName: { en: "myname", zh: "myname" },
  enterDomainNameError: {
    en: "Enter a domain name to search",
    zh: "请输入要搜索的域名",
  },
  connectedAddress: { en: "Address", zh: "地址" },
  domainAvailable: { en: "Available", zh: "可用" },
  domainTaken: { en: "Taken", zh: "已被占用" },
  nameRestricted: { en: "Reserved", zh: "保留名称" },
  resultRestrictedCopy: {
    en: "This short name is reserved by the NNS price policy and is not open for public registration.",
    zh: "该短名称受 NNS 定价策略保留，目前不开放公开注册。",
  },
  notForPublicRegistration: { en: "Not publicly priced", zh: "未开放公开定价" },
  registrationCost: { en: "Cost", zh: "费用" },
  register: { en: "Register", zh: "注册" },
  eyebrow: { en: "Name Service", zh: "域名服务" },
  // Renewal confirmation (renew fires a paid wallet tx — disclose cost first).
  renewConfirm: {
    en: "Renew {name} for {cost} GAS (+1 year)?",
    zh: "续费 {name}，费用 {cost} GAS（+1 年）？",
  },
  confirmRenew: { en: "Confirm renew", zh: "确认续费" },
  cancel: { en: "Cancel", zh: "取消" },
  // "How .neo names work" reference strip — fills the resting viewport with
  // pricing + lifecycle facts so the page reads as a guide, not empty space.
  howTitle: { en: "How .neo names work", zh: ".neo 域名如何运作" },
  howSearchLabel: { en: "1 · Search", zh: "1 · 搜索" },
  howSearchDesc: {
    en: "Look up any name to see if it is available or who holds it.",
    zh: "查询任意名称，查看是否可用或归谁所有。",
  },
  howPriceLabel: { en: "2 · Price", zh: "2 · 价格" },
  howPriceDesc: {
    en: "Pay a GAS fee per year. Shorter names are premium and cost more.",
    zh: "按年支付 GAS 费用。较短的名称为高级域名，费用更高。",
  },
  howOwnLabel: { en: "3 · Own", zh: "3 · 拥有" },
  howOwnDesc: {
    en: "Your domain is an NFT — point it at an address, transfer, or sell it.",
    zh: "您的域名是一个 NFT — 可指向地址、转让或出售。",
  },
  howRenewLabel: { en: "4 · Renew", zh: "4 · 续费" },
  howRenewDesc: {
    en: "Renew before expiry to keep ownership; lapsed names can be re-claimed.",
    zh: "在到期前续费以保持所有权；过期的名称可被重新认领。",
  },
  howNote: {
    en: "Names map to wallet addresses, so people can pay you at alice.neo instead of a long address.",
    zh: "名称映射到钱包地址，因此他人可以向 alice.neo 付款，而无需使用冗长的地址。",
  },
  networkMismatch: {
    en: "The wallet network does not match this MiniApp launch. Switch networks and try again.",
    zh: "钱包网络与当前小程序网络不一致。请切换网络后重试。",
  },
  networkUnverified: {
    en: "The active Neo network could not be verified.",
    zh: "无法确认当前 Neo 网络。",
  },
  contractUnavailable: {
    en: "The official NNS contract is not configured for this network.",
    zh: "当前网络未配置官方 NNS 合约。",
  },
  contractMismatch: {
    en: "The connected contract does not match the official NNS deployment.",
    zh: "当前连接的合约与官方 NNS 部署不一致。",
  },
  walletAddressInvalid: {
    en: "The connected wallet did not provide a valid Neo N3 address.",
    zh: "已连接钱包未提供有效的 Neo N3 地址。",
  },
  invalidDomainName: {
    en: "Use 1–63 lowercase letters or numbers; hyphens may appear only inside the name.",
    zh: "名称需为 1–63 个小写字母或数字，连字符只能位于名称中间。",
  },
  priceReadFailed: { en: "The live NNS price could not be verified.", zh: "无法确认实时 NNS 价格。" },
  domainsLoadFailed: {
    en: "Owned names could not be refreshed. The last verified list is preserved.",
    zh: "无法刷新持有域名，已保留上次确认的列表。",
  },
  chainContextFailed: {
    en: "Neo network and NNS contract status could not be verified.",
    zh: "无法确认 Neo 网络与 NNS 合约状态。",
  },
  searchAgainBeforeRegister: {
    en: "Search this exact name again before registering.",
    zh: "注册前请重新查询这个准确名称。",
  },
  availabilityChanged: {
    en: "Availability or price changed. Review a fresh search before registering.",
    zh: "可用性或价格已变化，请重新查询并确认后再注册。",
  },
  domainOwnerMismatch: {
    en: "The connected wallet is no longer the verified owner of this name.",
    zh: "当前钱包已不是该域名经链上确认的所有者。",
  },
  invalidTransferAddress: {
    en: "Enter a different valid Neo N3 receiver address.",
    zh: "请输入另一个有效的 Neo N3 接收地址。",
  },
  renewQuoteRequired: { en: "Review the live renewal quote first.", zh: "请先查看实时续费报价。" },
  renewQuoteChanged: {
    en: "The renewal price or expiry changed. Review a fresh quote.",
    zh: "续费价格或到期时间已变化，请重新确认报价。",
  },
  renewQuoteStale: {
    en: "The selected name or wallet changed before the renewal quote completed.",
    zh: "续费报价完成前，所选域名或钱包已发生变化。",
  },
  resolvePendingFirst: {
    en: "Resolve the previous wallet transaction before starting another action.",
    zh: "开始新操作前，请先恢复上一笔钱包交易。",
  },
  operationInProgress: {
    en: "Another name action is still in progress.",
    zh: "另一个域名操作仍在进行中。",
  },
  transactionNotBroadcast: {
    en: "The wallet did not return a broadcast transaction.",
    zh: "钱包未返回已广播的交易。",
  },
  transactionResponseUncertain: {
    en: "The wallet reported an incomplete result for {txid}. Keep the recovery receipt and verify it before trying again.",
    zh: "钱包对交易 {txid} 返回了不完整结果。请保留恢复凭据并先确认该交易，不要重复提交。",
  },
  transactionReceiptMissing: {
    en: "The wallet response did not contain a valid transaction receipt.",
    zh: "钱包响应中没有有效的交易凭据。",
  },
  transactionPending: {
    en: "Transaction {txid} is broadcast but not yet confirmed. Use Recover confirmation; do not submit twice.",
    zh: "交易 {txid} 已广播但尚未确认。请使用“恢复确认”，不要重复提交。",
  },
  transactionReadbackPending: {
    en: "Transaction {txid} reached HALT, but its exact NNS event and readback are not aligned yet. Recover again shortly.",
    zh: "交易 {txid} 已到达 HALT，但 NNS 事件与链上回读尚未完全一致。请稍后再次恢复。",
  },
  transactionFault: {
    en: "Transaction {txid} FAULTed on-chain. No success state was applied.",
    zh: "交易 {txid} 链上执行 FAULT，未应用任何成功状态。",
  },
  transactionConfirmed: {
    en: "Confirmed from the exact NNS receipt and chain readback ({txid}).",
    zh: "已通过准确的 NNS 交易凭据与链上回读确认（{txid}）。",
  },
  recoveryStorageFailed: {
    en: "Transaction {txid} was broadcast, but durable recovery storage is unavailable. Keep this txid.",
    zh: "交易 {txid} 已广播，但持久恢复存储不可用。请保存该交易号。",
  },
  recoveryStorageUnavailable: {
    en: "Transaction recovery storage is unavailable. No wallet request was sent.",
    zh: "交易恢复存储不可用，未向钱包发送请求。",
  },
  recoveryStorageUnavailableInline: {
    en: "Name search still works, but wallet actions are paused because this browser cannot preserve a recovery receipt.",
    zh: "域名查询仍可使用，但当前浏览器无法保存恢复凭据，钱包操作已暂停。",
  },
  transactionConfirmedStorageStale: {
    en: "Transaction confirmed on-chain ({txid}), but the local recovery receipt could not be cleared.",
    zh: "交易已在链上确认（{txid}），但本地恢复凭据无法清除。",
  },
  transactionConfirmedWalletChanged: {
    en: "Transaction confirmed for the original wallet ({txid}). Refresh names for the wallet that is connected now.",
    zh: "原钱包的交易已确认（{txid}）。请为当前连接的钱包刷新域名列表。",
  },
  pendingContextMismatch: {
    en: "Reconnect the original wallet and network to recover this transaction.",
    zh: "请连接原钱包与原网络以恢复这笔交易。",
  },
  recovered: { en: "Transaction confirmed", zh: "交易已确认" },
  confirmationPending: { en: "Confirmation pending", zh: "等待链上确认" },
  checkingConfirmation: { en: "Checking confirmation", zh: "正在检查确认" },
  recoverConfirmation: { en: "Recover confirmation", zh: "恢复确认" },
  copyTxid: { en: "Copy txid", zh: "复制交易号" },
  txidCopied: { en: "Transaction ID copied", zh: "交易号已复制" },
  copyFailed: { en: "Could not copy the transaction ID", zh: "无法复制交易号" },
  pendingActionName: { en: "Pending · {name}", zh: "待确认 · {name}" },
  pendingActionCopy: {
    en: "The wallet transaction may already be on-chain. Verify it before another action.",
    zh: "钱包交易可能已上链。开始其他操作前请先确认。",
  },
  domainsUnavailable: { en: "Names unavailable", zh: "域名列表不可用" },
  domainsLoading: { en: "Loading names", zh: "正在加载域名" },
  noDomainsShort: { en: "No names yet", zh: "暂无域名" },
  domainCountLabel: { en: "{count} verified names", zh: "{count} 个已确认域名" },
  domainsStaleCopy: {
    en: "Refresh failed. Any names shown below are the last verified snapshot, not a new empty result.",
    zh: "刷新失败。下方如有域名，均为上次确认快照，并非新的空结果。",
  },
  statusUnknown: { en: "Unknown", zh: "未知" },
  mainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  testnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  // Only honest while a check is actually running. On a cold entry nothing is
  // being checked and nothing will be until a network is bound, so these two
  // sat on "Checking…"/"pending" forever next to a red failure banner.
  networkChecking: { en: "Checking network", zh: "正在确认网络" },
  contractChecking: { en: "Contract pending", zh: "正在确认合约" },
  networkAwaitingWallet: { en: "Connect to confirm network", zh: "连接钱包以确认网络" },
  contractAwaitingWallet: { en: "Confirmed on connect", zh: "连接后确认" },
  transferReviewCopy: {
    en: "This moves the name NFT to {address}. Its current target does not change automatically, so confirm only after checking the receiver.",
    zh: "这会把域名 NFT 转给 {address}。当前解析目标不会自动改变，请核对接收方后再确认。",
  },
  reviewTransfer: { en: "Review transfer", zh: "审核转让" },
  confirmTransfer: { en: "Confirm transfer", zh: "确认转让" },
  reviewRenewal: { en: "Review renewal price", zh: "查看续费价格" },
  renewQuoteCopy: {
    en: "Renew {name} for a {cost} GAS contract price and extend it by one year; the wallet adds the network fee.",
    zh: "以 {cost} GAS 合约价格为 {name} 续费并延长一年；钱包会另加网络手续费。",
  },
  expiredRenewQuoteCopy: {
    en: "{name} is already expired. The live contract quote is {cost} GAS, but another wallet may re-register it before this transaction confirms.",
    zh: "{name} 已过期。实时合约报价为 {cost} GAS，但在本交易确认前，其他钱包可能重新注册该名称。",
  },
} as const;

export const messages = mergeMessages(appMessages);
