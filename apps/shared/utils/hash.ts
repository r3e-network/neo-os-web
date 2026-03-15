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
  const data = new Uint8Array(
    value.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return toHex(digest);
}
