import { messages as sharedMessages } from "@shared/composables/neo-pay";
import { mergeMessages } from "@shared/locale/base-messages";

const productionMessages = {
  neoPayChainContextMismatch: {
    en: "NeoPay is not bound to the canonical contract for this network. Switch network and reopen the app.",
    zh: "NeoPay 当前未绑定本网络的官方合约，请切换网络后重新打开应用。",
  },
  neoPayNetworkUnverified: {
    en: "NeoPay could not verify the wallet network. Reconnect the wallet before continuing.",
    zh: "NeoPay 暂时无法确认钱包网络，请重新连接钱包后再继续。",
  },
  neoPayPendingBlocksWrites: {
    en: "A previous wallet transaction still needs confirmation. Check it before starting another action.",
    zh: "上一笔钱包交易仍待确认，请先检查结果，再发起新的操作。",
  },
  neoPayPendingInvalid: {
    en: "The saved recovery record is invalid and has been cleared.",
    zh: "保存的交易恢复记录无效，现已清除。",
  },
  neoPayPendingContextMismatch: {
    en: "Reconnect the same wallet and network used for this transaction to recover it.",
    zh: "请连接发起该交易时使用的钱包和网络，再进行恢复。",
  },
  neoPayEventMismatch: {
    en: "The chain event did not match this payment action. The transaction remains in review.",
    zh: "链上事件与本次支付操作不一致，交易将继续保持待检查状态。",
  },
  neoPayReadbackMismatch: {
    en: "The event arrived, but the authoritative stream state does not match yet.",
    zh: "事件已经到达，但权威资金流状态暂未匹配。",
  },
  neoPayDataUnavailable: {
    en: "Live stream data is unavailable. No cached counts are being shown.",
    zh: "实时资金流数据暂不可用，界面不会展示缓存统计。",
  },
  neoPayDataPartial: {
    en: "Some stream details could not be verified. Available rows are marked as a partial chain view.",
    zh: "部分资金流详情暂未验证，当前展示的是不完整链上视图。",
  },
  neoPayTransactionPending: {
    en: "Transaction submitted. Check its on-chain result before repeating this action.",
    zh: "交易已提交，请先检查链上结果，不要重复操作。",
  },
  neoPayConfirmationNeedsReview: {
    en: "Confirmation needs another chain read. Your recovery record is preserved.",
    zh: "确认结果仍需再次读取链上状态，恢复记录已安全保留。",
  },
  neoPayTransactionRecovered: {
    en: "The payment action is confirmed and matches the live stream state.",
    zh: "支付操作已确认，并与实时资金流状态一致。",
  },
  neoPayTransactionFault: {
    en: "The transaction faulted on-chain. No success was recorded; you can review and retry.",
    zh: "交易已在链上失败，应用未记录成功；检查后可重新尝试。",
  },
  neoPayOperationBusy: {
    en: "NeoPay is already processing an action.",
    zh: "NeoPay 正在处理另一项操作。",
  },
  neoPayWriteContextChanged: {
    en: "The wallet or network changed while NeoPay was preparing this action. Review it again before continuing.",
    zh: "NeoPay 准备操作时钱包或网络发生了变化，请重新确认后再继续。",
  },
  neoPayRecoveryStorageUnavailable: {
    en: "Transaction recovery is unavailable on this device. Restore it before opening a wallet action.",
    zh: "当前设备暂时无法保存交易恢复记录，请先恢复后再唤起钱包操作。",
  },
  neoPayRecoveryStorageRestored: {
    en: "Transaction recovery is ready again.",
    zh: "交易恢复记录现已可以正常保存。",
  },
  neoPayPendingInvalidStorageBlocked: {
    en: "An invalid recovery record could not be removed. Restore local recovery before continuing.",
    zh: "无效的交易恢复记录暂时无法删除，请先恢复本地记录功能。",
  },
  neoPayNotesTooLong: {
    en: "Keep the payment note within 240 characters.",
    zh: "支付备注请控制在 240 个字符以内。",
  },
  neoPayNotAuthorized: {
    en: "This wallet is not authorized for that stream action.",
    zh: "当前钱包无权执行该资金流操作。",
  },
  neoPayStreamFinalized: {
    en: "This stream is already finalized. Refresh to view its latest state.",
    zh: "该资金流已经结束，请刷新查看最新状态。",
  },
  neoPayContractPaused: {
    en: "NeoPay writes are paused on-chain. Existing stream data remains available.",
    zh: "NeoPay 链上写操作当前已暂停，仍可查看现有资金流。",
  },
  neoPayCriticalDataUnavailable: {
    en: "NeoPay could not verify the live contract state. No wallet action was opened.",
    zh: "NeoPay 暂时无法核验实时合约状态，因此没有唤起钱包操作。",
  },
  checkTransaction: { en: "Check transaction", zh: "检查交易" },
  checkingTransaction: { en: "Checking transaction…", zh: "正在检查交易……" },
  claimAvailable: { en: "Claim {amount} {asset}", zh: "领取 {amount} {asset}" },
  claimAvailableHint: {
    en: "Claim the newest verified stream with funds available now.",
    zh: "领取最新一笔当前已有可领资金的已验证支付流。",
  },
  restoreRecoveryStorage: { en: "Restore transaction recovery", zh: "恢复交易记录" },
  checkingRecoveryStorage: { en: "Restoring recovery…", zh: "正在恢复记录……" },
  neoPayAmountPrecisionHint: {
    en: "GAS supports up to 8 decimal places.",
    zh: "GAS 最多支持 8 位小数。",
  },
  neoPayNotesHint: {
    en: "Optional context for the recipient, up to 240 characters.",
    zh: "可选的收款说明，最多 240 个字符。",
  },
  chainViewVerified: { en: "Verified chain view", zh: "已验证链上视图" },
  chainViewPartial: { en: "Partial chain view", zh: "不完整链上视图" },
  chainViewUnavailable: { en: "Connect wallet to load live streams", zh: "连接钱包后加载实时资金流" },
  officialToken: { en: "Official Neo N3 asset", zh: "Neo N3 官方资产" },
  confirmCancelStream: { en: "Confirm cancel", zh: "确认取消" },
  paymentArtAlt: {
    en: "A bright payment vault streaming coins to a recipient terminal",
    zh: "明亮的支付金库将资产流式发送到收款终端",
  },
} as const;

export const messages = mergeMessages({
  ...sharedMessages,
  ...productionMessages,
});
