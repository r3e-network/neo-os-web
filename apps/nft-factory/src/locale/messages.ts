import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "NFT Factory", zh: "NFT 工厂" },
  // Honest headline: the deployable collection artifact is preloaded per-network
  // by a factory admin, so on a network where it is not registered this console
  // can only sign/export a plan.
  subtitle: {
    en: "Configure a NEP-11 collection, pass, or soulbound drop from a governed on-chain template. Deploy works only on networks where a factory admin has preloaded the artifact; elsewhere you sign and export a plan.",
    zh: "基于受治理链上模板配置 NEP-11 集合、通行证或灵魂绑定发行。仅在 Factory 管理员已预置工件的网络上可部署；其他网络只能签名并导出计划。",
  },
  subtitleShort: {
    en: "Design a NEP-11 drop package; deploy after template availability is verified.",
    zh: "先设计 NEP-11 发行包；验证模板可用后再部署。",
  },
  factoryOverview: { en: "NFT factory", zh: "NFT 工厂" },
  activeTemplate: { en: "Collection template", zh: "集合模板" },
  // Royalty consequence: a marketplace-honored, owner-routed cut on secondary
  // sales, fixed at deploy. Keep the {bps}/{percent} placeholders intact.
  royaltyHelper: {
    en: "{bps} bps = {percent}% of each secondary sale, routed to the collection owner by marketplaces. Fixed at deploy — it cannot be changed later.",
    zh: "{bps} bps = 每笔二次销售的 {percent}%，由市场分给集合 Owner。部署时固定，之后不可更改。",
  },
  // Soulbound toggle consequence at the control: off = permanently bound.
  transferable: {
    en: "Transferable NFT (off = soulbound, non-transferable forever)",
    zh: "NFT 可转让（关闭 = 灵魂绑定，永久不可转让）",
  },
  signPlanDescription: {
    en: "Signs the deterministic plan digest with your wallet as a portable creator commitment to these exact parameters. Hand it to a factory admin or keep it as an off-chain audit trail when in-app deploy is not yet available on this network.",
    zh: "用钱包对确定性的计划摘要签名，作为对这些参数的可携带创作者承诺。当本网络尚不能在应用内部署时，可交给 Factory 管理员或作为链下审计凭证保留。",
  },
  deployHonesty: {
    en: "Deploying from a template costs only the Neo network fee — there is no app fee (the royalty is a creator setting baked into the collection, not a platform charge). This console never uploads external NEF or manifest files: it submits a preloaded template ID and your parameters to the Factory contract. The deployable artifact is preloaded per network by a factory admin, so on a network where it is not registered, execution stays blocked and you can only sign/export the plan.",
    zh: "基于模板部署只需支付 Neo 网络费用，没有应用费用（版税是写入集合的创作者设置，不是平台收费）。本控制台从不上传链外 NEF 或 manifest 文件：它只向 Factory 合约提交预置模板 ID 和你的参数。可部署工件由 Factory 管理员按网络预置，因此在尚未注册的网络上执行会保持阻断，你只能签名/导出计划。",
  },
  docWhatItIsBody: {
    en: "NFT Factory is a focused OneGate-loadable dApp for launching NEP-11 collections through the platform Factory contract — collections, tickets, badges, and creator drops. You pay only the Neo network fee, with no app fee. Deployment requires the template artifact to be preloaded on the Factory contract for the selected network — otherwise the console produces a signed, exportable plan instead.",
    zh: "NFT 工厂是可被 OneGate 加载的专注型 dApp，用于通过平台 Factory 合约发行 NEP-11 集合——适合集合、门票、徽章和创作者发行。只需支付 Neo 网络费用，没有应用费用。部署要求所选网络的 Factory 合约已预置模板工件——否则控制台会生成可签名、可导出的计划。",
  },
  docSupportedTemplatesBody: {
    en: "The initial template is a governed NEP-11 collection template with max supply, royalty (a marketplace-honored cut to the owner on secondary sales, fixed at deploy), metadata base URI, and a transferable/soulbound transfer policy.",
    zh: "当前模板是受治理的 NEP-11 集合模板，支持最大供应量、版税（市场在二次销售时分给 Owner 的份额，部署时固定）、元数据基础 URI，以及可转让/灵魂绑定的转让策略。",
  },
} as const;

export const messages = mergeMessages(appMessages);
