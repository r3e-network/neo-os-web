export const messages = {
    // App translations
title: { en: "Ex Files", zh: "前任档案" },
  subtitle: { en: "Anonymous record vault", zh: "匿名记录保险库" },

  // Stats
  totalMemories: { en: "Total Memories", zh: "总回忆" },
  daysTogether: { en: "Days Together", zh: "相处天数" },
  lockedFiles: { en: "Locked Files", zh: "已锁定" },
  totalRecords: { en: "Total Records", zh: "记录总数" },
  averageRating: { en: "Avg Rating", zh: "平均评分" },
  totalQueries: { en: "Total Queries", zh: "查询总数" },
  record: { en: "Record", zh: "记录" },
  recordId: { en: "Record ID", zh: "记录 ID" },
  noRecords: { en: "No records found", zh: "未找到记录" },
  unknown: { en: "Unknown", zh: "未知" },
  statusActive: { en: "Active", zh: "有效" },
  statusInactive: { en: "Inactive", zh: "已删除" },

  // Archive
  memoryArchive: { en: "Record Archive", zh: "记录档案" },
  tapToView: { en: "Tap to view", zh: "点击查看" },

  // Upload
  uploadMemory: { en: "Create Record", zh: "创建记录" },
  uploadSubtitle: { en: "Add a hashed record to the archive", zh: "将哈希记录加入档案" },
  memoryTitle: { en: "Memory Title", zh: "回忆标题" },
  memoryTitlePlaceholder: { en: "e.g., First Date at Cafe", zh: "例如：咖啡馆的初次约会" },
  memoryType: { en: "Memory Type", zh: "回忆类型" },
  contentOrUrl: { en: "Content / URL", zh: "内容 / 链接" },
  contentPlaceholder: { en: "Describe the record or paste a URL", zh: "填写记录内容或粘贴链接" },
  uploading: { en: "Uploading...", zh: "上传中..." },
  uploadMemoryBtn: { en: "Upload to Archive", zh: "上传到档案" },
  recordContent: { en: "Record Content", zh: "记录内容" },
  rating: { en: "Rating (1-5)", zh: "评分（1-5）" },
  hashNote: { en: "Content is hashed locally before upload.", zh: "内容将在本地哈希后上传。" },
  createRecord: { en: "Create Record", zh: "创建记录" },
  queryRecord: { en: "Query Record", zh: "查询记录" },
  queryLabel: { en: "Hash or Content", zh: "哈希或内容" },
  queryPlaceholder: { en: "Paste hash or enter content to hash", zh: "粘贴哈希或输入内容生成哈希" },
  querying: { en: "Querying...", zh: "查询中..." },
  queryResult: { en: "Query Result", zh: "查询结果" },
  resultHit: { en: "HIT", zh: "命中" },
  hashLabel: { en: "Hash", zh: "哈希" },

  // Memory types
  typePhoto: { en: "Photo", zh: "照片" },
  typeText: { en: "Letter", zh: "信件" },
  typeVideo: { en: "Video", zh: "视频" },
  typeAudio: { en: "Audio", zh: "音频" },

  // Status
  viewing: { en: "Viewing", zh: "查看中" },
  memoryUploaded: { en: "Memory uploaded to archive!", zh: "回忆已上传到档案！" },
  error: { en: "Error", zh: "错误" },
  invalidContent: { en: "Enter content to hash", zh: "请输入内容" },
  invalidRating: { en: "Rating must be between 1 and 5", zh: "评分必须在 1-5 之间" },
  recordCreated: { en: "Record created", zh: "记录已创建" },
  recordQueried: { en: "Record queried", zh: "记录已查询" },
  failedToLoad: { en: "Failed to load records", zh: "加载记录失败" },
  missingContract: { en: "Contract not configured", zh: "合约未配置" },
  connectWallet: { en: "Connect wallet first", zh: "请先连接钱包" },
  receiptMissing: { en: "Payment receipt missing", zh: "支付凭证缺失" },

  // Sample memories
  firstDate: { en: "First Date", zh: "初次约会" },
  loveLetter: { en: "Love Letter", zh: "情书" },
  anniversary: { en: "Anniversary", zh: "纪念日" },
  breakupLetter: { en: "Breakup Letter", zh: "分手信" },

  // Categories
  catGeneral: { en: "General", zh: "通用" },
  catAll: { en: "All", zh: "全部" },
  catPhoto: { en: "Photo", zh: "照片" },
  catLetter: { en: "Letter", zh: "信件" },
  catVideo: { en: "Video", zh: "视频" },
  catAudio: { en: "Audio", zh: "音频" },

  // Tabs
  tabFiles: { en: "Archive", zh: "档案" },
  tabUpload: { en: "Upload", zh: "上传" },
  tabStats: { en: "Stats", zh: "统计" },
  docs: { en: "Docs", zh: "文档" },

  // Docs
  docSubtitle: { en: "Hashed records with private lookup", zh: "哈希记录与私密检索" },
  docDescription: {
    en: "Ex Files stores only content hashes and lightweight metadata (type, rating, timestamp) on-chain. You hash locally before upload and later verify existence by querying the same hash without exposing the original content.",
    zh: "前任档案仅将内容哈希与轻量元数据（类型、评分、时间）存储在链上。上传前在本地哈希，之后可用同一哈希验证记录存在，无需暴露原文。",
  },
  step1: { en: "Connect your wallet and open Create Record.", zh: "连接钱包并打开创建记录。" },
  step2: { en: "Enter content or URL, choose type and rating; the hash is generated locally.", zh: "输入内容或链接，选择类型与评分；哈希在本地生成。" },
  step3: { en: "Submit the hash and metadata on-chain.", zh: "将哈希与元数据提交到链上。" },
  step4: { en: "Query by hash later, or report/delete records when needed.", zh: "之后可按哈希查询，必要时可举报或删除记录。" },
  feature1Name: { en: "Local Hashing", zh: "本地哈希" },
  feature1Desc: { en: "Only hashes are uploaded; raw content stays with you.", zh: "仅上传哈希，原始内容留在本地。" },
  feature2Name: { en: "On-chain Evidence", zh: "链上证明" },
  feature2Desc: { en: "Timestamps and metadata prove record existence.", zh: "时间戳与元数据证明记录存在。" },
  feature3Name: { en: "Report & Delete", zh: "举报与删除" },
  feature3Desc: { en: "Soft delete your own records and flag abuse.", zh: "支持软删除自有记录并举报不当内容。" },
  wrongChain: { en: "Wrong Network", zh: "网络错误" },
  wrongChainMessage: { en: "This app requires Neo N3 network.", zh: "此应用需 Neo N3 网络。" },
  switchToNeo: { en: "Switch to Neo N3", zh: "切换到 Neo N3" },
    // Shared component keys
    wpTitle: { en: "Wallet Required", zh: "需要钱包" },
    wpDescription: { en: "Please connect your wallet to continue.", zh: "请连接钱包以继续。" },
    wpConnect: { en: "Connect Wallet", zh: "连接钱包" },
    wpCancel: { en: "Cancel", zh: "取消" },
    docWhatItIs: { en: "What is it?", zh: "这是什么？" },
    docHowToUse: { en: "How to use", zh: "如何使用" },
    docOnChainFeatures: { en: "On-Chain Features", zh: "链上特性" },
    sidebarWallet: { en: "Wallet", zh: "钱包" },
    connected: { en: "Connected", zh: "已连接" },
    disconnected: { en: "Disconnected", zh: "未连接" },
    errorFallback: { en: "Something went wrong", zh: "出现错误" },
};
