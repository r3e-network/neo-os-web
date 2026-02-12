import { sc, u, wallet } from "@cityofzion/neon-core";

export type NeoAccount = {
  address: string;
  publicKey: string;
  privateKey: string;
  wif: string;
};

export const generateAccount = (): NeoAccount => {
  const account = new wallet.Account();
  return {
    address: account.address,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
    wif: account.WIF,
  };
};

export const validateWif = (value: string): boolean => wallet.isWIF(value.trim());

export const validatePrivateKey = (value: string): boolean => wallet.isPrivateKey(value.trim());

export const validatePublicKey = (value: string): boolean => wallet.isPublicKey(value.trim());

export const validateHexScript = (value: string): boolean => {
  const cleaned = u.remove0xPrefix(value.trim());
  return cleaned.length > 0 && u.isHex(cleaned);
};

export const convertPrivateKeyToWif = (privateKey: string): string =>
  wallet.getWIFFromPrivateKey(privateKey.trim());

export const convertPublicKeyToAddress = (publicKey: string): string => {
  const trimmed = publicKey.trim();
  const encoded = wallet.isPublicKey(trimmed, true)
    ? trimmed
    : wallet.getPublicKeyEncoded(trimmed);
  const scriptHash = wallet.getScriptHashFromPublicKey(encoded);
  return wallet.getAddressFromScriptHash(scriptHash);
};

export const disassembleScript = (script: string): string[] => {
  const cleaned = u.remove0xPrefix(script.trim());
  if (!cleaned || !u.isHex(cleaned)) return [];
  try {
    return sc.OpToken.fromScript(cleaned).map((token) => token.prettyPrint());
  } catch {
    /* Invalid script bytes — return empty disassembly */
    return [];
  }
};

export const getPublicKey = (privateKey: string): string =>
  wallet.getPublicKeyFromPrivateKey(privateKey.trim(), true);

export const getPrivateKeyFromWIF = (wif: string): string => wallet.getPrivateKeyFromWIF(wif.trim());
