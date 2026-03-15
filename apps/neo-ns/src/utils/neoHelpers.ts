import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";

type Translator = (key: string) => string;
export type NeoStatusNotifier = (message: string, type?: "success" | "error") => void;

export function ensureNeoWalletAndChain(
  chainType: unknown,
  address: string | null | undefined,
  t: Translator,
  notifyError: NeoStatusNotifier,
): boolean {
  if (!requireNeoChain(chainType, t)) {
    return false;
  }

  if (!address) {
    notifyError(t("connectWalletFirst"), "error");
    return false;
  }

  return true;
}

export async function handleNeoInvocation<T>(
  action: () => Promise<T>,
  t: Translator,
  errorKey: string,
  notifyError: NeoStatusNotifier,
): Promise<T | null> {
  try {
    return await action();
  } catch (error: unknown) {
    notifyError(formatErrorMessage(error, t(errorKey)), "error");
    return null;
  }
}

export function domainToTokenId(name: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name.toLowerCase() + ".neo");
  return btoa(String.fromCharCode(...bytes));
}
