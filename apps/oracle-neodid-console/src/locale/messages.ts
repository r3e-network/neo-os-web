import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "Oracle NeoDID Console", zh: "预言机 NeoDID 控制台" },
  docsSubtitle: { en: "Resolve NeoDID documents and inspect providers", zh: "解析 NeoDID 文档并查看 providers" },
  feature1Name: { en: "Resolver", zh: "解析器" },
  feature1Desc: { en: "Resolve DID documents or full DID resolution payloads from Morpheus.", zh: "从 Morpheus 解析 DID 文档或完整 DID resolution 结果。" },
  feature2Name: { en: "Providers", zh: "Providers" },
  feature2Desc: { en: "Inspect the public NeoDID provider catalog exposed by the Oracle stack.", zh: "查看 Oracle 栈暴露的公开 NeoDID provider 列表。" },
  feature3Name: { en: "Deployment View", zh: "部署视图" },
  feature3Desc: { en: "Shows the canonical public API and current network metadata.", zh: "显示标准公共 API 与当前网络元数据。" },
  did: { en: "DID", zh: "DID" },
  format: { en: "Format", zh: "格式" },
  resolveDid: { en: "Resolve DID", zh: "解析 DID" },
  loadProviders: { en: "Load Providers", zh: "加载 Providers" },
  latestDocument: { en: "Latest Result", zh: "最新结果" },
  providersLabel: { en: "Providers", zh: "Providers" },
  publicApi: { en: "Public API", zh: "公共 API" },
  neodidContract: { en: "NeoDID Contract", zh: "NeoDID 合约" },
  neodidDomain: { en: "NeoDID Domain", zh: "NeoDID 域名" },
  resolution: { en: "Resolution", zh: "Resolution" },
  document: { en: "Document", zh: "Document" },
  examples: { en: "Examples", zh: "示例" },
  serviceDid: { en: "Service DID", zh: "服务 DID" },
  vaultDid: { en: "Vault DID", zh: "Vault DID" },
  aaDid: { en: "AA DID", zh: "AA DID" },
  resultLoaded: { en: "NeoDID response loaded", zh: "NeoDID 响应已加载" },
} as const;

export const messages = mergeMessages(appMessages);
