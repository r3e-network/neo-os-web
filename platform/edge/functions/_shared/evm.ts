import { verifyMessage } from "https://esm.sh/ethers@6.11.1";

export function verifyEvmSignature(address: string, message: string, signature: string): boolean {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (_e: unknown) {
    console.warn("[evm] verifyEvmSignature failed:", _e instanceof Error ? _e.message : String(_e));
    return false;
  }
}
