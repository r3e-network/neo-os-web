import { verifyMessage } from "https://esm.sh/ethers@6.11.1";

export function verifyEvmSignature(address: string, message: string, signature: string): boolean {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}
