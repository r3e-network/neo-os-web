/**
 * Common formatters for MiniApps
 */

export function formatNumber(num: number, decimals = 2): string {
  if (num >= 1000000) return (num / 1000000).toFixed(decimals) + "M";
  if (num >= 1000) return (num / 1000).toFixed(decimals) + "K";
  return num.toFixed(decimals);
}

export function formatAddress(addr: string, chars = 6): string {
  if (!addr || addr.length < chars * 2) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function formatTime(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function randomIntFromBytes(bytes: Uint8Array, offset: number, max: number): number {
  if (bytes.length < offset + 2) return 0;
  const val = (bytes[offset] << 8) | bytes[offset + 1];
  return val % max;
}
