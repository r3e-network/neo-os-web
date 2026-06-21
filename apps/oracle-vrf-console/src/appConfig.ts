import { mergeMessages } from "@shared/locale/base-messages";
import type { ConsoleToolConfig } from "@shared/components-react";
import { previewId } from "@shared/components-react";
import { getNetwork } from "@shared/constants/rpc";
import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const appId = "miniapp-oracle-vrf-console";
const DEFAULT_CONSUMER = appId;
const DEFAULT_SALT = "vrf:miniapp-round";
// Upper bound for the repeat count; surfaced to the user as the "1-10" field
// hint and enforced in buildResult so an out-of-range entry is honestly clamped.
const MAX_ROUNDS = 10;

/**
 * Resolve the network label from the launched network instead of a hardcoded
 * "Morpheus Testnet". vrf/random is live on the mainnet nitro worker while the
 * testnet runtime is still degraded (getNetwork() defaults to mainnet).
 */
export function resolveNetworkLabel(): string {
  return getNetwork() === "testnet" ? "Morpheus Testnet" : "Morpheus Mainnet";
}

export const appMeta = {
  networkLabel: resolveNetworkLabel(),
  // The console only builds a request payload locally; it never dispatches a
  // draw. Mark the endpoint stat as a preview builder so the live network label
  // doesn't read as "a randomness draw was requested on mainnet".
  endpointLabel: "Request builder (preview)",
};

export const manifest: MiniAppManifest = {
  name: "Oracle VRF Console",
  description: "Prepare Morpheus verifiable randomness requests.",
  icon: "dice",
  category: "oracle",
  shell: "console",
  theme: { family: "default", accentColor: "#16c784", density: "comfortable" },
  tabs: [{ key: "vrf", labelKey: "tabVrf", icon: "dice", default: true }],
  stats: [
    {
      labelKey: "statNetwork",
      valueKey: "networkLabel",
      format: "text",
      icon: "globe",
    },
    {
      labelKey: "statEndpoint",
      valueKey: "endpointLabel",
      format: "text",
      icon: "dice",
    },
    {
      labelKey: "statDigest",
      valueKey: "lastDigest",
      format: "text",
      icon: "key",
    },
  ],
  sidebar: {
    titleKey: "appName",
    items: [
      { labelKey: "statNetwork", valueKey: "networkLabel", format: "text" },
      { labelKey: "lastStatus", valueKey: "lastStatus", format: "text" },
      { labelKey: "statDigest", valueKey: "lastDigest", format: "text" },
    ],
  },
  features: { walletRequired: false, chainWarning: true },
  docs: [
    { titleKey: "appName", contentKey: "docsSubtitle", type: "text" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
    { titleKey: "feature2Name", contentKey: "feature2Desc", type: "features" },
    { titleKey: "feature3Name", contentKey: "feature3Desc", type: "features" },
  ],
  permissions: { randomness: true },
};

const clean = (value: string | undefined, fallback: string) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
};

export const consoleConfig: ConsoleToolConfig = {
  titleKey: "panelTitle",
  eyebrowKey: "panelEyebrow",
  descriptionKey: "panelDescription",
  primaryActionKey: "runAction",
  resetActionKey: "reset",
  copyActionKey: "copy",
  copiedKey: "copied",
  // The session "Requests" tally carries no business meaning here (it counts
  // local previews, not on-chain draws). The app's manifest already omits
  // statRequests; hiding it in the shared hero is the supported replacement for
  // the old (now dead) CSS nth-child hide rule.
  hideRequestCount: true,
  fields: [
    {
      key: "consumer",
      labelKey: "consumer",
      placeholderKey: "consumerPlaceholder",
      type: "text",
      defaultValue: DEFAULT_CONSUMER,
    },
    {
      key: "salt",
      labelKey: "salt",
      placeholderKey: "saltPlaceholder",
      type: "text",
      defaultValue: DEFAULT_SALT,
    },
    {
      // Field label carries the supported "1-10" range as an always-visible hint
      // (the placeholder is hidden because the field defaults to "1"). The plain
      // `rounds` key is kept for the result-row label so it reads "Rounds: 3".
      key: "rounds",
      labelKey: "roundsLabel",
      placeholderKey: "roundsPlaceholder",
      type: "number",
      defaultValue: "1",
    },
    {
      key: "mode",
      labelKey: "mode",
      type: "select",
      defaultValue: "single-proof",
      options: [
        { value: "single-proof", labelKey: "modeSingle" },
        { value: "batch-proof", labelKey: "modeBatch" },
      ],
    },
  ],
  buildResult(values, t) {
    const consumer = clean(values.consumer, "");
    const salt = clean(values.salt, "");
    const mode = clean(values.mode, "single-proof");
    if (!consumer || !salt) {
      return {
        status: t("inputRequired"),
        summary: t("inputRequiredSummary"),
        rows: [],
        payload: {
          kind: "oracle.vrf.request",
          status: "input_required",
          required: ["consumer", "salt"],
        },
      };
    }
    // Clamp rounds to the supported 1-10 window so an invalid entry (0, -5, 2.5,
    // 50, blank, or a non-numeric string) never produces a semantically broken
    // request payload that downstream consumers would carry unchecked.
    const rawRounds = clean(values.rounds, "1");
    const parsedRounds = Number(rawRounds);
    const rounds = String(
      Number.isFinite(parsedRounds)
        ? Math.min(MAX_ROUNDS, Math.max(1, Math.floor(parsedRounds)))
        : 1,
    );
    // Tell the user when their entry was silently adjusted, so a "0 rounds"
    // request reads honestly as "adjusted to 1" rather than appearing honored.
    const roundsAdjusted = rawRounds !== rounds;
    const requestId = previewId(`${consumer}|${salt}|${rounds}|${mode}`);

    return {
      status: t("vrfReady"),
      summary: t("vrfSummary", { rounds }),
      rows: [
        { label: t("consumer"), value: consumer },
        { label: t("salt"), value: salt },
        { label: t("rounds"), value: rounds },
        ...(roundsAdjusted
          ? [
              {
                label: t("roundsAdjusted"),
                value: t("roundsAdjustedValue", { raw: rawRounds, rounds }),
              },
            ]
          : []),
        { label: t("clientDigest"), value: requestId },
      ],
      payload: {
        kind: "oracle.vrf.request",
        consumer,
        salt,
        rounds,
        roundsAdjusted,
        mode,
        // `digest` is what the shared ConsoleToolPanel.runPreview() reads to
        // populate the bound `lastDigest` observable (hero "Request ID" stat +
        // sidebar). `client_digest` is kept for payload backward-compatibility.
        digest: requestId,
        client_digest: requestId,
      },
    };
  },
};

const appMessages = {
  appName: { en: "Oracle VRF Console", zh: "预言机随机数控制台" },
  title: { en: "Oracle VRF", zh: "预言机 VRF" },
  tabVrf: { en: "VRF", zh: "VRF" },
  panelEyebrow: { en: "Verifiable randomness", zh: "可验证随机数" },
  panelTitle: { en: "VRF Request Builder", zh: "VRF 请求构建器" },
  panelDescription: {
    en: "Prepare randomness requests with consumer, salt, proof mode, and repeat count. This request id is what you submit to the Morpheus VRF lane (or your consumer contract); the returned proof matches back to this id — the draw and verification happen there, not in this preview.",
    zh: "用消费者、盐值、证明模式和轮次准备随机数请求。此请求 ID 即你提交给 Morpheus VRF 通道（或你的消费者合约）的标识；返回的证明会与该 ID 对应——抽取与验证发生在那里，而非本预览中。",
  },
  vrfHeroAlt: {
    en: "A bright randomness machine preparing verifiable proof capsules.",
    zh: "明亮的随机性机器正在准备可验证证明胶囊。",
  },
  vrfHeroCopy: {
    en: "Compose a consumer seed, choose proof mode, and produce a request id that your game, raffle, or app flow can verify later.",
    zh: "组合消费者种子、选择证明模式，并生成可供游戏、抽奖或应用流程后续验证的请求 ID。",
  },
  vrfStatusLabel: { en: "VRF request status", zh: "VRF 请求状态" },
  runAction: { en: "Build VRF Request", zh: "生成 VRF 请求" },
  consumer: { en: "Consumer", zh: "消费者" },
  consumerPlaceholder: {
    en: "MiniApp contract hash or app id",
    zh: "小程序合约哈希或 app id",
  },
  salt: { en: "Salt", zh: "盐值" },
  saltPlaceholder: {
    en: "Unique round or request salt",
    zh: "唯一回合或请求盐值",
  },
  rounds: { en: "Rounds", zh: "轮次" },
  roundsLabel: { en: "Rounds (1-10)", zh: "轮次（1-10）" },
  roundsPlaceholder: { en: "1-10", zh: "1-10" },
  roundsAdjusted: { en: "Rounds adjusted", zh: "轮次已调整" },
  roundsAdjustedValue: {
    en: "{raw} -> {rounds} (1-10, whole number)",
    zh: "{raw} -> {rounds}（1-10，整数）",
  },
  mode: { en: "Proof Mode", zh: "证明模式" },
  modeSingle: { en: "Single proof", zh: "单次证明" },
  modeBatch: { en: "Batch proof", zh: "批量证明" },
  modeSingleHint: {
    en: "Best for one round, one winner, or one callback.",
    zh: "适合单回合、单赢家或单次回调。",
  },
  modeBatchHint: {
    en: "Package repeat draws with the same consumer seed.",
    zh: "用同一消费者种子打包多轮抽取。",
  },
  requestId: { en: "Request ID", zh: "请求 ID" },
  clientDigest: { en: "Client Digest", zh: "客户端摘要" },
  inputRequired: { en: "Required fields missing", zh: "缺少必填字段" },
  inputRequiredSummary: {
    en: "Enter a consumer and salt before building a VRF request.",
    zh: "请输入消费者和盐值后再生成 VRF 请求。",
  },
  vrfReady: { en: "VRF request ready", zh: "VRF 请求已准备" },
  vrfSummary: {
    en: "{rounds} randomness round(s) prepared",
    zh: "{rounds} 轮随机数已准备",
  },
  statNetwork: { en: "Network", zh: "网络" },
  statEndpoint: { en: "Endpoint", zh: "端点" },
  statRequests: { en: "Requests", zh: "请求数" },
  statDigest: { en: "Request ID", zh: "请求 ID" },
  digestPlaceholder: { en: "—", zh: "—" },
  lastStatus: { en: "Last Status", zh: "最近状态" },
  vrfFlowTitle: { en: "VRF proof flow", zh: "VRF 证明流程" },
  vrfFlowSeed: { en: "Seed", zh: "种子" },
  vrfFlowSeedDesc: {
    en: "Consumer and salt define the request identity.",
    zh: "消费者和盐值定义请求身份。",
  },
  vrfFlowDraw: { en: "Draw", zh: "抽取" },
  vrfFlowDrawDesc: {
    en: "Rounds decide how many random values are requested.",
    zh: "轮次决定请求多少个随机值。",
  },
  vrfFlowVerify: { en: "Verify", zh: "验证" },
  vrfFlowVerifyDesc: {
    en: "The returned proof matches back to the digest.",
    zh: "返回的证明会匹配回摘要。",
  },
  vrfRequestPlan: { en: "Request plan", zh: "请求方案" },
  vrfRequestPlanCopy: {
    en: "Tune the seed, rounds, and proof mode before creating the digest.",
    zh: "生成摘要前，先调整种子、轮次和证明模式。",
  },
  vrfTicketTitle: { en: "Randomness ticket", zh: "随机性票据" },
  vrfTicketCopy: {
    en: "Lock the seed, draw count, and proof style as one verifiable request.",
    zh: "把种子、抽取轮次和证明方式锁定为一个可验证请求。",
  },
  vrfTicketReady: { en: "Ticket ready", zh: "票据已准备" },
  vrfSeedIdentity: { en: "Seed identity", zh: "种子身份" },
  vrfSeedIdentityCopy: {
    en: "Use stable values so proofs can be matched after callback.",
    zh: "使用稳定值，方便回调后匹配证明。",
  },
  vrfConsumerHint: {
    en: "App id, contract hash, or consumer lane that will receive the callback.",
    zh: "接收回调的 app id、合约哈希或消费者通道。",
  },
  vrfSaltHint: {
    en: "Make it unique per round, draw, raffle, or game match.",
    zh: "每个回合、抽取、抽奖或比赛都应唯一。",
  },
  vrfRoundsTitle: { en: "Draw rounds", zh: "抽取轮次" },
  vrfRoundsHint: {
    en: "Clamp to 1-10 whole rounds for a valid preview package.",
    zh: "限制为 1-10 的整数轮次，确保预览包有效。",
  },
  vrfDecreaseRounds: { en: "Decrease rounds", zh: "减少轮次" },
  vrfIncreaseRounds: { en: "Increase rounds", zh: "增加轮次" },
  vrfProofModeTitle: { en: "Proof mode", zh: "证明模式" },
  vrfProofModeHint: {
    en: "Choose whether the request stands alone or batches repeat draws.",
    zh: "选择单次请求，或批量打包重复抽取。",
  },
  vrfProofPreview: { en: "Proof preview", zh: "证明预览" },
  vrfEmptyTitle: { en: "No digest yet", zh: "尚未生成摘要" },
  vrfEmptyCopy: {
    en: "Build the request to mint a preview digest and inspect the payload before you send it to a VRF lane.",
    zh: "生成请求后会创建预览摘要，并可在发送到 VRF 通道前检查 payload。",
  },
  docsSubtitle: {
    en: "A compact console for Morpheus randomness request planning.",
    zh: "面向 Morpheus 随机数请求规划的轻量控制台。",
  },
  docSubtitle: {
    en: "A compact console for Morpheus randomness request planning.",
    zh: "面向 Morpheus 随机数请求规划的轻量控制台。",
  },
  feature1Name: { en: "Unambiguous", zh: "无歧义" },
  feature1Desc: {
    en: "Consumer, salt, mode, and count are part of the request ID.",
    zh: "消费者、盐值、模式和轮次都会参与请求 ID。",
  },
  feature2Name: { en: "Game Ready", zh: "游戏就绪" },
  feature2Desc: {
    en: "The form is tuned for game rounds, raffles, and randomized app flows.",
    zh: "表单适合游戏回合、抽奖和随机化应用流程。",
  },
  feature3Name: { en: "Proof Aware", zh: "证明感知" },
  feature3Desc: {
    en: "Proof mode is explicit in the payload. Submit this request id to the Morpheus VRF lane; the returned randomness proof can be matched back to it. The draw and proof verification happen on that lane, not here.",
    zh: "载荷中明确包含证明模式。把此请求 ID 提交到 Morpheus VRF 通道；返回的随机数证明可与之对应。抽取与证明验证在该通道完成，而非此处。",
  },
} as const;

export const messages = mergeMessages(appMessages);
