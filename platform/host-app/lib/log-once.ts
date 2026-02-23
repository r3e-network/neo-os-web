import { logger } from "./logger";

type GlobalWarnStore = {
  __hostWarnOnceKeys?: Set<string>;
};

function getWarnedKeys(): Set<string> {
  const root = globalThis as typeof globalThis & GlobalWarnStore;
  if (!root.__hostWarnOnceKeys) {
    root.__hostWarnOnceKeys = new Set<string>();
  }
  return root.__hostWarnOnceKeys;
}

export function warnOnce(key: string, message: string, ...args: unknown[]): void {
  const warnedKeys = getWarnedKeys();
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  logger.warn(message, ...args);
}
