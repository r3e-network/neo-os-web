export const messages = {
    appTitle: {
        en: "Neo N3 Converter",
        zh: "Neo N3 转换工具"
    },
    heroTitle: {
        en: "Neo N3 Toolset",
        zh: "Neo N3 工具箱"
    },
    heroSubtitle: {
        en: "Securely generate accounts and convert keys client-side.",
        zh: "安全地在本地生成账户并转换密钥格式。"
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
        en: "Generate Neo N3 accounts locally, convert between WIF/private/public keys, derive addresses, and disassemble scripts. Everything runs on-device with no server calls, making it suitable for cold storage preparation and quick format checks.",
        zh: "在本地生成 Neo N3 账户，支持 WIF/私钥/公钥互转、地址派生与脚本反汇编。所有操作在设备本地完成，无需服务器请求，适用于冷存储准备与格式校验。"
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
    loading: {
        en: "Loading...",
        zh: "加载中..."
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
    // Shared component keys
    wpTitle: { en: "Wallet Required", zh: "需要钱包" },
    wpDescription: { en: "Please connect your wallet to continue.", zh: "请连接钱包以继续。" },
    wpConnect: { en: "Connect Wallet", zh: "连接钱包" },
    wpCancel: { en: "Cancel", zh: "取消" },
    docBadge: { en: "DOCUMENTATION", zh: "文档" },
    docWhatItIs: { en: "What is it?", zh: "这是什么？" },
    docHowToUse: { en: "How to use", zh: "如何使用" },
    docOnChainFeatures: { en: "On-Chain Features", zh: "链上特性" },
    docFooter: { en: "Empowering the Smart Economy", zh: "赋能智能经济" },
    genEmptySub: {
        en: "Click Generate to create a new offline wallet",
        zh: "点击生成以创建一个新的离线钱包"
    },
    wrongChain: { en: "Wrong Network", zh: "网络错误" },
    wrongChainMessage: { en: "This app requires Neo N3 network.", zh: "此应用需 Neo N3 网络。" },
    switchToNeo: { en: "Switch to Neo N3", zh: "切换到 Neo N3" },
    error: { en: "Error", zh: "错误" }
};
