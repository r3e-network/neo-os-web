import { mergeMessages } from "@shared/locale/base-messages";
import { factoryMessages } from "@shared/factory/messages";

const appMessages = {
  ...factoryMessages,
  title: { en: "MiniApp Factory", zh: "小程序工厂" },
  subtitle: {
    en: "Create focused platform miniapps from governed templates, with NEP-21 launch links, catalog metadata, and optional oracle capability.",
    zh: "基于受治理模板创建专注型平台小程序，内置 NEP-21 启动链接、目录元数据和可选预言机能力。",
  },
  factoryOverview: { en: "MiniApp factory", zh: "小程序工厂" },
  activeTemplate: { en: "MiniApp template", zh: "小程序模板" },
  docWhatItIsBody: {
    en: "MiniApp Factory is a focused OneGate-loadable dApp for creating platform-backed miniapps from predefined templates such as reward vaults, ticket passes, certificates, and oracle consoles.",
    zh: "小程序工厂是可被 OneGate 加载的专注型 dApp，用于从奖励金库、门票通行证、证书、预言机控制台等预定义模板创建平台托管小程序。",
  },
  docSupportedTemplatesBody: {
    en: "Supported templates include reward vault, ticket pass, certificate, and oracle console. Each template generates only initialization parameters and a catalog patch.",
    zh: "支持奖励金库、门票通行证、证书和预言机控制台模板。每个模板只生成初始化参数和目录补丁。",
  },
} as const;

export const messages = mergeMessages(appMessages);
