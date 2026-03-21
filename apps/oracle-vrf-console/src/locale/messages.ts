import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "Oracle VRF Console", zh: "预言机随机数台" },
  requestRandom: { en: "Request Randomness", zh: "请求随机数" },
  latestResult: { en: "Latest Result", zh: "最近结果" },
  labelRequest: { en: "Request", zh: "请求" },
  labelValue: { en: "Value", zh: "值" },
  labelProof: { en: "Proof", zh: "证明" },
  heroVrf: { en: "VRF", zh: "VRF" },
  heroDirect: { en: "direct", zh: "direct" },
  docsSubtitle: { en: "Trigger Morpheus randomness from a dedicated miniapp", zh: "用独立小程序触发 Morpheus 随机数" },
  feature1Name: { en: "VRF", zh: "VRF" },
  feature1Desc: { en: "Direct randomness request flow.", zh: "直接随机数请求路径。" },
  feature2Name: { en: "Proof", zh: "证明" },
  feature2Desc: { en: "Shows request id and proof payload.", zh: "展示请求编号和证明载荷。" },
  feature3Name: { en: "Operator View", zh: "运维视图" },
  feature3Desc: { en: "Fast validation surface for randomness requests.", zh: "面向随机数请求的快速验证界面。" },
  notAvailable: { en: "N/A", zh: "不可用" },
  requestFailed: { en: "Request failed", zh: "请求失败" },
  randomnessRequested: { en: "Randomness requested", zh: "随机数已请求" },
} as const;
export const messages = mergeMessages(appMessages);
