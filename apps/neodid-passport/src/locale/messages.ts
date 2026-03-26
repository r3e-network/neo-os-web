import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "NeoDID Passport", zh: "NeoDID 护照" },
  subtitle: { en: "Identity passport for NeoDID, zklogin, and AA", zh: "面向 NeoDID、zklogin 与 AA 的身份护照" },
  heroKicker: { en: "Identity First", zh: "身份优先" },
  heroBlurb: {
    en: "Bridge a Web2 login into a reusable NeoDID identity root, package verifier-ready payloads, and keep one identity surface across Morpheus and AA.",
    zh: "把 Web2 登录桥接成可复用的 NeoDID 身份根，并将 verifier 所需载荷统一组织到 Morpheus 与 AA 共用的身份表面。",
  },
  tabPassport: { en: "Passport", zh: "护照" },
  tabFlows: { en: "Flows", zh: "流程" },
  docsSubtitle: { en: "Identity passport launcher", zh: "身份护照入口" },
  identityRoot: { en: "Identity Root", zh: "身份根" },
  identityRootValue: { en: "NeoDID + Web2 login", zh: "NeoDID + Web2 登录" },
  verifierReady: { en: "Verifier Ready", zh: "可验证" },
  verifierReadyValue: { en: "AA / zklogin payloads", zh: "AA / zklogin 载荷" },
  reusableAcross: { en: "Reusable Across", zh: "复用范围" },
  reusableAcrossValue: { en: "Miniapps + Oracle + AA", zh: "小程序 + 预言机 + AA" },
  passportMode: { en: "Passport Mode", zh: "护照模式" },
  passportModeValue: { en: "Product launcher", zh: "产品入口壳" },
  bindPassport: { en: "Bind Passport", zh: "绑定护照" },
  openIdentityWorkspace: { en: "Open Identity Workspace", zh: "打开身份工作区" },
  openNeoDidStudio: { en: "Open NeoDID Studio", zh: "打开 NeoDID Studio" },
  openVerifier: { en: "Open Verifier", zh: "打开验证器" },
  openDocs: { en: "Open Docs", zh: "打开文档" },
  passportLayers: { en: "Passport Layers", zh: "护照层" },
  passportLayersText: {
    en: "Use NeoDID for the stable identity root, Morpheus for private attested ticket generation, and AA verifiers for execution-time authorization.",
    zh: "用 NeoDID 作为稳定身份根，用 Morpheus 生成机密可验证票据，再通过 AA verifier 在执行时授权。",
  },
  passportRouting: { en: "Routing", zh: "路由" },
  passportRoutingText: {
    en: "Identity binding lives in Morpheus, account-bound actions live in AA, and the miniapp acts as the product shell that keeps the user journey coherent.",
    zh: "身份绑定在 Morpheus，账户绑定动作在 AA，小程序负责把用户路径组织成一致的产品体验。",
  },
  routeAA: { en: "AA identity route", zh: "AA 身份路由" },
  routeOracle: { en: "Morpheus NeoDID route", zh: "Morpheus NeoDID 路由" },
  routeVerifier: { en: "Verifier route", zh: "验证器路由" },
  feature1Name: { en: "Unified Identity Root", zh: "统一身份根" },
  feature1Desc: { en: "One stable identity root across miniapps, oracle flows, and AA verifiers.", zh: "在小程序、预言机流程和 AA verifier 之间共享同一个身份根。" },
  feature2Name: { en: "Verifier Payloads", zh: "可验证载荷" },
  feature2Desc: { en: "Prepare zklogin and verifier-facing payloads without rebuilding the core auth stack in each app.", zh: "无需在每个小程序里重建认证栈，就能准备 zklogin 与 verifier 所需载荷。" },
  feature3Name: { en: "Product Shell", zh: "产品壳层" },
  feature3Desc: { en: "Use the miniapp as the identity-facing product layer while core confidential logic remains in Morpheus and AA.", zh: "小程序负责身份产品层，核心机密逻辑仍留在 Morpheus 与 AA 内部。" },
} as const;

export const messages = mergeMessages(appMessages);
