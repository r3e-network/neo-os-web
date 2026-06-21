import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
    appTitle: {
        en: "Neo N3 Converter",
        zh: "Neo N3 转换工具"
    },
    heroTitle: {
        en: "Neo N3 Toolset",
        zh: "Neo N3 工具箱"
    },
    heroSubtitle: {
        en: "A local key workbench for generating accounts, deriving addresses, and checking Neo N3 formats without sending secrets anywhere.",
        zh: "本地密钥工作台，用于生成账户、推导地址并校验 Neo N3 格式，密钥不会发送到任何地方。"
    },
    localOnlyPill: {
        en: "Local-only key work",
        zh: "密钥本地处理"
    },
    formatAutodetectPill: {
        en: "Format auto-detect",
        zh: "格式自动识别"
    },
    paperWalletPill: {
        en: "Paper wallet export",
        zh: "纸钱包导出"
    },
    workbenchStageEyebrow: {
        en: "Secure workbench",
        zh: "安全工作台"
    },
    workbenchStageTitle: {
        en: "Paste, derive, reveal only when you choose.",
        zh: "粘贴、推导，并且只在你选择时显示密钥。"
    },
    workbenchStageCopy: {
        en: "The default view keeps secrets masked and makes every derived value inspectable before copy or export.",
        zh: "默认视图会隐藏敏感信息，并让每个推导值在复制或导出前都可检查。"
    },
    accountsGenerated: {
        en: "Accounts",
        zh: "账户"
    },
    neoBalance: {
        en: "NEO Balance",
        zh: "NEO 余额"
    },
    gasBalance: {
        en: "GAS Balance",
        zh: "GAS 余额"
    },
    generateNewAccount: {
        en: "Generate New Account",
        zh: "生成新账户"
    },
    generatePanelTitle: {
        en: "Create an offline-ready wallet",
        zh: "创建可离线备份的钱包"
    },
    generatePanelCopy: {
        en: "Generate a Neo N3 account locally, review the address, then reveal private material only when you are ready to back it up.",
        zh: "在本地生成 Neo N3 账户，先核对地址，只在准备备份时显示私钥材料。"
    },
    convertKey: {
        en: "Convert Key",
        zh: "转换密钥"
    },
    convertPanelTitle: {
        en: "Decode a key, address, or script",
        zh: "解析密钥、地址或脚本"
    },
    convertPanelCopy: {
        en: "Paste once and the tool derives the readable address, script hash, public key, WIF, or opcode view it can safely produce.",
        zh: "粘贴一次，工具会推导可安全生成的地址、脚本哈希、公钥、WIF 或操作码视图。"
    },
    convertHint: {
        en: "Paste a WIF, private key, public key, or NeoVM script — everything is processed on your device.",
        zh: "粘贴 WIF、私钥、公钥或 NeoVM 脚本——所有处理均在您的设备本地完成。"
    },
    enterKeyPlaceholder: {
        en: "Enter WIF, hex, or address...",
        zh: "输入 WIF、Hex 或地址……"
    },
    convert: {
        en: "Convert",
        zh: "转换"
    },
    tabGenerate: {
        en: "Generate",
        zh: "生成"
    },
    tabConvert: {
        en: "Convert",
        zh: "转换"
    },
    docTitle: {
        en: "Neo Convert Documentation",
        zh: "Neo 转换工具文档"
    },
    docSubtitle: {
        en: "Offline key toolkit for Neo N3",
        zh: "Neo N3 离线密钥工具"
    },
    docDescription: {
        en: "Generate Neo N3 accounts locally, convert between WIF/private/public keys, derive addresses, and disassemble scripts. Key generation and conversion run on-device with no server calls, making it suitable for cold storage preparation and quick format checks. The optional balance view makes read-only RPC calls when a wallet is connected.",
        zh: "在本地生成 Neo N3 账户，支持 WIF/私钥/公钥互转、地址派生与脚本反汇编。密钥的生成与转换在设备本地完成，无需服务器请求，适用于冷存储准备与格式校验。仅当连接钱包查看余额时，才会发起只读 RPC 调用。"
    },
    docStep1: {
        en: "Open the Generate tab to create a new account and keep the private key/WIF offline.",
        zh: "打开生成页创建新账户，并将私钥/WIF 离线保存。"
    },
    docStep2: {
        en: "Export the paper wallet PDF for an offline backup or print it for cold storage.",
        zh: "导出纸钱包 PDF 作为离线备份，必要时可打印保存。"
    },
    docStep3: {
        en: "Switch to Convert and paste a WIF, private key, public key, or script hex.",
        zh: "切换到转换页，粘贴 WIF、私钥、公钥或脚本 Hex。"
    },
    docStep4: {
        en: "Review derived values (address, pubkey, WIF) and copy the verified format.",
        zh: "核对派生结果（地址、公钥、WIF），复制确认后的格式。"
    },
    docFeature1Name: {
        en: "Local key generation",
        zh: "本地密钥生成"
    },
    docFeature1Desc: {
        en: "Keys are generated on your device with no network transmission.",
        zh: "密钥在设备本地生成，不经网络传输。"
    },
    docFeature2Name: {
        en: "Format auto-detection",
        zh: "格式自动识别"
    },
    docFeature2Desc: {
        en: "Detects WIF, private/public keys, and scripts for quick conversion.",
        zh: "自动识别 WIF/私钥/公钥/脚本并完成转换。"
    },
    docFeature3Name: {
        en: "Script disassembler",
        zh: "脚本反汇编"
    },
    docFeature3Desc: {
        en: "Turns NeoVM script hex into readable opcode lists for debugging.",
        zh: "将 NeoVM 脚本 Hex 转为可读指令列表，便于调试。"
    },
    docFeature4Name: {
        en: "Paper wallet export",
        zh: "纸钱包导出"
    },
    docFeature4Desc: {
        en: "QR-backed PDF export for secure offline storage.",
        zh: "生成带二维码的 PDF 便于安全离线保存。"
    },
    genTitle: {
        en: "Generate New Wallet",
        zh: "生成新钱包"
    },
    btnGenerate: {
        en: "Generate",
        zh: "生成"
    },
    privateBadge: {
        en: "PRIVATE",
        zh: "私密"
    },
    address: {
        en: "Address",
        zh: "地址"
    },
    pubKey: {
        en: "Public Key",
        zh: "公钥"
    },
    privKeyWarning: {
        en: "Private Key (Keep Safe!)",
        zh: "私钥 (请妥善保管!)"
    },
    wifWarning: {
        en: "WIF (Keep Safe!)",
        zh: "WIF (请妥善保管!)"
    },
    wifLabel: {
        en: "WIF",
        zh: "WIF"
    },
    paperWalletTitle: {
        en: "NEO N3 PAPER WALLET",
        zh: "NEO N3 纸钱包"
    },
    paperWalletTagline: {
        en: "SECURE OFF-LINE STORAGE",
        zh: "安全离线存储"
    },
    paperWalletPublicTitle: {
        en: "PUBLIC ADDRESS",
        zh: "公开地址"
    },
    paperWalletPublicNote: {
        en: "SHARE THIS TO RECEIVE FUNDS",
        zh: "分享此地址以接收资金"
    },
    paperWalletPrivateTitle: {
        en: "PRIVATE KEY (WIF)",
        zh: "私钥 (WIF)"
    },
    paperWalletPrivateNote: {
        en: "KEEP SECRET - DO NOT SHARE",
        zh: "请保密 - 不要分享"
    },
    paperWalletFooter: {
        en: "Generated securely via Neo Convert MiniApp. Check balance at explorer.neo.org",
        zh: "由 Neo Convert MiniApp 安全生成。可在 explorer.neo.org 查询余额。"
    },
    downloadPdf: {
        en: "Download Paper Wallet (PDF)",
        zh: "下载纸钱包 (PDF)"
    },
    paperWalletRequiresReveal: {
        en: "Reveal secrets before exporting the WIF-backed paper wallet.",
        zh: "导出包含 WIF 的纸钱包前，请先显示密钥。"
    },
    paperWalletReady: {
        en: "Paper wallet PDF generated.",
        zh: "纸钱包 PDF 已生成。"
    },
    paperWalletFailed: {
        en: "Could not generate the paper wallet PDF. Please try again.",
        zh: "无法生成纸钱包 PDF，请重试。"
    },
    genEmptyState: {
        en: "Click Generate to create a new Neo N3 account safely on your device.",
        zh: "点击“生成”按钮以在您的设备上安全地创建新的 Neo N3 账户。"
    },
    convTitle: {
        en: "Key & Script Converter",
        zh: "密钥与脚本转换器"
    },
    inputLabel: {
        en: "Input (Private Key, WIF, Public Key, or Hex Script)",
        zh: "输入 (私钥, WIF, 公钥, 或 Hex 脚本)"
    },
    inputPlaceholder: {
        en: "Paste your key or script here...",
        zh: "在此粘贴您的密钥或脚本..."
    },
    detectedWif: {
        en: "Detected: WIF",
        zh: "检测到: WIF"
    },
    detectedPubKey: {
        en: "Detected: Public Key",
        zh: "检测到: 公钥"
    },
    detectedPrivKey: {
        en: "Detected: Private Key (Hex)",
        zh: "检测到: 私钥 (Hex)"
    },
    detectedScript: {
        en: "Detected: NeoVM Script",
        zh: "检测到: NeoVM 脚本"
    },
    detectedAddress: {
        en: "Detected: Neo N3 Address",
        zh: "检测到: Neo N3 地址"
    },
    scriptHashLabel: {
        en: "Script Hash (0x, big-endian)",
        zh: "脚本哈希 (0x, 大端)"
    },
    scriptHashLeLabel: {
        en: "Script Hash (little-endian)",
        zh: "脚本哈希 (小端)"
    },
    unknownFormat: {
        en: "Unknown format",
        zh: "未知格式"
    },
    invalidFormat: {
        en: "Invalid format",
        zh: "格式无效"
    },
    copied: {
        en: "Copied!",
        zh: "已复制!"
    },
    disassembledOpcodes: {
        en: "Disassembled Opcodes",
        zh: "反汇编指令 (Opcodes)"
    },
    privKeyLabel: {
        en: "Private Key (Hex)",
        zh: "私钥 (Hex)"
    },
    docBadge: { en: "DOCUMENTATION", zh: "文档" },
    docFooter: { en: "Empowering the Smart Economy", zh: "赋能智能经济" },
    genEmptySub: {
        en: "Click Generate to create a new offline wallet",
        zh: "点击生成以创建一个新的离线钱包"
    },
    sidebarActiveTab: { en: "Active Tab", zh: "当前标签" },
    sidebarMode: { en: "Mode", zh: "模式" },
    sidebarMobile: { en: "Mobile", zh: "移动端" },
    sidebarDesktop: { en: "Desktop", zh: "桌面端" },
    quickTools: { en: "Quick Tools", zh: "快捷工具" },
    loading: { en: "Loading...", zh: "加载中..." },
    loadingBalances: { en: "Loading balances...", zh: "正在加载余额…" },
    connectForBalances: {
        en: "Connect a wallet to see live NEO / GAS balances.",
        zh: "连接钱包以查看实时 NEO / GAS 余额。"
    },
    // "What you can paste" reference card — fills the resting lower viewport
    // with purposeful guidance instead of leaving a large blank canvas.
    formatsTitle: { en: "What you can paste", zh: "可粘贴的格式" },
    formatRailTitle: { en: "Supported formats", zh: "支持的格式" },
    formatWifLabel: { en: "WIF", zh: "WIF" },
    formatWifDesc: {
        en: "Wallet Import Format private key (starts with K/L).",
        zh: "钱包导入格式私钥（以 K/L 开头）。"
    },
    formatPrivateKeyLabel: { en: "Private key", zh: "私钥" },
    formatPrivateKeyDesc: {
        en: "64-character hex private key.",
        zh: "64 位十六进制私钥。"
    },
    formatPublicKeyLabel: { en: "Public key", zh: "公钥" },
    formatPublicKeyDesc: {
        en: "Compressed public key — derives address and script hash.",
        zh: "压缩公钥——可推导地址与脚本哈希。"
    },
    formatScriptLabel: { en: "NeoVM script", zh: "NeoVM 脚本" },
    formatScriptDesc: {
        en: "Verification script hex — disassembled into opcodes.",
        zh: "验证脚本十六进制——反汇编为操作码。"
    },
    onDeviceNote: {
        en: "Key generation and conversion run entirely on your device — keys are never transmitted. The optional balance view makes read-only RPC calls when a wallet is connected.",
        zh: "密钥的生成与转换完全在您的设备上运行——密钥永不外传。仅当连接钱包查看余额时，才会发起只读 RPC 调用。"
    },
    safetyTitle: { en: "Safety model", zh: "安全模型" },
    safetyLocal: {
        en: "Secrets stay in this device session",
        zh: "密钥仅留在当前设备会话"
    },
    safetyReveal: {
        en: "Private values stay masked by default",
        zh: "私密值默认隐藏"
    },
    safetyRpc: {
        en: "Balances are optional read-only RPC",
        zh: "余额为可选只读 RPC"
    },
    emptyOutputTitle: {
        en: "Output appears after a valid paste",
        zh: "粘贴有效内容后显示输出"
    },
    emptyOutputCopy: {
        en: "Unknown or malformed input will show a clear status instead of filling this panel with noise.",
        zh: "未知或格式错误的输入会显示清晰状态，不会把这里塞满无意义内容。"
    },
    // Inline caveat on the balance tiles: this is the one feature that talks to
    // a node, in contrast to the fully on-device key tooling.
    balanceRpcNote: {
        en: "Balances are read live from a Neo RPC node — this is the only feature that uses the network.",
        zh: "余额通过 Neo RPC 节点实时读取——这是唯一使用网络的功能。"
    },
    showSecrets: { en: "Show secrets", zh: "显示密钥" },
    hideSecrets: { en: "Hide secrets", zh: "隐藏密钥" },
    copyAddress: { en: "Copy address", zh: "复制地址" },
    copyPublicKey: { en: "Copy public key", zh: "复制公钥" },
    copyPrivateKey: { en: "Copy private key", zh: "复制私钥" },
    copyWif: { en: "Copy WIF", zh: "复制 WIF" },
    addressQrCode: { en: "Address QR Code", zh: "地址二维码" },
    wifQrCode: { en: "WIF QR Code", zh: "WIF 二维码" },
    iconCopy: { en: "Copy to clipboard", zh: "复制到剪贴板" },
    showSecretsIcon: { en: "Toggle secret visibility", zh: "切换密钥可见性" },
    hideSecretsIcon: { en: "Hide secrets", zh: "隐藏密钥" },
} as const;

export const messages = mergeMessages(appMessages);
