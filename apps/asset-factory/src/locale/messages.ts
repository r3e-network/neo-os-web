import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "Asset Factory", zh: "资产工厂" },
  // Honest headline: the deployable artifact is preloaded per-network by a
  // factory admin, so on a network where it is not registered this console can
  // only sign/export a plan — never silently promise "create a token".
  subtitle: {
    en: "Configure a NEP-17 token from an audited on-chain template — supply, owner, treasury, and minting policy. Deploy works only on networks where a factory admin has preloaded the artifact; elsewhere you sign and export a plan.",
    zh: "基于已审计链上模板配置 NEP-17 资产（供应量、Owner、金库、增发策略）。仅在 Factory 管理员已预置工件的网络上可部署；其他网络只能签名并导出计划。",
  },
  factoryOverview: { en: "Asset factory", zh: "资产工厂" },
  activeTemplate: { en: "Asset template", zh: "资产模板" },
  // Sign purpose in product terms: a portable issuer commitment, useful even
  // when in-app deploy is blocked because the artifact is not yet preloaded.
  signPlanDescription: {
    en: "Signs the deterministic plan digest with your wallet as a portable issuer commitment to these exact parameters. Hand it to a factory admin or keep it as an off-chain audit trail when in-app deploy is not yet available on this network.",
    zh: "用钱包对确定性的计划摘要签名，作为对这些参数的可携带发行方承诺。当本网络尚不能在应用内部署时，可交给 Factory 管理员或作为链下审计凭证保留。",
  },
  // Surface the only cost (the Neo network fee) and the per-network artifact
  // reality on the path the user always hits, even when deploy is blocked.
  deployHonesty: {
    en: "Deploying from a template costs only the Neo network fee — there is no app fee. This console never uploads external NEF or manifest files: it submits a preloaded template ID and your parameters to the Factory contract. The deployable artifact is preloaded per network by a factory admin, so on a network where it is not registered, execution stays blocked and you can only sign/export the plan.",
    zh: "基于模板部署只需支付 Neo 网络费用，没有任何应用费用。本控制台从不上传链外 NEF 或 manifest 文件：它只向 Factory 合约提交预置模板 ID 和你的参数。可部署工件由 Factory 管理员按网络预置，因此在尚未注册的网络上执行会保持阻断，你只能签名/导出计划。",
  },
  docWhatItIsBody: {
    en: "Asset Factory is a focused OneGate-loadable dApp for launching NEP-17 assets through the platform Factory contract. You supply only initialization parameters; you pay only the Neo network fee, with no app fee. Deployment requires the template artifact to be preloaded on the Factory contract for the selected network — otherwise the console produces a signed, exportable plan instead.",
    zh: "资产工厂是可被 OneGate 加载的专注型 dApp，用于通过平台 Factory 合约发行 NEP-17 资产。你只提交初始化参数；只需支付 Neo 网络费用，没有应用费用。部署要求所选网络的 Factory 合约已预置模板工件——否则控制台会生成可签名、可导出的计划。",
  },
  docSupportedTemplatesBody: {
    en: "The initial template is a governed NEP-17 asset template with fixed decimals, treasury, mintability, and standard transfer policy parameters.",
    zh: "当前模板是受治理的 NEP-17 资产模板，支持精度、金库、是否可增发和标准转账策略参数。",
  },
} as const;

export const messages = mergeMessages(appMessages);
