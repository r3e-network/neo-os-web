import { createObservable, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import {
  validateWif,
  validatePrivateKey,
  validatePublicKey,
  validateHexScript,
  convertPrivateKeyToWif,
  convertPublicKeyToAddress,
  disassembleScript,
  getPublicKey,
  getPrivateKeyFromWIF,
} from "@/services/neo";
import type { ClipboardService } from "@shared/services";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export interface ConversionResult {
  address: string;
  publicKey: string;
  wif: string;
  privateKey: string;
  opcodes: string[];
}

const EMPTY_RESULT: ConversionResult = {
  address: "",
  publicKey: "",
  wif: "",
  privateKey: "",
  opcodes: [],
};

/** Converts between Neo key formats (WIF, private key, public key) and disassembles scripts. */
export function useConverter(t: (key: string) => string, clipboard?: ClipboardService) {
  const sm = useStatusMessage(3000);
  const copyStatus = refToObservable(sm.status);
  const { setStatus: setCopyStatus } = sm;

  const inputKey = createObservable("");
  const statusMsg = createObservable("");
  const statusType = createObservable("");
  const showSecrets = createObservable(false);
  const result = createObservable<ConversionResult>({ ...EMPTY_RESULT });

  async function copy(text: string) {
    if (clipboard) {
      await clipboard.copy(text, "copied");
    } else {
      // Legacy fallback for uni-app context
      uni.setClipboardData({
        data: text,
        success: () => setCopyStatus(t("copied"), "success"),
      });
    }
  }

  function clearResult() {
    result.set({ ...EMPTY_RESULT });
    statusMsg.set("");
    statusType.set("");
    showSecrets.set(false);
  }

  function detectAndConvert() {
    const val = inputKey.get().trim();
    if (!val) {
      clearResult();
      return;
    }

    try {
      // 1. Try WIF
      if (validateWif(val)) {
        statusMsg.set("detectedWif");
        statusType.set("success");
        const priv = getPrivateKeyFromWIF(val)!;
        const pub = getPublicKey(priv);
        const addr = convertPublicKeyToAddress(pub);
        result.set({ address: addr, publicKey: pub, wif: val, privateKey: priv, opcodes: [] });
        return;
      }

      // 2. Try Public Key (66 hex)
      if (validatePublicKey(val)) {
        statusMsg.set("detectedPubKey");
        statusType.set("success");
        const address = convertPublicKeyToAddress(val);
        result.set({ address, publicKey: val, wif: "", privateKey: "", opcodes: [] });
        return;
      }

      // 3. Try Private Key (64 hex)
      if (validatePrivateKey(val)) {
        statusMsg.set("detectedPrivKey");
        statusType.set("success");
        const pub = getPublicKey(val);
        const addr = convertPublicKeyToAddress(pub);
        const wif = convertPrivateKeyToWif(val);
        result.set({ address: addr, publicKey: pub, wif, privateKey: val, opcodes: [] });
        return;
      }

      // 4. Try Hex Script
      if (validateHexScript(val)) {
        statusMsg.set("detectedScript");
        statusType.set("success");
        const ops = disassembleScript(val);
        result.set({ address: "", publicKey: "", wif: "", privateKey: "", opcodes: ops });
        return;
      }

      statusMsg.set("unknownFormat");
      statusType.set("error");
      result.set({ ...EMPTY_RESULT });
    } catch (e) {
      statusMsg.set(formatErrorMessage(e, t("invalidFormat")));
      statusType.set("error");
    }
  }

  return {
    inputKey,
    statusMsg,
    statusType,
    showSecrets,
    result,
    copyStatus,
    copy,
    detectAndConvert,
  };
}
