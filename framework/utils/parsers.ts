export const parseBigInt = (value: unknown): bigint => {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
};
