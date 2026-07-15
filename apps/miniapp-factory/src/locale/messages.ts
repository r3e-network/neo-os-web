import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "MiniApp Studio", zh: "小程序创建工作台" },
  subtitle: {
    en: "Shape a starter package, verify its template, then register an explicit Factory record for operator handoff.",
    zh: "设计小程序启动包、核验模板，再明确登记 Factory 记录并交给运营者接入。",
  },
  chooseTemplate: { en: "Choose an app experience", zh: "选择小程序体验" },
  templateKindRewardVault: { en: "Reward vault", zh: "奖励金库" },
  templateKindRewardVaultHint: {
    en: "A focused reward experience with wallet-backed claims.",
    zh: "围绕钱包领取奖励的专注体验。",
  },
  templateKindTicketPass: { en: "Ticket pass", zh: "活动通行证" },
  templateKindTicketPassHint: {
    en: "An event-first pass for issuing and presenting admission.",
    zh: "用于发放和展示入场凭证的活动体验。",
  },
  templateKindCertificate: { en: "Certificate", zh: "链上证书" },
  templateKindCertificateHint: {
    en: "A clean wallet-bound credential and verification experience.",
    zh: "清晰的钱包绑定凭证与验证体验。",
  },
  templateKindOracleConsole: { en: "Oracle console", zh: "预言机控制台" },
  templateKindOracleConsoleHint: {
    en: "A live-data workspace for reading and requesting Oracle results.",
    zh: "用于读取和请求预言机结果的实时数据工作台。",
  },
  studioStageTitle: { en: "MiniApp creation studio", zh: "小程序创建工作台" },
  studioImageAlt: {
    en: "Bright application studio with reward, ticket, certificate and Oracle workstations",
    zh: "包含奖励、门票、证书和预言机工作区的明亮应用工作室",
  },
  creationJourney: { en: "Creation journey", zh: "创建进度" },
  journeyChoose: { en: "Choose", zh: "选择体验" },
  journeyGenerate: { en: "Generate", zh: "生成启动包" },
  journeyGenerateHint: { en: "Lock a deterministic package", zh: "锁定确定性启动包" },
  journeyRegister: { en: "Register", zh: "测试网登记" },
  journeyRegisterHint: { en: "Write one Factory registry record", zh: "写入一条 Factory 注册记录" },
  journeyOperator: { en: "Operator handoff", zh: "运营交接" },
  journeyOperatorHint: {
    en: "Implement the app surface and sync its catalog entry",
    zh: "实现应用界面并同步目录条目",
  },
  // Store-facing entry chrome must not headline a TESTNET badge. The studio
  // still targets exactly one configured Factory registry and that fact still
  // matters, so the chip names the *capability* and the scope explainer below
  // states the target network once, in a sentence, where the user is actually
  // deciding. The precise network keeps appearing at the moment it is
  // load-bearing: the register CTA (`registerTestnetRecord`) and the wallet
  // guard (`testnetRequired`).
  registryScope: { en: "Factory registry", zh: "Factory 注册表" },
  fixedRegistryTarget: { en: "Fixed registry target", zh: "固定注册目标" },
  fixedRegistryTargetHint: {
    en: "This release registers to one configured Neo N3 TestNet Factory and never switches networks silently.",
    zh: "当前版本只登记到一个已配置的 Neo N3 测试网 Factory，不会静默切换网络。",
  },
  shapeYourMiniApp: { en: "Shape your MiniApp", zh: "设计你的小程序" },
  shapeYourMiniAppHint: {
    en: "Pick an experience first; only name and identity stay in the main flow.",
    zh: "先选择体验；主流程只保留名称和身份信息。",
  },
  draftReady: { en: "Ready to package", zh: "可生成启动包" },
  draftNeedsWork: { en: "One detail needed", zh: "还需补充一项" },
  appNamePlaceholder: { en: "Community rewards", zh: "社区奖励站" },
  appNameHint: { en: "Shown to users in the catalog and app chrome.", zh: "将显示在应用目录和小程序界面中。" },
  appIdHint: { en: "A stable lowercase ID beginning with miniapp-.", zh: "以 miniapp- 开头的稳定小写 ID。" },
  advancedSetup: { en: "Admin and capabilities", zh: "管理员与能力" },
  advancedSetupHint: { en: "Wallet owner, fixed network and optional services", zh: "钱包管理员、固定网络和可选服务" },
  adminHint: { en: "The account authorized in the generated registration parameters.", zh: "写入生成登记参数的授权账户。" },
  // A literal "N..." placeholder reads as truncated/broken text rather than a
  // format hint. Name the accepted formats instead.
  adminPlaceholder: { en: "Neo N3 address or Hash160", zh: "Neo N3 地址或 Hash160" },
  // Shown instead of `fixHighlightedFields` while the admin field is still
  // pristine: nothing is highlighted yet, so point at the field by name in
  // guidance voice rather than telling the user to fix an error they have not
  // made.
  adminNeededHint: {
    en: "Add an admin address under Admin and capabilities to generate the package.",
    zh: "在“管理员与能力”中填写管理员地址后即可生成启动包。",
  },
  useMyAddress: { en: "Use connected wallet", zh: "使用已连接钱包" },
  needsOneGate: { en: "OneGate launch", zh: "OneGate 启动" },
  needsOneGateHint: { en: "Include a OneGate launch binding in the package.", zh: "在启动包中加入 OneGate 启动绑定。" },
  needsOracle: { en: "Oracle data", zh: "预言机数据" },
  needsOracleHint: { en: "Add Oracle read/request permissions to the starter.", zh: "为启动应用加入预言机读取和请求权限。" },
  resetDraft: { en: "Reset studio", zh: "重置工作台" },
  liveAppPreview: { en: "App preview", zh: "应用预览" },
  liveAppPreviewHint: { en: "A product-shaped preview, not a deployment claim.", zh: "呈现产品形态，但不代表已部署或上线。" },
  previewUntitledApp: { en: "Untitled MiniApp", zh: "未命名小程序" },
  previewTemplate: { en: "Experience", zh: "体验类型" },
  previewServices: { en: "Services", zh: "接入服务" },
  previewServiceOneGate: { en: "OneGate", zh: "OneGate" },
  previewServiceOracle: { en: "Oracle", zh: "预言机" },
  previewServiceNone: { en: "Platform only", zh: "仅平台能力" },
  catalogCategory: { en: "Catalog category", zh: "目录分类" },
  catalogCategoryDefi: { en: "DeFi", zh: "DeFi" },
  catalogCategorySocial: { en: "Social", zh: "社交" },
  catalogCategoryOracle: { en: "Oracle", zh: "预言机" },
  catalogCategoryTool: { en: "Tool", zh: "工具" },
  catalogCategoryGame: { en: "Game", zh: "游戏" },
  catalogCategoryGovernance: { en: "Governance", zh: "治理" },
  catalogCategoryConsole: { en: "Console", zh: "控制台" },
  draftPreview: { en: "Live draft", zh: "实时草稿" },
  nextAction: { en: "Next", zh: "下一步" },
  templateStatus: { en: "Template record", zh: "模板记录" },
  templateRecordVerified: { en: "Verified on chain", zh: "链上已核验" },
  templateRecordMissing: { en: "Not registered", zh: "尚未登记" },
  // `unverified` is the default for an offline plan build: on first paint the
  // template artifact has simply not been probed yet. "Verification
  // unavailable" stamped a failure-shaped badge on the entry surface for a
  // normal pre-read state. Say what is actually true instead. (Same reframing
  // as asset-factory's `artifactStatusUnverified`.)
  templateRecordUnverified: { en: "Not checked yet", zh: "尚未核对" },
  estimatedFee: { en: "Estimated network fee", zh: "预估网络费" },
  generateRegistrationPackage: { en: "Generate starter package", zh: "生成小程序启动包" },
  generatingPackage: { en: "Generating package…", zh: "正在生成启动包…" },
  generatePackageHint: {
    en: "Creates deterministic files locally and checks the selected template. No wallet transaction yet.",
    zh: "在本地生成确定性文件并核验所选模板，此时不会发起钱包交易。",
  },
  registerTestnetRecord: { en: "Register testnet record", zh: "登记测试网记录" },
  registerRecordHint: {
    en: "Your wallet will review one createMiniAppFromTemplate call. This records metadata; it does not deploy the finished app.",
    zh: "钱包将确认一次 createMiniAppFromTemplate 调用。它只登记元数据，不会部署完整应用。",
  },
  registrationUnavailable: { en: "Registration unavailable", zh: "暂不可登记" },
  registrationRecorded: { en: "Registry record confirmed", zh: "注册记录已确认" },
  registrationCheckHint: {
    en: "The wallet returned a transaction. Check the registry readback before operator handoff.",
    zh: "钱包已返回交易，请先核对注册表读取结果，再进行运营交接。",
  },
  operatorSyncHint: {
    en: "The record is confirmed. An operator must still implement, review and sync the generated app entry.",
    zh: "记录已确认；运营者仍需实现、复核并同步生成的应用条目。",
  },
  templateVerificationRequired: {
    en: "Registration stays locked until the selected template can be read from the configured testnet Factory.",
    zh: "只有从已配置的测试网 Factory 读取到所选模板后，才会开放登记。",
  },
  fixHighlightedFields: { en: "Complete the highlighted detail first.", zh: "请先补全高亮信息。" },
  actionNeedsAttention: { en: "Action needs attention", zh: "此操作需要处理" },
  generatedArtifacts: { en: "Generated package", zh: "生成的启动包" },
  generatedArtifactsHint: { en: "Catalog patch, starter manifest, binding and exact registration plan", zh: "目录补丁、启动 manifest、绑定文件和精确登记计划" },
  catalogPatch: { en: "Catalog patch", zh: "目录补丁" },
  starterManifest: { en: "Starter manifest", zh: "启动 manifest" },
  bindingCode: { en: "Factory binding", zh: "Factory 绑定" },
  registrationPlan: { en: "Registration plan", zh: "登记计划" },
  generatedFromLockedPlan: { en: "Locked deterministic output", zh: "已锁定的确定性产物" },
  draftArtifactPreview: { en: "Preview only — generate to lock", zh: "仅供预览——生成后锁定" },
  copyArtifact: { en: "Copy file", zh: "复制文件" },
  exportPackage: { en: "Export package", zh: "导出启动包" },
  copied: { en: "Copied", zh: "已复制" },
  copyFailed: { en: "Copy unavailable", zh: "暂无法复制" },
  developerSignature: { en: "Developer signature", zh: "开发者签名" },
  developerSignatureHint: { en: "Optional portable commitment to this exact package", zh: "可选：对当前精确启动包做可携带承诺" },
  signatureOptional: { en: "Optional; not required for testnet registration.", zh: "可选，不是测试网登记的必要条件。" },
  registrationIdle: { en: "No pending registration", zh: "没有待处理登记" },
  registrationChecking: { en: "Checking registry…", zh: "正在核对注册表…" },
  registrationSubmitting: { en: "Waiting for wallet…", zh: "等待钱包确认…" },
  registrationSubmittedAwaitingRead: { en: "Transaction submitted; awaiting readback", zh: "交易已提交，等待读取确认" },
  registrationConfirmed: { en: "Registry record confirmed", zh: "注册记录已确认" },
  registrationMismatch: { en: "Registry record does not match this package", zh: "注册记录与当前启动包不一致" },
  registrationUncertain: { en: "Submission outcome is uncertain", zh: "提交结果尚不确定" },
  registrationReadUnavailable: { en: "Registry readback unavailable", zh: "暂时无法读取注册表" },
  registrationRecoveryHint: { en: "A saved submission can be checked again after refresh.", zh: "已保存的提交可在刷新后重新核对。" },
  checkRegistration: { en: "Check record", zh: "核对记录" },
  registryHistory: { en: "Recent registry records", zh: "最近登记记录" },
  // Count-agnostic shape: this summary renders with count=1 on a fresh visit,
  // and "1 registry records" is broken English.
  registryHistoryHint: { en: "Registry records · {count}", zh: "注册记录 · {count}" },
  loadingDeployments: { en: "Loading registry records…", zh: "正在加载注册记录…" },
  deploymentsCount: { en: "Showing recent records · {count} total", zh: "显示最近记录 · 共 {count} 条" },
  refreshAction: { en: "Refresh", zh: "刷新" },
  deploymentsError: { en: "Registry history is temporarily unavailable.", zh: "注册记录暂时无法读取。" },
  noDeploymentsYet: { en: "No registry records returned yet.", zh: "暂未读取到注册记录。" },
  validationDetails: { en: "Validation and handoff notes", zh: "校验与交接说明" },
  validationDetailsHint: { en: "Only details that need review", zh: "仅展示需要复核的细节" },
  productionBoundaryTitle: { en: "What this studio produces", zh: "本工作台的实际产物" },
  productionBoundaryBody: {
    en: "It generates starter files and can register one Factory registry record. It does not implement the final PlayArea, deploy a contract, sync the platform catalog or publish a working app.",
    zh: "它会生成启动文件，并可登记一条 Factory 注册记录；不会实现最终 PlayArea、部署合约、同步平台目录或发布可运行应用。",
  },
  packageReady: { en: "Starter package ready", zh: "启动包已就绪" },
  packageBlocked: { en: "Package needs attention", zh: "启动包需要处理" },
  planDraftReady: { en: "Ready to shape", zh: "可开始设计" },
  planGenerateFailed: { en: "The package could not be generated. Try again.", zh: "暂时无法生成启动包，请重试。" },
  testnetRequired: { en: "Switch the wallet to Neo N3 TestNet and try again.", zh: "请将钱包切换到 Neo N3 测试网后重试。" },
  registrationTxMissing: { en: "The wallet returned no transaction ID, so registration is not confirmed.", zh: "钱包未返回交易 ID，因此不能确认登记成功。" },
  registrationSubmitted: { en: "Registration transaction submitted; checking the Factory record.", zh: "登记交易已提交，正在核对 Factory 记录。" },
  registrationFailed: { en: "The registration was not completed. Check the wallet and try again.", zh: "登记未完成，请检查钱包后重试。" },
  registrationPlanInvalid: { en: "This package no longer matches the configured testnet Factory. Generate it again.", zh: "当前启动包与已配置的测试网 Factory 不再匹配，请重新生成。" },
  alreadyExecuted: { en: "This exact package already has a submitted registration.", zh: "当前启动包已经提交过登记。" },
  planChangedDuringSign: { en: "The package changed while signing. Review and sign the new package.", zh: "签名期间启动包发生变化，请复核并签名新启动包。" },
  walletCancelled: { en: "The wallet request was cancelled. Nothing was registered.", zh: "钱包请求已取消，没有登记任何记录。" },
  walletSigningUnsupported: { en: "This wallet cannot sign the package message.", zh: "当前钱包不支持启动包消息签名。" },
  warnCatalogRegistration: {
    en: "Operator step: implement the template-specific app surface, then review and sync the generated catalog patch.",
    zh: "运营步骤：实现模板对应的应用界面，再复核并同步生成的目录补丁。",
  },
  signPlanDescription: {
    en: "Optionally sign the exact deterministic package as a developer handoff commitment.",
    zh: "可选：签名当前确定性启动包，作为开发交接承诺。",
  },
  docWhatItIsBody: {
    en: "MiniApp Studio generates deterministic starter files for four product-shaped templates and can register the selected package in the configured testnet Factory.",
    zh: "小程序创建工作台可为四种产品化模板生成确定性启动文件，并将所选启动包登记到已配置的测试网 Factory。",
  },
  docSupportedTemplatesBody: {
    en: "Reward vault, event pass, wallet-bound certificate and Oracle console starters. Each still requires a real product implementation before catalog publication.",
    zh: "支持奖励金库、活动通行证、钱包绑定证书和预言机控制台启动包；每一种仍需完成真实产品实现后才能发布到目录。",
  },
  docSafetyModel: { en: "Registration boundary", zh: "登记边界" },
  docSafetyModelBody: {
    en: "Inputs produce a deterministic digest. Live template verification gates the registry action, and a saved transaction snapshot supports honest refresh recovery.",
    zh: "输入会生成确定性摘要；实时模板核验控制登记操作，并通过保存交易快照实现诚实的刷新恢复。",
  },
} as const;

export const messages = mergeMessages(appMessages);
