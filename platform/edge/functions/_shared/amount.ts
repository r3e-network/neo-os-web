export function parseDecimalToInt(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error("amount is required");
  if (trimmed.startsWith("-")) throw new Error("amount must be >= 0");

  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) throw new Error("invalid amount format");

  const whole = match[1];
  const frac = match[2] ?? "";
  if (frac.length > decimals) throw new Error(`too many decimals (max ${decimals})`);

  const fracPadded = frac.padEnd(decimals, "0");
  const scale = 10n ** BigInt(decimals);
  return BigInt(whole) * scale + BigInt(fracPadded === "" ? "0" : fracPadded);
}

