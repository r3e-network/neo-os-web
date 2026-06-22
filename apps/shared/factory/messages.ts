export const factoryMessages = {
  title: { en: "Template Factory", zh: "模板工厂" },
  subtitle: {
    en: "Deploy assets, collections, and miniapps from audited on-chain templates with only initialization parameters.",
    zh: "基于已审计的链上模板部署资产、集合和小程序，只提交初始化参数。",
  },
  subtitleShort: {
    en: "Design a governed template package before wallet approval.",
    zh: "先设计受治理模板包，再交给钱包确认。",
  },
  playTab: { en: "Factory", zh: "工厂" },
  activityTab: { en: "Activity", zh: "动态" },
  docsTab: { en: "Docs", zh: "文档" },
  factoryOverview: { en: "Factory overview", zh: "工厂概览" },
  activeTemplate: { en: "Template", zh: "模板" },
  targetNetwork: { en: "Target network", zh: "目标网络" },
  planStatus: { en: "Plan status", zh: "计划状态" },
  packageDigest: { en: "Digest", zh: "摘要" },
  blockingIssues: { en: "Blocking issues", zh: "阻断问题" },
  generatedPackages: { en: "Generated", zh: "已生成" },
  signatureState: { en: "Signature", zh: "签名" },
  unsigned: { en: "Unsigned", zh: "未签名" },
  signed: { en: "Signed", zh: "已签名" },
  ready: { en: "Ready", zh: "就绪" },
  blocked: { en: "Blocked", zh: "阻断" },
  manualReview: { en: "Manual deploy", zh: "人工部署" },
  nep17: { en: "NEP-17 Asset", zh: "NEP-17 资产" },
  nep11: { en: "NEP-11 Collection", zh: "NEP-11 集合" },
  miniappTemplate: { en: "MiniApp Template", zh: "小程序模板" },
  name: { en: "Name", zh: "名称" },
  collectionName: { en: "Collection name", zh: "集合名称" },
  symbol: { en: "Symbol", zh: "符号" },
  decimals: { en: "Decimals", zh: "精度" },
  initialSupply: { en: "Initial supply", zh: "初始供应量" },
  owner: { en: "Owner", zh: "Owner 地址" },
  treasury: { en: "Treasury", zh: "金库地址" },
  maxSupply: { en: "Max supply", zh: "最大供应量" },
  royaltyBps: { en: "Royalty bps", zh: "版税 BPS" },
  baseUri: { en: "Base URI", zh: "基础 URI" },
  appId: { en: "MiniApp ID", zh: "小程序 ID" },
  appName: { en: "MiniApp name", zh: "小程序名称" },
  admin: { en: "Admin", zh: "管理员地址" },
  templateKind: { en: "Template kind", zh: "模板类型" },
  network: { en: "Network", zh: "网络" },
  mintable: { en: "Mintable after deploy", zh: "部署后可增发" },
  transferable: { en: "Transferable NFT", zh: "NFT 可转让" },
  needsOracle: { en: "Needs oracle", zh: "需要预言机" },
  needsOneGate: { en: "OneGate launch", zh: "OneGate 启动" },
  generatePlan: { en: "Generate template plan", zh: "生成模板计划" },
  signPlanAction: { en: "Sign template plan", zh: "签名模板计划" },
  signPlanTitle: { en: "Owner signature", zh: "Owner 签名" },
  signPlanDescription: {
    en: "Signs the deterministic template-plan digest with the connected wallet. Execution remains explicit and reviewable.",
    zh: "使用已连接钱包签名确定性的模板计划摘要。执行仍保持显式、可审计。",
  },
  packageReady: { en: "Template plan ready", zh: "模板计划已就绪" },
  packageBlocked: { en: "Fix blocking issues", zh: "请修复阻断问题" },
  planDraftReady: { en: "Ready to generate", zh: "可生成计划" },
  planDraftNeedsWork: { en: "Complete setup first", zh: "请先完成设置" },
  planDraftReadyDetail: {
    en: "Generate a plan to lock this preview into a signable, reviewable package.",
    zh: "生成计划后，此预览会锁定为可签名、可复核的部署包。",
  },
  planLockedDetail: {
    en: "Plan is locked. Review details, sign with the owner wallet, then execute when the template is available.",
    zh: "计划已锁定。复核细节后用 Owner 钱包签名，并在模板可用时执行。",
  },
  planBlockedDetail: {
    en: "Resolve the listed issue before signing or executing.",
    zh: "请先解决列出的问题，再签名或执行。",
  },
  fixBlockingIssues: { en: "Fix blocking issues", zh: "修复阻断问题" },
  nextStep: { en: "Next step", zh: "下一步" },
  planDetails: { en: "Plan details", zh: "计划细节" },
  planDetailsHint: {
    en: "Digest, validation, and JSON payload.",
    zh: "摘要、校验结果和 JSON 载荷。",
  },
  planSigned: { en: "Template plan signed", zh: "模板计划已签名" },
  signFailed: { en: "Signing failed", zh: "签名失败" },
  noPlanToSign: {
    en: "Generate a template plan first.",
    zh: "请先生成模板计划。",
  },
  planCopied: { en: "Template plan copied", zh: "模板计划已复制" },
  linkCopied: { en: "OneGate link copied", zh: "OneGate 链接已复制" },
  copyPackage: { en: "Copy template plan", zh: "复制模板计划" },
  copyLink: { en: "Copy OneGate link", zh: "复制 OneGate 链接" },
  publishPackage: { en: "Template deployment plan", zh: "模板部署计划" },
  deployChecklist: { en: "Deploy checklist", zh: "部署清单" },
  deployChecklistHint: {
    en: "Validation, template, execution, and registry steps.",
    zh: "校验、模板、执行和注册表步骤。",
  },
  oneGateLaunch: { en: "OneGate launch URL", zh: "OneGate 启动链接" },
  blockingErrors: { en: "Blocking errors", zh: "阻断错误" },
  warnings: { en: "Warnings", zh: "提醒" },
  noErrors: { en: "No blocking issues.", zh: "没有阻断问题。" },
  noWarnings: { en: "No warnings.", zh: "没有提醒。" },
  packageDigestFull: { en: "Plan digest", zh: "计划摘要" },
  packageId: { en: "Plan ID", zh: "计划 ID" },
  viewPackagePayload: {
    en: "View plan payload (JSON)",
    zh: "查看计划载荷 (JSON)",
  },
  walletSignature: { en: "Wallet signature", zh: "钱包签名" },
  deployHonesty: {
    en: "This console never uploads external NEF or manifest files. It submits a preloaded template ID and initialization parameters to the configured Factory contract, and blocks execution until that contract is configured.",
    zh: "此控制台不会上传链外 NEF 或 manifest 文件；它只向已配置的 Factory 合约提交预置模板 ID 和初始化参数，Factory 合约未配置前会阻断执行。",
  },
  docWhatItIsBody: {
    en: "This factory is a standalone, OneGate-loadable console for creating focused Neo assets or miniapps from audited templates already registered on-chain.",
    zh: "此工厂是可被 OneGate 独立加载的创建控制台，用于从已在链上注册的审计模板创建专注型 Neo 资产或小程序。",
  },
  docSupportedTemplates: { en: "Supported templates", zh: "支持模板" },
  docSupportedTemplatesBody: {
    en: "NEP-17 fungible assets, NEP-11 collections, and miniapp templates for reward vaults, event tickets, certificates, and oracle consoles.",
    zh: "支持 NEP-17 同质化资产、NEP-11 集合，以及奖励金库、活动门票、证书、预言机控制台等小程序模板。",
  },
  docSafetyModel: { en: "Safety model", zh: "安全模型" },
  docSafetyModelBody: {
    en: "The plan digest is a deterministic SHA-256 commitment over the canonical plan payload and is wallet-signable. The factory method receives template ID plus init params only; raw NEF and manifest artifacts must be preloaded and governed by the Factory contract.",
    zh: "计划摘要是对规范化计划载荷的确定性 SHA-256 承诺，可由钱包签名。Factory 方法只接收模板 ID 和初始化参数；原始 NEF 和 manifest 必须提前由 Factory 合约预置和治理。",
  },

  // ── Validation errors (plan blocking) ──
  errNameLength: {
    en: "Name must be 3-64 characters.",
    zh: "名称需为 3-64 个字符。",
  },
  errCollectionNameLength: {
    en: "Collection name must be 3-64 characters.",
    zh: "集合名称需为 3-64 个字符。",
  },
  errSymbolFormat: {
    en: "Symbol must be 2-12 uppercase letters or digits and start with a letter.",
    zh: "符号需为 2-12 位大写字母或数字，且以字母开头。",
  },
  errDecimalsRange: {
    en: "Decimals must be an integer from 0 to 8.",
    zh: "精度需为 0-8 的整数。",
  },
  errInitialSupplyPositive: {
    en: "Initial supply must be greater than zero.",
    zh: "初始供应量必须大于零。",
  },
  errInitialSupplyPrecision: {
    en: "Initial supply has more decimals than the token allows.",
    zh: "初始供应量的小数位超过代币精度。",
  },
  errInitialSupplyFormat: {
    en: "Initial supply must be a positive decimal number.",
    zh: "初始供应量需为正的十进制数。",
  },
  errOwnerAddress: {
    en: "Owner must be a Neo N3 address or Hash160.",
    zh: "Owner 需为 Neo N3 地址或 Hash160。",
  },
  errTreasuryAddress: {
    en: "Treasury must be a Neo N3 address or Hash160.",
    zh: "金库需为 Neo N3 地址或 Hash160。",
  },
  errMaxSupplyRange: {
    en: "Max supply must be 1-1,000,000.",
    zh: "最大供应量需为 1-1,000,000。",
  },
  errRoyaltyRange: {
    en: "Royalty must be 0-1000 bps.",
    zh: "版税需为 0-1000 个基点 (bps)。",
  },
  errBaseUri: {
    en: "Base URI must be an HTTPS URL ending with '/'.",
    zh: "基础 URI 需为以 '/' 结尾的 HTTPS 链接。",
  },
  errAppIdFormat: {
    en: "MiniApp ID must start with miniapp- and use lowercase slugs.",
    zh: "小程序 ID 需以 miniapp- 开头并使用小写短横线格式。",
  },
  errAppNameLength: {
    en: "MiniApp name must be 3-64 characters.",
    zh: "小程序名称需为 3-64 个字符。",
  },
  errTemplateKind: {
    en: "Choose a supported template kind.",
    zh: "请选择支持的模板类型。",
  },
  errAdminAddress: {
    en: "Admin must be a Neo N3 address or Hash160.",
    zh: "管理员需为 Neo N3 地址或 Hash160。",
  },
  errFactoryNotConfigured: {
    en: "Factory contract is not configured for this network. Sync the deployed template registry hash before execution.",
    zh: "当前网络尚未配置 Factory 合约。执行前请同步已部署的模板注册表合约地址。",
  },
  errFactoryInvalid: {
    en: "Factory contract hash is invalid. Configure a Neo N3 Hash160 before execution.",
    zh: "Factory 合约地址无效。执行前请配置有效的 Neo N3 Hash160。",
  },

  // ── Warnings ──
  warnMainnetReview: {
    en: "Mainnet packages require signer, GAS, domain, and registry review before submission.",
    zh: "主网部署包在提交前需要复核签名者、GAS、域名和注册表配置。",
  },
  warnCatalogRegistration: {
    en: "The generated catalog patch must be synchronized to Notion and platform registries after deployment.",
    zh: "部署后需将生成的目录补丁同步到 Notion 和平台注册表。",
  },

  // ── Deploy checklist steps ──
  stepValidateTitle: { en: "Validate inputs", zh: "校验输入" },
  stepValidateReady: {
    en: "Names, symbols, owner, and parameter bounds are valid.",
    zh: "名称、符号、Owner 和参数范围均有效。",
  },
  stepValidateBlocked: {
    en: "Fix blocking errors before deployment.",
    zh: "部署前请先修复阻断错误。",
  },
  stepTemplateTitle: { en: "Select on-chain template", zh: "选择链上模板" },
  stepTemplateBlocked: {
    en: "Template metadata is deterministic, but the factory contract must be configured before execution.",
    zh: "模板元数据是确定性的，但执行前必须配置 Factory 合约。",
  },
  stepTemplateArtifactReady: {
    en: "Live-verified: the NEF and manifest artifact is preloaded on the Factory contract.",
    zh: "已链上验证：NEF 和 manifest 工件已预置在 Factory 合约中。",
  },
  stepTemplateMetadataOnly: {
    en: "Live-verified: only template metadata is registered — no deployable artifact exists on-chain yet.",
    zh: "已链上验证：当前仅注册了模板元数据，链上尚无可部署的工件。",
  },
  stepTemplateUnverified: {
    en: "Artifact status not verified yet — generate a plan to check the factory contract.",
    zh: "尚未验证工件状态——生成计划后将查询 Factory 合约。",
  },
  stepTemplateRecordDetail: {
    en: "MiniApp templates register an on-chain instance record; no artifact deployment is involved.",
    zh: "小程序模板登记链上实例记录，不涉及工件部署。",
  },
  stepDeployTitleNep17: {
    en: "Deploy NEP-17 from template",
    zh: "基于模板部署 NEP-17",
  },
  stepDeployTitleNep11: {
    en: "Deploy NEP-11 from template",
    zh: "基于模板部署 NEP-11",
  },
  stepDeployTitleMiniapp: {
    en: "Create platform miniapp from template",
    zh: "基于模板创建平台小程序",
  },
  stepDeployBlocked: {
    en: "Resolve the blocking errors above, then submit the deployment call.",
    zh: "请先解决上方阻断错误，再提交部署调用。",
  },
  stepDeployReadyDetail: {
    en: "Submit template ID and initialization parameters from this console — the factory deploys the preloaded artifact.",
    zh: "直接在本控制台提交模板 ID 和初始化参数，Factory 将部署预置工件。",
  },
  stepDeployArtifactMissing: {
    en: "Blocked: the template artifact is not registered on-chain yet, so no contract can be created. A factory admin must run registerTemplateArtifact first.",
    zh: "已阻断：模板工件尚未在链上注册，无法创建合约。需要 Factory 管理员先执行 registerTemplateArtifact。",
  },
  stepDeployUnverifiedDetail: {
    en: "Generate a plan to live-verify the template artifact before submitting.",
    zh: "请先生成计划以在线验证模板工件，再提交。",
  },
  stepDeployRecordDetail: {
    en: "Submit the registration from this console — the factory stores the miniapp instance record.",
    zh: "直接在本控制台提交登记，Factory 将存储小程序实例记录。",
  },
  stepDeployTemplateMissing: {
    en: "Blocked: this template id is not registered on the factory contract.",
    zh: "已阻断：该模板 ID 未在 Factory 合约中注册。",
  },
  stepBindTitle: {
    en: "Bind domain and catalog metadata",
    zh: "绑定域名与目录元数据",
  },
  stepBindDetail: {
    en: "Record contract hash, NeoNS domain, network, and OneGate launch URL in the shared registry.",
    zh: "在共享注册表中记录合约地址、NeoNS 域名、网络和 OneGate 启动链接。",
  },
  stepStatusReady: { en: "Ready", zh: "就绪" },
  stepStatusManual: { en: "Manual", zh: "人工" },
  stepStatusBlocked: { en: "Blocked", zh: "阻断" },
  stepStatusPending: { en: "Pending", zh: "待完成" },

  // ── Execution ──
  executeDeployAction: { en: "Deploy via factory", zh: "通过 Factory 部署" },
  executeRecordAction: { en: "Register on-chain", zh: "链上登记" },
  executeSubmitted: {
    en: "Transaction submitted — confirmation pending.",
    zh: "交易已提交，等待链上确认。",
  },
  executeConfirmed: {
    en: "Factory execution confirmed on-chain.",
    zh: "Factory 执行已在链上确认。",
  },
  executeFailed: { en: "Factory execution failed.", zh: "Factory 执行失败。" },
  alreadyExecuted: {
    en: "This exact plan was already submitted. Change the inputs and regenerate to create a new package.",
    zh: "该计划已提交过。请修改输入并重新生成以创建新部署包。",
  },
  artifactNotRegistered: {
    en: "Template artifact not registered on-chain yet — deploying now would only store a record without creating a contract. Execution stays blocked until a factory admin preloads the artifact.",
    zh: "模板工件尚未在链上注册——现在部署只会存储记录而不会创建合约。在 Factory 管理员预置工件之前，执行保持阻断。",
  },
  artifactUnverified: {
    en: "The template artifact status could not be verified on-chain. Check your connection and regenerate the plan.",
    zh: "无法在链上验证模板工件状态。请检查网络连接并重新生成计划。",
  },
  templateNotRegistered: {
    en: "This template is not registered on the factory contract for the selected network.",
    zh: "所选网络的 Factory 合约中未注册该模板。",
  },
  lastTxidLabel: { en: "Transaction", zh: "交易" },
  deployedContractLabel: { en: "Deployed contract", zh: "已部署合约" },
  estimatedFee: { en: "Estimated network fee", zh: "预估网络费用" },
  estimatedFeeValue: { en: "≈ {amount} GAS", zh: "≈ {amount} GAS" },

  // ── Template artifact status ──
  artifactStatusLabel: { en: "Template artifact", zh: "模板工件" },
  artifactStatusPreloaded: { en: "Preloaded on-chain", zh: "已链上预置" },
  artifactStatusMetadataOnly: { en: "Metadata only", zh: "仅元数据" },
  artifactStatusNotRegistered: { en: "Not registered", zh: "未注册" },
  artifactStatusUnverified: { en: "Unverified", zh: "未验证" },

  // ── On-chain creations ──
  myDeployments: { en: "On-chain creations", zh: "链上创建记录" },
  operationalDetails: { en: "Operational details", zh: "运维细节" },
  operationalDetailsHint: {
    en: "History, launch link, and registry notes.",
    zh: "历史记录、启动链接和注册表说明。",
  },
  deploymentsCount: {
    en: "{count} recorded on-chain",
    zh: "链上共 {count} 条记录",
  },
  refreshAction: { en: "Refresh", zh: "刷新" },
  loadingDeployments: {
    en: "Loading on-chain records…",
    zh: "正在加载链上记录…",
  },
  deploymentsError: {
    en: "Could not load on-chain records.",
    zh: "无法加载链上记录。",
  },
  retryAction: { en: "Retry", zh: "重试" },
  noDeploymentsYet: {
    en: "No packages recorded on-chain yet.",
    zh: "链上还没有部署包记录。",
  },
  mineTag: { en: "Yours", zh: "我的" },
  recordOnly: {
    en: "Record only — no contract deployed",
    zh: "仅记录——未部署合约",
  },
  copyContractHash: { en: "Copy contract hash", zh: "复制合约地址" },

  // ── Form & misc ──
  useMyAddress: { en: "Use my address", zh: "使用我的地址" },
  deploymentSetup: { en: "Deployment setup", zh: "部署设置" },
  deploymentSetupHint: {
    en: "Network, owner, treasury, and metadata details.",
    zh: "网络、Owner、金库和元数据细节。",
  },
  royaltyHelper: {
    en: "{bps} bps = {percent}% of each sale",
    zh: "{bps} bps = 每笔销售的 {percent}%",
  },
  draft: { en: "Draft", zh: "草稿" },
  networkTestnet: { en: "Testnet", zh: "测试网" },
  networkMainnet: { en: "Mainnet", zh: "主网" },
  networkOptionTestnet: { en: "Neo N3 Testnet", zh: "Neo N3 测试网" },
  networkOptionMainnet: { en: "Neo N3 Mainnet", zh: "Neo N3 主网" },
  templateKindRewardVault: { en: "Reward vault", zh: "奖励金库" },
  templateKindTicketPass: { en: "Event ticket pass", zh: "活动门票通行证" },
  templateKindCertificate: { en: "Soulbound certificate", zh: "灵魂绑定证书" },
  templateKindOracleConsole: { en: "Oracle console", zh: "预言机控制台" },
  templateKindRewardVaultHint: {
    en: "Token rewards, campaigns, and claim rails.",
    zh: "代币奖励、活动和领取通道。",
  },
  templateKindTicketPassHint: {
    en: "Event access, QR claims, and attendee records.",
    zh: "活动准入、二维码领取和参与记录。",
  },
  templateKindCertificateHint: {
    en: "Issued credentials with non-transferable proof.",
    zh: "带不可转让证明的证书凭证。",
  },
  templateKindOracleConsoleHint: {
    en: "Data-backed workflow for prices or feeds.",
    zh: "面向价格或数据源的数据工作流。",
  },
  copySignature: { en: "Copy signature", zh: "复制签名" },

  // ── Live preview card (what this factory will create) ──
  previewTitle: { en: "Preview", zh: "预览" },
  previewHint: {
    en: "Live preview of what this template will create.",
    zh: "此模板将创建内容的实时预览。",
  },
  tokenStudio: { en: "Token mint studio", zh: "代币铸造台" },
  tokenStudioHint: {
    en: "{symbol} supply, treasury, and mint policy update this asset live.",
    zh: "{symbol} 的供应量、金库和增发策略会实时更新此资产。",
  },
  launchStudio: { en: "Launch studio", zh: "发布工作台" },
  launchStudioHint: {
    en: "{appId} will become a catalog-ready launch record.",
    zh: "{appId} 将成为可进入目录的启动记录。",
  },
  templateDockHint: {
    en: "Pick the product pattern first; parameters stay below.",
    zh: "先选择产品模式；参数保留在下方。",
  },
  dropStudio: { en: "Drop studio", zh: "发行工作台" },
  dropStudioHint: {
    en: "{symbol} collection parameters update the preview live.",
    zh: "{symbol} 集合参数会实时更新预览。",
  },
  dropComposer: { en: "Drop composer", zh: "发行编排器" },
  dropComposerHint: {
    en: "Shape supply and transfer behavior from the drop deck before editing raw fields.",
    zh: "先在发行牌组里设定供应量和转让行为，再编辑原始字段。",
  },
  dropSupplyPresets: { en: "Supply presets", zh: "供应量预设" },
  dropSupplyPreset: { en: "Edition run", zh: "发行批次" },
  dropPolicyTransferableDetail: {
    en: "Collectors can move tokens after mint.",
    zh: "铸造后持有人可以转移。",
  },
  dropPolicySoulboundDetail: {
    en: "Tokens stay bound to the first owner.",
    zh: "通证永久绑定首个持有人。",
  },
  previewUntitledCollection: { en: "Untitled collection", zh: "未命名集合" },
  previewUntitledToken: { en: "Untitled token", zh: "未命名代币" },
  previewUntitledApp: { en: "Untitled miniapp", zh: "未命名小程序" },
  previewSymbolPlaceholder: { en: "SYMBOL", zh: "符号" },
  previewMaxSupply: { en: "Max supply", zh: "最大供应量" },
  previewMaxSupplyUnlimited: { en: "Unlimited", zh: "无上限" },
  previewRoyalty: { en: "Royalty", zh: "版税" },
  previewTransferPolicy: { en: "Transfer policy", zh: "转让策略" },
  previewTransferable: { en: "Transferable", zh: "可转让" },
  previewSoulbound: { en: "Soulbound", zh: "灵魂绑定" },
  previewSampleNftName: { en: "{name} #1", zh: "{name} #1" },
  previewSupply: { en: "Supply", zh: "供应量" },
  previewMintPolicy: { en: "Mint policy", zh: "增发策略" },
  previewMintable: { en: "Mintable", zh: "可增发" },
  previewFixedSupply: { en: "Fixed supply", zh: "固定供应" },
  previewTemplate: { en: "Template", zh: "模板" },
  previewServices: { en: "Services", zh: "服务" },
  previewServiceNone: { en: "None", zh: "无" },
  previewServiceOracle: { en: "Oracle", zh: "预言机" },
  previewServiceOneGate: { en: "OneGate", zh: "OneGate" },
  previewLaunchState: { en: "Launch state", zh: "启动状态" },
  previewReadyToRegister: { en: "Ready to register", zh: "可登记" },
  studioFlowLabel: { en: "Factory studio workflow", zh: "工厂工作流" },
  studioPipeline: { en: "Build pipeline", zh: "创建流程" },
} as const;
