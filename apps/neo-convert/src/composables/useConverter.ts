import { ref } from "vue";
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
export function useConverter(t: (key: string) => string) {
  const { status: copyStatus, setStatus: setCopyStatus } = useStatusMessage(3000);

  const inputKey = ref("");
  const statusMsg = ref("");
  const statusType = ref("");
  const showSecrets = ref(false);
  const result = ref<ConversionResult>({ ...EMPTY_RESULT });

  function copy(text: string) {
    uni.setClipboardData({
      data: text,
      success: () => setCopyStatus(t("copied"), "success"),
    });
  }

  function clearResult() {
    result.value = { ...EMPTY_RESULT };
    statusMsg.value = "";
    statusType.value = "";
    showSecrets.value = false;
  }

  function detectAndConvert() {
    const val = inputKey.value.trim();
    if (!val) {
      clearResult();
      return;
    }

    try {
      // 1. Try WIF
      if (validateWif(val)) {
        statusMsg.value = "detectedWif";
        statusType.value = "success";
        const priv = getPrivateKeyFromWIF(val)!;
        const pub = getPublicKey(priv);
        const addr = convertPublicKeyToAddress(pub);
        result.value = { address: addr, publicKey: pub, wif: val, privateKey: priv, opcodes: [] };
        return;
      }

      // 2. Try Public Key (66 hex)
      if (validatePublicKey(val)) {
        statusMsg.value = "detectedPubKey";
        statusType.value = "success";
        const address = convertPublicKeyToAddress(val);
        result.value = { address, publicKey: val, wif: "", privateKey: "", opcodes: [] };
        return;
      }

      // 3. Try Private Key (64 hex)
      if (validatePrivateKey(val)) {
        statusMsg.value = "detectedPrivKey";
        statusType.value = "success";
        const pub = getPublicKey(val);
        const addr = convertPublicKeyToAddress(pub);
        const wif = convertPrivateKeyToWif(val);
        result.value = { address: addr, publicKey: pub, wif, privateKey: val, opcodes: [] };
        return;
      }

      // 4. Try Hex Script
      if (validateHexScript(val)) {
        statusMsg.value = "detectedScript";
        statusType.value = "success";
        const ops = disassembleScript(val);
        result.value = { address: "", publicKey: "", wif: "", privateKey: "", opcodes: ops };
        return;
      }

      statusMsg.value = "unknownFormat";
      statusType.value = "error";
      result.value = { ...EMPTY_RESULT };
    } catch (e: unknown) {
      statusMsg.value = formatErrorMessage(e, t("invalidFormat"));
      statusType.value = "error";
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
