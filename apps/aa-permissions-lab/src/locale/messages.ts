import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  appName: { en: "AA Permissions Lab", zh: "AA 权限实验室" },
  accountId: { en: "AccountId Hash", zh: "AccountId Hash" },
  verifier: { en: "Verifier Hash", zh: "Verifier Hash" },
  verifierParams: { en: "Verifier Params Hex", zh: "Verifier 参数 Hex" },
  hook: { en: "Hook Hash", zh: "Hook Hash" },
  updateVerifier: { en: "Update Verifier", zh: "更新 Verifier" },
  updateHook: { en: "Update Hook", zh: "更新 Hook" },
  inspect: { en: "Refresh State", zh: "刷新状态" },
  currentVerifier: { en: "Current Verifier", zh: "当前 Verifier" },
  currentHook: { en: "Current Hook", zh: "当前 Hook" },
  currentBackupOwner: { en: "Current Backup Owner", zh: "当前 Backup Owner" },
  successVerifier: { en: "Verifier update submitted", zh: "Verifier 更新已提交" },
  successHook: { en: "Hook update submitted", zh: "Hook 更新已提交" },
  docsSubtitle: { en: "Update AA verifier and hook bindings", zh: "更新 AA verifier 与 hook 绑定" },
  feature1Name: { en: "Verifier", zh: "Verifier" },
  feature1Desc: { en: "Rotate account verification logic.", zh: "切换账户验证逻辑。" },
  feature2Name: { en: "Hook", zh: "Hook" },
  feature2Desc: { en: "Change hook policy bindings.", zh: "切换 hook 策略绑定。" },
  feature3Name: { en: "Direct Wallet", zh: "钱包直连" },
  feature3Desc: { en: "Writes go straight to the shared AA core.", zh: "写操作直接发往共享 AA Core。" }
} as const;

export const messages = mergeMessages(appMessages);
