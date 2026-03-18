import { mergeMessages } from "@shared/locale/base-messages";
const appMessages = {
  appName: { en: "AA Relay Console", zh: "AA Relay 控制台" },
  aaAddress: { en: "AA Address", zh: "AA 地址" },
  dappId: { en: "Paymaster Dapp ID", zh: "Paymaster Dapp ID" },
  payloadJson: { en: "Relay Payload JSON", zh: "Relay Payload JSON" },
  submitRelay: { en: "Submit Relay Payload", zh: "提交 Relay Payload" },
  sponsorCheck: { en: "Check Sponsorship", zh: "检查赞助资格" },
  sponsorRequest: { en: "Request Sponsorship", zh: "请求赞助" },
  latestRelay: { en: "Latest Relay Response", zh: "最近 Relay 响应" },
  docsSubtitle: { en: "Inspect AA relay and paymaster behavior", zh: "检查 AA relay 与 paymaster 行为" },
  feature1Name: { en: "Relay", zh: "Relay" },
  feature1Desc: { en: "Submit relay-ready payloads against the shared AA relay.", zh: "对共享 AA relay 提交 relay-ready payload。" },
  feature2Name: { en: "Paymaster", zh: "Paymaster" },
  feature2Desc: { en: "Check and request sponsorship state.", zh: "检查并请求赞助状态。" },
  feature3Name: { en: "Operator Lab", zh: "运维实验室" },
  feature3Desc: { en: "Focused debugging surface for AA submission flow.", zh: "面向 AA 提交流程的专用调试界面。" }
} as const;
export const messages = mergeMessages(appMessages);
