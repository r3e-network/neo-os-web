import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Event Ticket Pass", zh: "活动门票通行证" },
  createTab: { en: "Create", zh: "创建" },
  checkinTab: { en: "Check-in", zh: "核验" },

  contractMissing: {
    en: "Contract address not configured",
    zh: "合约地址未配置",
  },
  deploymentPendingTitle: {
    en: "Contract deployment pending",
    zh: "合约待部署",
  },
  deploymentPendingDesc: {
    en: "The selected network is missing a configured Event Ticket contract address. Switch network or verify deployment configuration before sending on-chain actions.",
    zh: "当前网络缺少活动门票合约地址。请切换网络或确认部署配置后再发送链上操作。",
  },

  eventName: { en: "Event name", zh: "活动名称" },
  eventNamePlaceholder: { en: "Neo Builder Summit", zh: "Neo 开发者峰会" },
  eventVenue: { en: "Venue", zh: "场地" },
  eventVenuePlaceholder: { en: "Shanghai Expo Center", zh: "上海世博中心" },
  eventIdentity: { en: "Event identity", zh: "活动识别信息" },
  eventDetails: { en: "Schedule and capacity", zh: "时间与容量" },
  eventStart: { en: "Start time", zh: "开始时间" },
  eventStartPlaceholder: { en: "2026-08-20 09:00", zh: "2026-08-20 09:00" },
  eventEnd: { en: "End time", zh: "结束时间" },
  eventEndPlaceholder: { en: "2026-08-20 18:00", zh: "2026-08-20 18:00" },
  maxSupply: { en: "Max tickets", zh: "票量上限" },
  maxSupplyPlaceholder: { en: "500", zh: "500" },
  notes: { en: "Notes (optional)", zh: "备注（可选）" },
  notesPlaceholder: {
    en: "VIP access, badges, or extra info",
    zh: "VIP 权益、徽章或其他说明",
  },

  createEvent: { en: "Create Event", zh: "创建活动" },
  eventCreated: { en: "Event created", zh: "活动已创建" },
  creatingEvent: { en: "Creating event...", zh: "创建活动中..." },
  ticketsTab: { en: "Tickets", zh: "票务" },
  ticketsCount: { en: "Tickets", zh: "票数" },
  // Zero-state for the Tickets stat before a wallet is connected, in place of
  // the former "—" void. Short: it sits in a narrow stat tile.
  ticketsNeedWallet: { en: "Connect wallet", zh: "连接钱包" },
  eventSelected: { en: "Event selected", zh: "已选择活动" },
  eventsCountLabel: { en: "{count} events", zh: "{count} 个活动" },

  yourEvents: { en: "Your Events", zh: "我的活动" },
  refresh: { en: "Refresh", zh: "刷新" },
  connectWallet: { en: "Connect Wallet", zh: "连接钱包" },
  wallet: { en: "Wallet", zh: "钱包" },
  walletConnected: { en: "Wallet connected", zh: "钱包已连接" },
  walletNotConnected: { en: "Wallet not connected", zh: "钱包未连接" },
  emptyEvents: { en: "No events yet", zh: "暂无活动" },
  emptyEventsHint: {
    en: "Start with an event on the left. Once it's live you can issue passes to your guests, pause issuance any time, and welcome people in at the door.",
    zh: "先在左侧创建一个活动。活动上线后，您即可向宾客签发通行证、随时暂停签发，并在入口处迎接到场来宾。",
  },
  freePassesNote: {
    en: "Free passes — issued to the addresses you choose. No payment is taken on-chain.",
    zh: "免费通行证 — 由您指定地址签发，链上不收取任何费用。",
  },
  venueFallback: { en: "Venue TBD", zh: "场地待定" },

  statusActive: { en: "Active", zh: "进行中" },
  statusInactive: { en: "Inactive", zh: "已停用" },
  active: { en: "Active", zh: "活跃" },
  eventSchedule: { en: "Schedule", zh: "时间" },
  minted: { en: "Issued", zh: "已签发" },
  soldOut: { en: "All passes issued", zh: "通行证已全部签发" },
  issueTicket: { en: "Issue Ticket", zh: "签发门票" },
  selectEventFirst: { en: "Select an event first", zh: "请先选择活动" },
  eventInactive: { en: "Selected event is inactive", zh: "所选活动已停用" },
  deactivate: { en: "Deactivate", zh: "停用" },
  activate: { en: "Activate", zh: "启用" },

  emptyTickets: { en: "No passes yet", zh: "暂无通行证" },
  emptyTicketsHint: {
    en: "Every pass you hand out shows up here as a keepsake your guests can carry, transfer, and present at the door.",
    zh: "您签发的每一张通行证都会以可收藏的形式显示在这里，宾客可随身携带、转赠，并在入口处出示。",
  },
  samplePreviewLabel: { en: "Preview", zh: "预览" },
  samplePreviewHeading: {
    en: "What your guests will keep",
    zh: "宾客将收藏的样子",
  },
  samplePreviewCaption: {
    en: "A sample of the keepsake pass attendees receive — once you issue one, real passes appear below.",
    zh: "这是参与者将收到的纪念通行证样张——签发后，真实通行证会显示在下方。",
  },
  sampleEventName: { en: "Neo Builder Summit", zh: "Neo 开发者峰会" },
  sampleVenue: { en: "Neo Community Hall", zh: "Neo 社区中心" },
  sampleSeat: { en: "Row A · Seat 12", zh: "A 排 · 12 座" },
  sampleHolder: { en: "Holder", zh: "持有人" },
  sampleHolderName: { en: "Your guest", zh: "您的宾客" },
  sampleAdmitOne: { en: "Admit one", zh: "凭票一人入场" },
  ticketUsed: { en: "Used", zh: "已使用" },
  ticketValid: { en: "Valid", zh: "有效" },
  ticketSeat: { en: "Seat", zh: "座位" },
  ticketOwner: { en: "Owner", zh: "持有人" },
  seatFallback: { en: "General", zh: "普通票" },
  ticketTokenId: { en: "Token ID", zh: "Token ID" },
  copyTokenId: { en: "Copy Token ID", zh: "复制 Token ID" },
  tokenIdCopied: { en: "Token ID copied", zh: "Token ID 已复制" },
  ticketQrLabel: { en: "Ticket token ID QR code", zh: "门票 Token ID 二维码" },
  tokenQrLabel: { en: "Ticket token ID QR code", zh: "门票 Token ID 二维码" },
  tokenQrCaption: {
    en: "Show this QR at the door",
    zh: "在入口处出示此二维码",
  },
  transferTicket: { en: "Transfer", zh: "转赠" },
  transferRecipient: { en: "Transfer to", zh: "转赠给" },
  transferRecipientPlaceholder: { en: "Neo N3 address", zh: "Neo N3 地址" },
  transferSuccess: { en: "Ticket transferred", zh: "门票已转赠" },

  checkinTokenId: { en: "Ticket Token ID", zh: "门票 Token ID" },
  checkinTokenIdPlaceholder: {
    en: "Enter token ID from QR",
    zh: "输入二维码中的 Token ID",
  },
  lookup: { en: "Lookup", zh: "查询" },
  lookingUp: { en: "Looking up...", zh: "查询中..." },
  checkIn: { en: "Check-in", zh: "核验" },
  checkingIn: { en: "Checking in...", zh: "核验中..." },
  checkinSuccess: { en: "Ticket checked in", zh: "门票已核验" },
  checkinHint: {
    en: "Scan or paste a ticket token id to verify seat, owner, and usage before marking it used.",
    zh: "扫描或粘贴门票 Token ID，先核对座位、持有人和使用状态，再标记为已入场。",
  },
  lookupBeforeCheckin: {
    en: "Look up the pass and review its live status before check-in.",
    zh: "请先查询通行证并核对实时状态，再执行入场核验。",
  },
  ticketFound: { en: "Ticket found", zh: "已找到门票" },
  ticketNotFound: { en: "Ticket not found", zh: "未找到门票" },
  ticketAlreadyUsed: { en: "Ticket is already used", zh: "门票已使用" },

  issueTicketTitle: { en: "Issue Ticket", zh: "签发门票" },
  issuePreview: { en: "Pass being issued", zh: "即将签发的通行证" },
  guestLaneLabel: { en: "Guest pass lane", zh: "宾客通行证通道" },
  recentGuests: { en: "Recent guest wallets", zh: "最近宾客钱包" },
  issueRecipient: { en: "Recipient address", zh: "接收地址" },
  issueRecipientPlaceholder: { en: "Neo N3 address", zh: "Neo N3 地址" },
  issueSeat: { en: "Seat / Zone", zh: "座位/区域" },
  issueSeatPlaceholder: { en: "A-12", zh: "A-12" },
  seatLaneLabel: { en: "Seat lane", zh: "座位通道" },
  issueMemo: { en: "Memo (optional)", zh: "备注（可选）" },
  issueMemoPlaceholder: { en: "Backstage pass", zh: "后台通行证" },
  issue: { en: "Issue", zh: "签发" },
  issuing: { en: "Issuing...", zh: "签发中..." },
  ticketIssued: { en: "Ticket issued", zh: "门票已签发" },

  nameRequired: { en: "Event name is required", zh: "活动名称必填" },
  invalidTime: { en: "Invalid event time range", zh: "时间范围无效" },
  invalidSupply: { en: "Invalid ticket supply", zh: "票量无效" },
  invalidRecipient: { en: "Enter a valid Neo N3 recipient address", zh: "请输入有效的 Neo N3 接收地址" },
  invalidTokenId: { en: "Enter a ticket token ID such as 12-3", zh: "请输入类似 12-3 的门票 Token ID" },
  invalidTokenIdHint: {
    en: "Use the event-serial format shown on the pass, for example 12-3.",
    zh: "请使用通行证上的“活动编号-序号”格式，例如 12-3。",
  },
  transactionUnverified: {
    en: "The transaction was broadcast but its matching on-chain event and state could not be verified. Check the explorer before retrying.",
    zh: "交易可能已广播，但尚未核验到匹配的链上事件与状态。重试前请先在区块浏览器确认。",
  },
  organizerMismatch: {
    en: "This wallet is not the organizer of the selected event",
    zh: "当前钱包不是所选活动的主办方",
  },
  ticketNotHeld: {
    en: "This pass is not in the connected wallet's verified inventory",
    zh: "该通行证不在当前钱包已核验的票夹中",
  },
  recipientIsOwner: {
    en: "Choose a different wallet for the transfer",
    zh: "请选择其他钱包作为转赠对象",
  },
  eventNameTooLong: { en: "Event name must be 60 characters or fewer", zh: "活动名称不能超过 60 个字符" },
  eventVenueTooLong: { en: "Venue must be 60 characters or fewer", zh: "场地不能超过 60 个字符" },
  eventNotesTooLong: { en: "Notes must be 240 characters or fewer", zh: "备注不能超过 240 个字符" },
  seatTooLong: { en: "Seat or zone must be 24 characters or fewer", zh: "座位或区域不能超过 24 个字符" },
  memoTooLong: { en: "Ticket memo must be 160 characters or fewer", zh: "门票备注不能超过 160 个字符" },
  loadFailed: { en: "Failed to load ticket data", zh: "加载门票数据失败" },

  dateUnknown: { en: "Schedule TBD", zh: "时间待定" },

  docSubtitle: {
    en: "Hand out passes your guests actually keep — issue them in seconds and check people in at the door.",
    zh: "送出宾客真正愿意收藏的通行证——几秒即可签发，并在入口处完成核验。",
  },
  subtitle: {
    en: "Hand out passes your guests actually keep — issue them in seconds and check people in at the door.",
    zh: "送出宾客真正愿意收藏的通行证——几秒即可签发，并在入口处完成核验。",
  },
  heroTagline: { en: "A keepsake for every guest", zh: "为每位宾客留下纪念" },
  docDescription: {
    en: "Event Ticket Pass publishes event metadata on-chain, mints NEP-11 tickets, and records check-in status at the gate. Each ticket can carry seat/memo data and becomes used after check-in.",
    zh: "活动门票通行证将活动信息上链、签发 NEP-11 门票，并记录入场核验状态。门票可包含座位/备注信息，核验后标记为已使用。",
  },
  step1: {
    en: "Create an event with venue, schedule, and ticket supply.",
    zh: "创建活动并填写场地、时间与票量。",
  },
  step2: {
    en: "Issue NEP-11 tickets to attendee addresses with seat/memo.",
    zh: "向参与者地址签发门票，可填写座位与备注。",
  },
  step3: {
    en: "Attendees open My Tickets and show the token ID QR.",
    zh: "参与者在“我的门票”展示二维码 Token ID。",
  },
  step4: {
    en: "Organizer checks in the token and marks it as used.",
    zh: "主办方核验 Token 并标记为已使用。",
  },
  feature1Name: { en: "On-chain Event Data", zh: "链上活动信息" },
  feature1Desc: {
    en: "Event name, venue, and schedule live on-chain.",
    zh: "活动名称、场地与时间信息上链保存。",
  },
  feature2Name: { en: "Check-in Status", zh: "核验状态" },
  feature2Desc: {
    en: "Each ticket records whether it has been used.",
    zh: "每张门票记录是否已核验使用。",
  },
  feature3Name: { en: "Issuer Control", zh: "发行方控制" },
  feature3Desc: {
    en: "Only the organizer can issue and check in tickets.",
    zh: "仅主办方可签发与核验门票。",
  },
  sidebarEvents: { en: "Events", zh: "活动" },
  sidebarTickets: { en: "Tickets", zh: "门票" },
  sidebarActive: { en: "Active", zh: "进行中" },
  eventPass: { en: "EVENT PASS", zh: "活动通行证" },
  passPreview: { en: "PASS PREVIEW", zh: "通行证预览" },
  verifiedTicket: { en: "VERIFIED ON-CHAIN PASS", zh: "链上已核验通行证" },
  previewTokenLabel: { en: "PREVIEW", zh: "预览" },
  ready: { en: "Ready", zh: "就绪" },
  eventsLoaded: { en: "Events loaded", zh: "活动已加载" },
  ticketsLoaded: { en: "Tickets loaded", zh: "门票已加载" },
  ticketsPartial: {
    en: "Verified {verified} of {total} wallet passes; the bounded scan could not prove the full inventory.",
    zh: "已核验钱包中的 {verified}/{total} 张通行证；受限扫描尚无法证明完整票夹。",
  },
  walletPassesVerified: { en: "Wallet passes verified on-chain", zh: "钱包通行证已完成链上核验" },
  walletPassesLoading: { en: "Verifying wallet passes", zh: "正在核验钱包通行证" },
  walletPassesConnect: { en: "Connect wallet to verify passes", zh: "连接钱包后核验通行证" },
  walletPassesUnavailable: { en: "Wallet pass verification unavailable", zh: "钱包通行证暂时无法核验" },
  walletPassesUnavailableHint: {
    en: "No inventory total is claimed until the contract reads succeed. Retry after checking the active network and RPC.",
    zh: "在合约读取成功前不会声称票夹总数。请确认当前网络与 RPC 后重试。",
  },
  walletPassesPartialTitle: { en: "Inventory verification is partial", zh: "票夹仅完成部分核验" },
  walletPassesPartial: {
    en: "{verified} of {total} passes are individually verified and shown.",
    zh: "已逐张核验并显示 {verified}/{total} 张通行证。",
  },
  workflow: { en: "Ticket workflow", zh: "门票工作流" },
  flowCreate: { en: "Create event", zh: "创建活动" },
  flowIssue: { en: "Issue attendee ticket", zh: "签发参与者门票" },
  flowCheckin: { en: "Lookup and check in", zh: "查询并核验" },
  serviceStatus: { en: "Service Status", zh: "服务状态" },
  studioEyebrow: { en: "Ticket operations", zh: "门票运营台" },
  studioTitle: { en: "Event Studio", zh: "活动发行台" },
  studioSubtitle: {
    en: "Build the pass, keep the event queue in view, then move straight into issuing or door check-in.",
    zh: "先完成票面与活动设置，再保持活动队列可见，直接进入签发或入口核验。",
  },
  studioStepCreate: { en: "Design pass", zh: "设计票面" },
  studioStepIssue: { en: "Issue guest pass", zh: "签发宾客通行证" },
  studioStepCheckin: { en: "Run gate check-in", zh: "执行入口核验" },
  studioModeLabel: { en: "Studio mode", zh: "工作台模式" },
  modeCreateTitle: { en: "Design pass", zh: "设计通行证" },
  modeCreateHint: {
    en: "Set the event identity first; timing and supply stay one tap away.",
    zh: "先确定活动识别信息；时间和票量收进下一层设置。",
  },
  // Own copy for the event-catalog zero-state. It used to borrow
  // modeCreateTitle/modeCreateHint, which the create wizard already prints.
  catalogEmptyTitle: { en: "No events published yet", zh: "尚未发布活动" },
  catalogEmptyHint: {
    en: "This contract has no active events to browse. Design a pass to publish the first one.",
    zh: "该合约上暂无可浏览的进行中活动。设计票面即可发布第一个。",
  },
  eventBlueprintsLabel: { en: "Ticket event blueprints", zh: "票务活动蓝图" },
  blueprintSummitName: { en: "Builder summit", zh: "开发者峰会" },
  blueprintSummitVenue: { en: "Main hall", zh: "主会场" },
  blueprintSummitStart: { en: "2026-08-20 09:00", zh: "2026-08-20 09:00" },
  blueprintSummitEnd: { en: "2026-08-20 18:00", zh: "2026-08-20 18:00" },
  blueprintSummitNotes: {
    en: "Main-stage access, badge pickup, and all-day check-in.",
    zh: "主舞台入场、徽章领取与全天入口核验。",
  },
  blueprintWorkshopName: { en: "Hands-on workshop", zh: "动手工作坊" },
  blueprintWorkshopVenue: { en: "Builder lab", zh: "开发者实验室" },
  blueprintWorkshopStart: { en: "2026-08-21 13:00", zh: "2026-08-21 13:00" },
  blueprintWorkshopEnd: { en: "2026-08-21 17:00", zh: "2026-08-21 17:00" },
  blueprintWorkshopNotes: {
    en: "Limited-capacity workshop pass with reserved lab seating.",
    zh: "限量工作坊通行证，包含实验室预留席位。",
  },
  blueprintBackstageName: { en: "Backstage access", zh: "后台通行证" },
  blueprintBackstageVenue: { en: "Crew entrance", zh: "工作人员入口" },
  blueprintBackstageStart: { en: "2026-08-20 08:00", zh: "2026-08-20 08:00" },
  blueprintBackstageEnd: { en: "2026-08-20 23:00", zh: "2026-08-20 23:00" },
  blueprintBackstageNotes: {
    en: "Staff, speaker, and production access with gate verification.",
    zh: "工作人员、嘉宾与制作团队后台通行，并在入口核验。",
  },
  modeOperateTitle: { en: "Run gate desk", zh: "运营检票台" },
  modeOperateHint: {
    en: "{count} events ready for issuing and check-in.",
    zh: "{count} 个活动可用于签发和核验。",
  },
  modeOperateDisabled: {
    en: "Create an event before opening the live desk.",
    zh: "先创建活动，再打开现场工作台。",
  },
  lifecycleEyebrow: { en: "Live pass route", zh: "实时通行证路径" },
  lifecycleTitle: {
    en: "From pass design to the door",
    zh: "从票面设计到入口核验",
  },
  lifecycleCopy: {
    en: "The primary workflow stays visible: design the event pass, send it to a guest wallet, then scan the token at the gate.",
    zh: "核心流程始终可见：设计活动通行证、发送到宾客钱包，并在入口扫描 Token 完成核验。",
  },
  lifecycleEvent: { en: "Event pass", zh: "活动通行证" },
  lifecycleWallet: { en: "Guest wallet", zh: "宾客钱包" },
  lifecycleGate: { en: "Door gate", zh: "入口闸机" },
  lifecycleDraft: {
    en: "Design the event pass first",
    zh: "先设计活动通行证",
  },
  lifecycleReady: {
    en: "Event is ready for guest passes",
    zh: "活动已准备签发宾客通行证",
  },
  lifecycleCreating: { en: "Publishing event on-chain", zh: "正在将活动发布上链" },
  lifecycleIssuing: { en: "Minting guest pass", zh: "正在铸造宾客通行证" },
  lifecycleLookup: { en: "Reading token at the gate", zh: "正在入口读取 Token" },
  lifecycleChecking: { en: "Marking pass as used", zh: "正在标记通行证已使用" },
  lifecycleTransfer: { en: "Sending pass to a new wallet", zh: "正在转赠到新钱包" },
  lifecycleComplete: {
    en: "Guest passes are live",
    zh: "宾客通行证已生效",
  },
  gateDesk: { en: "Gate Desk", zh: "入口工作台" },
  gateDeskSubtitle: {
    en: "Select the live event, issue passes, or verify a QR token without leaving this desk.",
    zh: "选择正在进行的活动，在同一工作台完成通行证签发或二维码 Token 核验。",
  },
  doorScanner: { en: "Door scanner", zh: "入口扫码器" },
  scannerSlotLabel: { en: "Token scanner slot", zh: "Token 扫码槽" },
  gateQueueLabel: { en: "Ready passes", zh: "待核验通行证" },
  gateQueueLoaded: { en: "Gate queue loaded", zh: "入口队列已加载" },
  gateQueueVerified: {
    en: "{count} issued passes verified",
    zh: "已核验 {count} 张已签发通行证",
  },
  gateQueuePartial: {
    en: "Showing {shown} of {total}; scan a token to verify any pass not listed.",
    zh: "当前显示 {shown}/{total} 张；未列出的通行证可扫描 Token 单独核验。",
  },
  refreshingGateQueue: { en: "Refreshing gate queue", zh: "正在刷新入口队列" },
  gateQueueLoadingHint: {
    en: "Reading the selected event's issued token records.",
    zh: "正在读取所选活动已签发的 Token 记录。",
  },
  gateQueueEmpty: { en: "No issued passes in this gate queue", zh: "此入口队列暂无已签发通行证" },
  gateQueueEmptyHint: {
    en: "Issue the first guest pass, or paste a token ID from a different event to verify it directly.",
    zh: "先签发第一张宾客通行证，或粘贴其他活动的 Token ID 直接核验。",
  },
  gateQueueUnavailable: { en: "Gate queue is unavailable", zh: "入口队列暂时不可用" },
  gateQueueUnavailableHint: {
    en: "No issued-pass total is claimed. Retry the queue or verify one token directly in the scanner.",
    zh: "当前不会声称已签发通行证总数。请重试队列，或在扫码器中直接核验单个 Token。",
  },
  gateQueueSelectOwnedEvent: {
    en: "Select one of your organizer events to load its issued passes.",
    zh: "请选择由当前钱包主办的活动，以加载其已签发通行证。",
  },
  evidence: { en: "Request and result evidence", zh: "请求与结果证据" },
  evidenceShort: { en: "Evidence", zh: "证据" },
  latestRequest: { en: "Latest Request", zh: "最新请求" },
  latestResult: { en: "Latest Result", zh: "最新结果" },
  viewOnExplorer: {
    en: "View transaction on explorer",
    zh: "在区块浏览器查看交易",
  },
  payloadEmpty: { en: "No action submitted yet", zh: "尚未提交操作" },
  requestEmpty: {
    en: "Create an event, issue a ticket, check in a token, or transfer a pass to inspect the exact contract request.",
    zh: "创建活动、签发门票、核验 Token 或转赠通行证后，可查看准确的合约请求。",
  },
  resultEmpty: {
    en: "Only a matching on-chain event and authoritative readback are reported as verified here.",
    zh: "只有匹配的链上事件与权威状态回读都通过后，才会在这里标记为已核验。",
  },
  connectWalletHint: {
    en: "Connect a Neo N3 wallet to verify the network, contract, and your pass inventory.",
    zh: "连接 Neo N3 钱包后核验网络、合约与您的通行证票夹。",
  },
  runtimeConnectWallet: {
    en: "Connect wallet to verify the ticket contract",
    zh: "连接钱包以核验票务合约",
  },
  runtimeChecking: {
    en: "Checking ticket contract",
    zh: "正在核验票务合约",
  },
  runtimeReady: {
    en: "Verified {network} ticket contract",
    zh: "已核验 {network} 票务合约",
  },
  runtimeUnavailable: {
    en: "Live ticket contract is unavailable; signing is disabled",
    zh: "实时票务合约不可用；签名操作已关闭",
  },
  runtimeNetworkUnknown: {
    en: "Wallet network could not be identified; signing is disabled",
    zh: "无法识别钱包网络；签名操作已关闭",
  },
  runtimeBindingMismatch: {
    en: "The configured contract, bytecode, or ticket ABI does not match this release",
    zh: "当前合约、字节码或票务 ABI 与本版本不匹配",
  },
  retryRuntimeCheck: {
    en: "Retry contract check",
    zh: "重试合约核验",
  },
  transactionRecoveryUnavailable: {
    en: "Refresh recovery is unavailable in this browser. No transaction was requested.",
    zh: "当前浏览器无法提供刷新恢复，因此尚未请求交易签名。",
  },
  transactionRecoveryUnavailableAfterBroadcast: {
    en: "The transaction was broadcast, but refresh-safe recovery could not be saved. Keep this page open and retry status recovery.",
    zh: "交易已广播，但无法保存刷新恢复记录。请保持页面开启并重试状态恢复。",
  },
  transactionRecoveryCleanupUnavailable: {
    en: "The chain result is verified, but the saved recovery record could not be cleared. Keep it pending and retry cleanup.",
    zh: "链上结果已核验，但无法清除本地恢复记录。请保留待处理状态并重试清理。",
  },
  operationInProgress: {
    en: "Finish the current wallet or ticket action before starting another.",
    zh: "请先完成当前钱包或票务操作，再开始新的操作。",
  },
  transactionIdInvalid: {
    en: "The wallet did not return a valid transaction ID, so this action cannot be tracked safely.",
    zh: "钱包未返回有效交易 ID，因此无法可靠追踪本次操作。",
  },
  walletChangedDuringAction: {
    en: "The connected wallet changed during this action. Its saved transaction was not applied to the new wallet view.",
    zh: "操作期间连接钱包已切换。原钱包的已保存交易不会应用到新钱包视图。",
  },
  transactionFaulted: {
    en: "The saved transaction faulted on-chain. It was not applied, and the pending action has been cleared.",
    zh: "已保存交易在链上执行失败，未应用任何结果，并已清除待处理操作。",
  },
  transactionPending: {
    en: "Transaction broadcast; confirmation is still pending",
    zh: "交易已广播；仍在等待确认",
  },
  pendingOperationTitle: {
    en: "One ticket action still needs confirmation",
    zh: "有一项票务操作仍待确认",
  },
  pendingOperationHint: {
    en: "The exact transaction is saved. Recover its matching event and contract state before starting another action.",
    zh: "已保存准确交易。请先恢复其匹配事件与合约状态，再开始下一项操作。",
  },
  pendingOperationBlocksAction: {
    en: "Recover the pending ticket action before starting another transaction",
    zh: "请先恢复待确认的票务操作，再发起新交易",
  },
  recoverPending: {
    en: "Recover status",
    zh: "恢复状态",
  },
  recoveringPending: {
    en: "Recovering status",
    zh: "正在恢复状态",
  },
  pendingRecovered: {
    en: "Transaction event and ticket state recovered",
    zh: "已恢复交易事件与票务状态",
  },
  pendingStillConfirming: {
    en: "The saved transaction is not fully indexed yet. Keep it pending and retry shortly.",
    zh: "已保存交易尚未完成索引。请保留待确认状态并稍后重试。",
  },
  pendingMismatch: {
    en: "The observed event does not match the saved ticket action",
    zh: "观察到的事件与已保存票务操作不匹配",
  },
  discoverEvents: {
    en: "Discover events",
    zh: "发现活动",
  },
  discoveredEventsCount: {
    en: "{count} discoverable events",
    zh: "{count} 个可发现活动",
  },
  refreshingDiscovery: {
    en: "Refreshing events",
    zh: "正在刷新活动",
  },
  invitationOnlyTitle: {
    en: "Organizer-issued passes",
    zh: "由主办方签发通行证",
  },
  invitationOnlyHint: {
    en: "This deployed contract has no purchase or self-claim method. Browse active events, then receive a pass from its organizer.",
    zh: "当前部署合约没有购票或自主领取方法。您可浏览活动，并由主办方向钱包签发通行证。",
  },
  invitationOnlyShort: {
    en: "Invitation only",
    zh: "仅限邀请",
  },
} as const;

export const messages = mergeMessages(appMessages);
