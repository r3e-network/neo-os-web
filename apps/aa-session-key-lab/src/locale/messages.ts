import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "AA Session Key Lab", zh: "AA Session Key 实验室" },
  aaAddress: { en: "AA Address", zh: "AA 地址" },
  contractHash: { en: "Scope Contract", zh: "作用域合约" },
  methods: { en: "Allowed Methods", zh: "允许方法" },
  maxInvocations: { en: "Max Invocations", zh: "最大调用次数" },
  checkSponsor: { en: "Check Sponsorship", zh: "检查赞助资格" },
  requestSponsor: { en: "Request Sponsorship", zh: "请求赞助" },
  latestState: { en: "Latest State", zh: "最近状态" },
  createSession: { en: "Create Session Key", zh: "创建 Session Key" },
  docsSubtitle: { en: "Inspect AA session and sponsorship state", zh: "检查 AA session 与赞助状态" },
  feature1Name: { en: "Session Scope", zh: "Session 作用域" },
  feature1Desc: { en: "Prepare session-key scope input for AA flows.", zh: "为 AA 流程准备 session-key 作用域输入。" },
  feature2Name: { en: "Sponsor State", zh: "赞助状态" },
  feature2Desc: { en: "Check and request gas sponsorship.", zh: "检查并请求 gas 赞助。" },
  feature3Name: { en: "Relay Ready", zh: "Relay 就绪" },
  feature3Desc: { en: "Shows relay/session state in one place.", zh: "在一个页面里查看 relay / session 状态。" }
} as const;

export const messages = mergeMessages(appMessages);
