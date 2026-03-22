function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return toHex(digest);
}

export async function sha256HexFromHex(value: string): Promise<string> {
  const cleaned = value.replace(/^0x/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.length % 2 !== 0) {
    throw new Error("sha256HexFromHex: hex string must have even number of characters");
  }
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error("sha256HexFromHex: invalid hex character");
  }
  const hexBytes = cleaned.match(/.{1,2}/g);
  if (!hexBytes) return "";
  const data = new Uint8Array(hexBytes.map((byte) => parseInt(byte, 16)));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return toHex(digest);
}
