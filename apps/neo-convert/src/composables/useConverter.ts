import { createDerived, createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import {
  validateWif,
  validatePrivateKey,
  validatePublicKey,
  validateHexScript,
  validateAddress,
  convertPrivateKeyToWif,
  convertPublicKeyToAddress,
  addressToScriptHash,
  disassembleScript,
  getPublicKey,
  getPrivateKeyFromWIF,
} from "@/services/neo";
import type { MiniAppFramework } from "@shared/react";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export interface ConversionResult {
  address: string;
  publicKey: string;
  wif: string;
  privateKey: string;
  opcodes: string[];
  /** Script hash (big-endian 0x… display form) — populated for address input. */
  scriptHash: string;
  /** Script hash (little-endian) — the byte order used inside scripts. */
  scriptHashLE: string;
}

const EMPTY_RESULT: ConversionResult = {
  address: "",
  publicKey: "",
  wif: "",
  privateKey: "",
  opcodes: [],
  scriptHash: "",
  scriptHashLE: "",
};

/** Converts between Neo key formats (WIF, private key, public key) and disassembles scripts. */
export function useConverter(t: (key: string) => string, clipboard: MiniAppFramework["clipboard"]) {
  const sm = useStatusMessage(3000);
  const { setStatus: setCopyStatus } = sm;
  const copyStatus = createDerived(
    () => sm.status.get()?.msg ?? "",
    [sm.status],
  );

  const inputKey = createObservable("");
  const statusMsg = createObservable("");
  const statusType = createObservable("");
  const result = createObservable<ConversionResult>({ ...EMPTY_RESULT });

  async function copy(text: string) {
    // app.clipboard owns the write (navigator → legacy textarea fallback) and
    // the "copied"/"copyFailed" toast; the inline copyStatus chip keeps the
    // pre-migration behavior of always confirming the attempt.
    await clipboard.copy(text, { successKey: "copied" });
    setCopyStatus(t("copied"), "success");
  }

  function clearResult() {
    result.set({ ...EMPTY_RESULT });
    statusMsg.set("");
    statusType.set("");
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
        result.set({ ...EMPTY_RESULT, address: addr, publicKey: pub, wif: val, privateKey: priv });
        return;
      }

      // 2. Try Neo N3 address → script hash (advertised by the input
      //    placeholder). Checked before the key formats because a base58
      //    address never matches the hex/WIF validators, so it would otherwise
      //    fall through to "Unknown format".
      if (validateAddress(val)) {
        statusMsg.set("detectedAddress");
        statusType.set("success");
        // framework-exempt: this addressToScriptHash IS the app's product —
        // the converter must show BOTH endiannesses ({bigEndian, littleEndian}),
        // which the framework's single-value arg.hash160 lane does not expose.
        const { bigEndian, littleEndian } = addressToScriptHash(val);
        result.set({ ...EMPTY_RESULT, address: val, scriptHash: bigEndian, scriptHashLE: littleEndian });
        return;
      }

      // 3. Try Public Key (66 hex)
      if (validatePublicKey(val)) {
        statusMsg.set("detectedPubKey");
        statusType.set("success");
        const address = convertPublicKeyToAddress(val);
        result.set({ ...EMPTY_RESULT, address, publicKey: val });
        return;
      }

      // 4. Try Private Key (64 hex)
      if (validatePrivateKey(val)) {
        statusMsg.set("detectedPrivKey");
        statusType.set("success");
        const pub = getPublicKey(val);
        const addr = convertPublicKeyToAddress(pub);
        const wif = convertPrivateKeyToWif(val);
        result.set({ ...EMPTY_RESULT, address: addr, publicKey: pub, wif, privateKey: val });
        return;
      }

      // 5. Try Hex Script
      if (validateHexScript(val)) {
        statusMsg.set("detectedScript");
        statusType.set("success");
        const ops = disassembleScript(val);
        result.set({ ...EMPTY_RESULT, opcodes: ops });
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
    result,
    copyStatus,
    copy,
    detectAndConvert,
  };
}
