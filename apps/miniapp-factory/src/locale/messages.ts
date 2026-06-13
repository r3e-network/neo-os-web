import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  // Make the oracle toggle's consequence explicit at the control itself: the
  // shared form renders the toggle's label inline, so the label carries the
  // "what enabling this does" hint (adds a price/data feed to the generated
  // app) rather than leaving it the quietest, unexplained control in the form.
  needsOracle: {
    en: "Needs oracle — adds a price/data feed",
    zh: "需要预言机 — 增加价格/数据源",
  },
  title: { en: "MiniApp Factory", zh: "小程序工厂" },
  // Honest framing: the on-chain outcome here is a registry RECORD + catalog
  // patch, not a deployed contract. The instance only goes live once an
  // operator wires it and syncs the catalog patch.
  subtitle: {
    en: "Register a platform miniapp instance from a governed template — this writes an on-chain registry record and a catalog patch, not a token contract. An operator then wires the instance and syncs the patch to make it launchable.",
    zh: "基于受治理模板登记平台小程序实例——这会写入链上注册记录和目录补丁，而非部署代币合约。之后由运营者接入实例并同步补丁，使其可启动。",
  },
  factoryOverview: { en: "MiniApp factory", zh: "小程序工厂" },
  activeTemplate: { en: "MiniApp template", zh: "小程序模板" },
  // Reframe the shell copy that was written for artifact deployment: here you
  // produce a registry record + catalog patch.
  publishPackage: { en: "MiniApp instance record", zh: "小程序实例记录" },
  deployChecklist: { en: "Registration checklist", zh: "登记清单" },
  deployHonesty: {
    en: "This creates an on-chain registry record (a catalog/registry entry), not a running contract. It submits a governed template ID plus your parameters to the Factory contract and emits a catalog patch. You pay only the Neo network fee, with no app fee. After registering, the instance is not launchable until an operator syncs the catalog patch and wires the underlying app.",
    zh: "这会创建链上注册记录（目录/注册表条目），而非运行中的合约。它向 Factory 合约提交受治理的模板 ID 和你的参数，并生成目录补丁。只需支付 Neo 网络费用，没有应用费用。登记后，在运营者同步目录补丁并接入底层应用之前，该实例尚不可启动。",
  },
  signPlanDescription: {
    en: "Signs the deterministic plan digest with your wallet as a portable developer commitment to these exact parameters — useful for handing the registration to an operator or keeping an off-chain audit trail.",
    zh: "用钱包对确定性的计划摘要签名，作为对这些参数的可携带开发者承诺——便于将登记交给运营者或保留链下审计凭证。",
  },
  // Strengthen the always-shown catalog warning into the explicit next step.
  warnCatalogRegistration: {
    en: "Next step after registering: sync the generated catalog patch to the platform registry (Notion/catalog) so the miniapp becomes launchable. The patch is in the plan payload — copy it from \"View plan payload\".",
    zh: "登记后的下一步：将生成的目录补丁同步到平台注册表（Notion/目录），使该小程序可启动。补丁位于计划载荷中——可从「查看计划载荷」复制。",
  },
  // The "bind" checklist step is what follows the on-chain register: make it
  // the explicit catalog-sync + go-live next step (not artifact binding).
  stepBindTitle: { en: "Sync catalog patch to make it launchable", zh: "同步目录补丁使其可启动" },
  stepBindDetail: {
    en: "After the on-chain record is created, sync the generated catalog patch to the platform registry and wire the underlying app — the instance is not launchable until this is done.",
    zh: "链上记录创建后，将生成的目录补丁同步到平台注册表并接入底层应用——在此之前实例尚不可启动。",
  },
  docWhatItIsBody: {
    en: "MiniApp Factory is a focused OneGate-loadable dApp for registering platform-backed miniapp instances from predefined templates such as reward vaults, ticket passes, certificates, and oracle consoles. The on-chain outcome is a registry record plus a catalog patch — not a deployed token contract — which an operator then syncs and wires to make the app live. You pay only the Neo network fee.",
    zh: "小程序工厂是可被 OneGate 加载的专注型 dApp，用于从奖励金库、门票通行证、证书、预言机控制台等预定义模板登记平台托管的小程序实例。链上产物是注册记录加目录补丁——而非已部署的代币合约——之后由运营者同步并接入，使应用上线。只需支付 Neo 网络费用。",
  },
  docSupportedTemplatesBody: {
    en: "Supported templates include reward vault, ticket pass, certificate, and oracle console. Each template generates only initialization parameters and a catalog patch — no contract artifact is uploaded or deployed.",
    zh: "支持奖励金库、门票通行证、证书和预言机控制台模板。每个模板只生成初始化参数和目录补丁——不上传或部署任何合约工件。",
  },
} as const;

export const messages = mergeMessages(appMessages);
