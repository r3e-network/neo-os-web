import { mergeMessages } from "@shared/locale/base-messages";

const appMessages = {
  title: { en: "Recovery Guardian", zh: "恢复守护者" },
  subtitle: { en: "AA recovery launcher with guardian and NeoDID flows", zh: "结合 guardian 与 NeoDID 的 AA 恢复入口" },
  heroKicker: { en: "Safety First", zh: "安全优先" },
  heroBlurb: {
    en: "Open the real recovery workspace, issue recovery tickets, review timelocks, and keep guardian policy visible before ownership changes happen.",
    zh: "打开真实恢复工作区、签发恢复票据、审核 timelock，并在所有权切换前把 guardian 策略保持可见。",
  },
  tabRecovery: { en: "Recovery", zh: "恢复" },
  tabGuardians: { en: "Guardians", zh: "守护者" },
  docsSubtitle: { en: "Recovery launcher and checklist", zh: "恢复入口与检查清单" },
  guardianPolicy: { en: "Guardian Policy", zh: "守护策略" },
  guardianPolicyValue: { en: "Verifier + backup owner", zh: "Verifier + 备用所有者" },
  recoveryEvidence: { en: "Recovery Evidence", zh: "恢复证据" },
  recoveryEvidenceValue: { en: "NeoDID recovery ticket", zh: "NeoDID 恢复票据" },
  timelockLabel: { en: "Timelock", zh: "Timelock" },
  timelockValue: { en: "Visible review window", zh: "可审查等待窗口" },
  guardianMode: { en: "Guardian Mode", zh: "守护模式" },
  guardianModeValue: { en: "Operator launcher", zh: "运维入口壳" },
  openGuardianSetup: { en: "Open Guardian Setup", zh: "打开守护设置" },
  openRecoveryWorkspace: { en: "Open Recovery Workspace", zh: "打开恢复工作区" },
  openRecoveryDocs: { en: "Open Recovery Docs", zh: "打开恢复文档" },
  openNeoDidDocs: { en: "Open NeoDID Docs", zh: "打开 NeoDID 文档" },
  guardianPolicyTitle: { en: "Guardian Policy", zh: "守护策略" },
  guardianPolicyText: {
    en: "Keep backup owner, verifier contract, and recovery-specific hook assumptions explicit. The miniapp should never hide recovery policy from the operator.",
    zh: "把 backup owner、verifier 合约和恢复专用 hook 假设明确展示出来，小程序不应把恢复策略藏起来。",
  },
  ticketFlowTitle: { en: "Ticket Flow", zh: "票据流程" },
  ticketFlowText: {
    en: "Identity proof happens through Morpheus NeoDID tickets. Final state change still happens through the AA verifier path after the configured delay.",
    zh: "身份证明通过 Morpheus NeoDID 票据产生，真正状态切换仍在配置好的延迟之后通过 AA verifier 路径完成。",
  },
  guardianRoute: { en: "Guardian route", zh: "守护路由" },
  recoveryRoute: { en: "Recovery route", zh: "恢复路由" },
  ticketRoute: { en: "Ticket route", zh: "票据路由" },
  feature1Name: { en: "Explicit Policy", zh: "显式策略" },
  feature1Desc: { en: "Recovery is only safe when verifier, guardian, and backup-owner rules stay explicit.", zh: "只有把 verifier、guardian 和 backup-owner 规则保持显式，恢复才安全。" },
  feature2Name: { en: "Private Evidence", zh: "机密证据" },
  feature2Desc: { en: "Use NeoDID recovery tickets as evidence without pushing raw Web2 identity material on-chain.", zh: "通过 NeoDID 恢复票据提供证据，而不是把原始 Web2 身份材料推到链上。" },
  feature3Name: { en: "Delayed Finality", zh: "延迟终局" },
  feature3Desc: { en: "Keep a visible review window before recovery finalize executes.", zh: "在 recovery finalize 执行前保留可见的审核窗口。" },
} as const;

export const messages = mergeMessages(appMessages);
