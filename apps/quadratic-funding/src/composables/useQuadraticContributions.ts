import { createObservable, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import {
  useContractInteraction,
  waitForDepositConfirmation,
  DepositConfirmedActionFailedError,
} from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { extractTxid } from "@shared/utils/transaction";
import { BLOCKCHAIN_CONSTANTS, TIME_CONSTANTS, resolveNeoNetwork } from "@shared/constants";
import type { Network } from "@shared/utils/n3index";
import type { RoundItem } from "../pages/index/components/RoundList";
import type { ProjectItem } from "../pages/index/components/ProjectList";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const APP_ID = "miniapp-quadratic-funding";

export function useQuadraticContributions(
  selectedRound: Observable<RoundItem | null>,
  ensureContractAddress: () => Promise<string>,
  setStatus: (msg: string, type: "success" | "error") => void,
  refreshProjects: () => Promise<void>,
  refreshRounds: () => Promise<void>
) {
  const { t } = createUseI18n(messages)();
  const wallet = useWallet() as WalletSDK;
  const address = refToObservable(wallet.address);
  const chainType = refToObservable(wallet.chainType);
  const { invokeDirectly, ensureWallet } = useContractInteraction({
    appId: "miniapp-quadratic-funding",
    t,
    wallet,
  });

  const isContributing = createObservable(false);

  const walletNetwork = (): Network => resolveNeoNetwork(chainType.get() ?? "");

  const contributeForm = {
    roundId: "",
    projectId: "",
    amount: "",
    memo: "",
  };

  const selectProject = (project: ProjectItem) => {
    contributeForm.projectId = project.id;
    contributeForm.roundId = project.roundId;
  };

  const contribute = async (data: { roundId: string; projectId: string; amount: string; memo: string }) => {
    if (!requireNeoChain(chainType.get(), t)) return;
    if (isContributing.get()) return;
    if (!selectedRound.get()) {
      setStatus(t("noSelectedRound"), "error");
      return;
    }

    const parsedProjectId = Number.parseInt(data.projectId.trim(), 10);
    if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0) {
      setStatus(t("invalidContribution"), "error");
      return;
    }

    const decimals = selectedRound.get().assetSymbol === "NEO" ? 0 : 8;
    const amount = (() => {
      const [intPart = "", fracPart = ""] = data.amount.split(".");
      // NEO is indivisible — reject fractional amounts explicitly
      if (decimals === 0 && fracPart.length > 0) {
        setStatus(t("neoNoFractional"), "error");
        return null;
      }
      const normalized = fracPart.slice(0, decimals).padEnd(decimals, "0");
      const value = `${intPart.trim()}${normalized}`;
      return value.replace(/^0+/, "") || "0";
    })();

    if (amount === null) return;

    // Reject negative / non-numeric / scientific-notation strings before they
    // reach the chain call (e.g. "-5" or "abc" survive the leading-zero strip).
    if (!/^\d+$/.test(amount) || amount === "0") {
      setStatus(t("invalidContribution"), "error");
      return;
    }

    try {
      isContributing.set(true);
      await ensureWallet();
      if (!address.get()) throw new Error(t("walletNotConnected"));

      const contract = await ensureContractAddress();
      const memo = data.memo.trim().slice(0, 160);
      const assetHash = selectedRound.get().assetSymbol === "NEO" ? NEO_HASH : GAS_HASH;

      // Deposit-then-act: Contribute consumes prepaid asset credit, so deposit
      // the exact amount with a miniapp-quadratic-funding:* memo first, wait for
      // it to land, then fire the consuming call. A bare invoke faulted
      // "insufficient prepaid asset".
      const transferTx = await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: amount },
          { type: "String", value: `${APP_ID}:contribute` },
        ],
        assetHash,
      );
      const depositTxid = extractTxid(transferTx.tx as unknown) || transferTx.txid;
      const settlement = await waitForDepositConfirmation(depositTxid, {
        network: walletNetwork(),
        contractHash: assetHash,
      });
      if (settlement === "unreachable") {
        await new Promise((resolve) => setTimeout(resolve, TIME_CONSTANTS.SECOND_MS * 4));
      }

      try {
        await invokeDirectly(
          "contribute",
          [
            { type: "Hash160", value: address.get() as string },
            { type: "Integer", value: selectedRound.get().id },
            { type: "Integer", value: String(parsedProjectId) },
            { type: "Integer", value: amount },
            { type: "String", value: memo },
          ],
          contract,
        );
      } catch (error) {
        if (settlement === "confirmed") {
          throw new DepositConfirmedActionFailedError("contribute", depositTxid, error);
        }
        throw error;
      }

      setStatus(t("contributionSent"), "success");
      await refreshProjects();
      await refreshRounds();
    } catch (e) {
      setStatus(formatErrorMessage(e, t("contractMissing")), "error");
    } finally {
      isContributing.set(false);
    }
  };

  const goToContribute = (project: ProjectItem, activeTab: Observable<string>) => {
    selectProject(project);
    activeTab.set("contribute");
  };

  return {
    isContributing,
    contributeForm,
    selectProject,
    contribute,
    goToContribute,
  };
}
