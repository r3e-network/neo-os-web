import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "Asset Factory", zh: "资产工厂" },
  subtitle: {
    en: "Shape supply, ownership, treasury, and mint policy in a live NEP-17 studio. Generate a deterministic blueprint, review it, then sign the exact digest with your wallet.",
    zh: "在可视化 NEP-17 工作室中设定供应量、Owner、金库和增发策略。生成确定性蓝图、完成复核，再用钱包签名这一份精确摘要。",
  },
  subtitleShort: {
    en: "Design, validate, and sign a deterministic NEP-17 issuance blueprint.",
    zh: "设计、校验并签名一份确定性的 NEP-17 发行蓝图。",
  },
  factoryOverview: { en: "Issuance studio", zh: "发行工作室" },
  activeTemplate: { en: "Asset standard", zh: "资产标准" },
  packageReady: { en: "Blueprint ready", zh: "蓝图可审核" },
  generatePlan: { en: "Lock issuance blueprint", zh: "锁定发行蓝图" },
  signPlanAction: { en: "Sign issuer commitment", zh: "签名发行承诺" },
  signPlanTitle: { en: "Issuer commitment", zh: "发行方承诺" },
  signed: { en: "Signature captured", zh: "已获取签名" },
  planSigned: {
    en: "Issuer signature captured; no deployment was submitted",
    zh: "已获取发行方签名；未提交任何部署",
  },
  walletSignature: {
    en: "Captured wallet signature (not independently verified)",
    zh: "已获取的钱包签名（未独立验证）",
  },
  signPlanDescription: {
    en: "Ask the connected Owner wallet to sign the deterministic blueprint digest. This app records the wallet response but does not independently verify the returned signature, and it never broadcasts a deployment transaction.",
    zh: "请求已连接的 Owner 钱包签名确定性的蓝图摘要。本应用会记录钱包返回结果，但不会独立验证该签名，也绝不会广播部署交易。",
  },
  planDraftReadyDetail: {
    en: "Lock this live design into a portable, reviewable, wallet-signable blueprint.",
    zh: "把当前实时设计锁定为可携带、可审核、可由钱包签名的蓝图。",
  },
  planLockedDetail: {
    en: "Blueprint locked. Review the digest and parameters, then sign with the issuer wallet.",
    zh: "蓝图已锁定。复核摘要和参数后，使用发行方钱包签名。",
  },
  planBlockedDetail: {
    en: "Resolve the listed issue before locking or signing the blueprint.",
    zh: "请先解决列出的问题，再锁定或签名蓝图。",
  },
  publishPackage: { en: "Issuance blueprint", zh: "发行蓝图" },
  deployChecklist: { en: "Release readiness", zh: "发行就绪检查" },
  deployChecklistHint: {
    en: "Inputs, template evidence, certification, and registry handoff.",
    zh: "检查参数、模板证据、部署认证和注册表交接。",
  },
  deploymentSetup: { en: "Issuer and network", zh: "发行方与网络" },
  deploymentSetupHint: {
    en: "Owner, treasury, decimals, and blueprint target.",
    zh: "Owner、金库、精度和蓝图目标网络。",
  },
  // This release has no execute stage (`showExecuteAction={false}`), so the
  // pipeline no longer renders a deploy step. Kept neutral for any surface that
  // still names the capability rather than advertising it as failed.
  executeDeployAction: { en: "Contract creation", zh: "合约创建" },
  stepDeployTitleNep17: {
    en: "Certify unique NEP-17 artifact",
    zh: "认证独立 NEP-17 工件",
  },
  stepDeployReadyDetail: {
    en: "The creator-specific NEF, manifest, and artifact digest are complete; live deployment remains locked until the upgraded Factory and recovery lifecycle are certified.",
    zh: "创作者专属 NEF、manifest 与工件摘要已经完整生成；链上部署仍需等待升级后的 Factory 与恢复生命周期完成认证。",
  },
  stepDeployUnverifiedDetail: {
    en: "The creator artifact is complete, but the live governed artifact and exact Factory ABI have not been verified.",
    zh: "创作者工件已经完整生成，但链上受治理工件与精确 Factory ABI 尚未完成核验。",
  },
  artifactUnverified: {
    en: "Deployment is locked: the creator-specific artifact is complete, but the live Factory ABI and transaction recovery lifecycle have not yet been certified.",
    zh: "部署已锁定：创作者专属工件已经完整生成，但链上 Factory ABI 与交易恢复生命周期尚未完成认证。",
  },
  uniqueArtifactRequired: {
    en: "The artifact package is complete, but deployment remains locked until the live Factory upgrade and end-to-end write recovery are certified.",
    zh: "工件发行包已经完整，但在链上 Factory 升级和端到端写入恢复完成认证前，部署仍保持锁定。",
  },
  stepDeployUniqueArtifactRequired: {
    en: "Blocked: all six artifact arguments are bound, but the deployed Factory ABI and transaction/event/readback lifecycle are not yet certified.",
    zh: "已阻断：六个工件参数均已绑定，但已部署 Factory ABI 与交易、事件、回读生命周期尚未完成认证。",
  },
  // `unverified` means "no live confirmation from the chain yet" — on first
  // paint the template artifact has simply not been probed. Say that plainly
  // instead of stamping a failure-shaped "Unverified" badge on the entry
  // surface for what is a normal pre-read state.
  artifactStatusUnverified: { en: "Not checked yet", zh: "尚未核对" },
  artifactNotRegistered: {
    en: "This live template is metadata-only. The creator artifact is complete locally, but a Factory admin must register the exact governed artifact before deployment.",
    zh: "当前链上模板仅包含元数据。创作者工件已在本地完整生成，但部署前仍需 Factory 管理员注册精确的受治理工件。",
  },
  stepDeployArtifactMissing: {
    en: "Blocked: the current chain template cannot create a contract. Register the exact generated artifact and certify the upgraded Factory lifecycle first.",
    zh: "已阻断：当前链上模板无法创建合约。请先注册精确的生成工件，并完成升级后 Factory 生命周期认证。",
  },
  deployHonesty: {
    en: "This release never broadcasts a Factory write. It now produces the complete creator-unique deployArtifactFromTemplate package, but the configured TestNet Factory still lacks the reviewed ABI and the transaction/event/readback recovery lane is not certified.",
    zh: "当前版本不会广播任何 Factory 写操作。它已能生成完整的创作者独立 deployArtifactFromTemplate 发行包，但配置的测试网 Factory 仍缺少已审查 ABI，且交易、事件、回读恢复流程尚未完成认证。",
  },
  docWhatItIsBody: {
    en: "Asset Factory is a focused NEP-17 issuance studio. It turns product choices into a deterministic blueprint, validates the parameters, supports wallet signing, and can recover a matching factory record without sending a transaction.",
    zh: "资产工厂是专注于 NEP-17 的发行工作室。它把产品选择转换为确定性蓝图，校验参数，支持钱包签名，并可在不发送交易的情况下恢复匹配的 Factory 链上记录。",
  },
  docSupportedTemplatesBody: {
    en: "The current blueprint covers NEP-17 name, symbol, decimals, initial supply, owner, treasury, mintability, and standard transfer policy. Mainnet deployment is not enabled.",
    zh: "当前蓝图覆盖 NEP-17 名称、符号、精度、初始供应量、Owner、金库、是否可增发和标准转账策略。主网部署未开放。",
  },
  docSafetyModelBody: {
    en: "Blueprint signing and chain-record recovery are separate from deployment. Every recovered record must match package ID, template, digest, and issuer. A record without a contract hash stays record-only and is never presented as an issued token.",
    zh: "蓝图签名和链上记录恢复与部署完全分离。恢复记录必须同时匹配计划 ID、模板、摘要和发行方；没有合约哈希的记录只会显示为“仅记录”，绝不会被呈现为已经发行的代币。",
  },
  docSafetyModel: { en: "Release model", zh: "发行模式" },
  deploymentSafetyTitle: {
    en: "Issuance blueprint studio",
    zh: "发行蓝图工作室",
  },
  // Store-facing first screen: lead with what the studio does, and state the
  // scope boundary once, calmly, in product voice. The engineering detail
  // (unique-artifact certification against the configured Factory) belongs in
  // the release notes below, not in the entry banner.
  deploymentSafetyBody: {
    en: "Design, lock, sign, and export a deterministic NEP-17 blueprint, then match it against the on-chain record. Contract creation is not part of this release.",
    zh: "设计、锁定、签名并导出确定性的 NEP-17 蓝图，再与链上记录逐项核对。合约创建不在当前版本范围内。",
  },
  deploymentLive: { en: "Deployment live", zh: "部署已开放" },
  blueprintMode: { en: "Blueprint mode", zh: "蓝图模式" },
  walletConnectedShort: { en: "Wallet connected", zh: "钱包已连接" },
  walletOptionalShort: {
    en: "Wallet needed only to sign",
    zh: "仅签名时需要钱包",
  },
  journalReadyShort: { en: "Refresh recovery ready", zh: "刷新恢复已就绪" },
  journalRestoredShort: { en: "Blueprint restored", zh: "已恢复上次蓝图" },
  journalUnavailableShort: {
    en: "Refresh recovery unavailable",
    zh: "刷新恢复当前不可用",
  },
  assetTestnetOnly: {
    en: "This Asset Factory release supports TestNet blueprints only.",
    zh: "当前 Asset Factory 版本仅支持测试网发行蓝图。",
  },
  checkRecord: { en: "Check chain record", zh: "核对链上记录" },
  checkingRecord: { en: "Checking…", zh: "核对中…" },
  noPlanToRecover: {
    en: "Lock a blueprint before checking its chain record.",
    zh: "请先锁定蓝图，再核对对应的链上记录。",
  },
  deploymentCertificationPending: {
    en: "Deployment is unavailable until the live Factory ABI, governed artifacts, and transaction recovery lifecycle pass end-to-end certification.",
    zh: "链上 Factory ABI、受治理工件与交易恢复生命周期通过端到端认证前，部署功能不可用。",
  },
  signatureWalletChanged: {
    en: "Wallet changed, so the previous signature was cleared. Sign again with the current issuer wallet.",
    zh: "检测到钱包已切换，旧签名已清除。请使用当前发行方钱包重新签名。",
  },
  connectIssuerWallet: {
    en: "Connect the declared issuer wallet before signing this blueprint.",
    zh: "请先连接蓝图中声明的发行方钱包，再进行签名。",
  },
  issuerWalletMismatch: {
    en: "The connected wallet is not this blueprint's Owner. Switch to the issuer wallet before signing.",
    zh: "当前钱包不是蓝图中的 Owner。请切换到发行方钱包后再签名。",
  },
  signatureContextChanged: {
    en: "The plan or wallet changed during approval, so the signature was discarded. Review and sign again.",
    zh: "钱包确认期间蓝图或钱包发生了变化，签名已丢弃。请重新复核并签名。",
  },
  recovery_confirmed: {
    en: "A matching Factory record with a non-empty contract hash was found. The token contract ABI and state were not inspected by this check.",
    zh: "已找到匹配且包含非空合约哈希的 Factory 记录。本次核对未检查代币合约 ABI 和状态。",
  },
  "recovery_record-only": {
    en: "The record matches, but it contains no deployed contract hash.",
    zh: "链上记录匹配，但其中没有已部署合约哈希。",
  },
  recovery_unconfirmed: {
    en: "No exact chain record was found. Nothing has been marked as deployed.",
    zh: "未找到精确匹配的链上记录，当前不会标记为已部署。",
  },
  recovery_mismatch: {
    en: "A record was returned, but its template, digest, package, or issuer does not match this blueprint.",
    zh: "链上返回了记录，但模板、摘要、计划 ID 或发行方与当前蓝图不匹配。",
  },
  recovery_unavailable: {
    en: "The Factory record could not be read right now. The blueprint remains unchanged; retry when TestNet RPC is available.",
    zh: "当前无法读取 Factory 记录。蓝图不会发生变化；请在测试网 RPC 恢复后重试。",
  },
  recoveryTitle_confirmed: {
    en: "Factory record confirmed",
    zh: "Factory 记录已确认",
  },
  deployedContractLabel: {
    en: "Factory-recorded contract hash",
    zh: "Factory 记录的合约哈希",
  },
  "recoveryTitle_record-only": { en: "Record only", zh: "仅有链上记录" },
  recoveryTitle_unconfirmed: { en: "Not confirmed", zh: "尚未确认" },
  recoveryTitle_mismatch: { en: "Record mismatch", zh: "链上记录不匹配" },
  recoveryTitle_unavailable: {
    en: "Record check unavailable",
    zh: "暂时无法核对记录",
  },
} as const;

export const messages = mergeMessages(appMessages);
