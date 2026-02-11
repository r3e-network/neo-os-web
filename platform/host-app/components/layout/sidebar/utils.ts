// Base58 alphabet for Neo
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Known script hash to address mappings (pre-computed for common contracts)
const KNOWN_ADDRESSES: Record<string, string> = {
  // Add known contract addresses here as needed
};

export function truncateAddress(address: string, start = 6, end = 4): string {
  if (!address || address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// Convert script hash (0x...) to Neo N3 address using proper Base58Check
export async function scriptHashToAddressAsync(scriptHash: string): Promise<string> {
  try {
    // Check known addresses first
    const normalized = scriptHash.toLowerCase();
    if (KNOWN_ADDRESSES[normalized]) return KNOWN_ADDRESSES[normalized];

    // Remove 0x prefix if present
    const hash = scriptHash.startsWith("0x") ? scriptHash.slice(2) : scriptHash;
    if (hash.length !== 40) return scriptHash; // Invalid hash length

    // Reverse byte order (little-endian to big-endian)
    const reversed = hash.match(/.{2}/g)?.reverse().join("") || hash;

    // Add Neo N3 address version byte (0x35 = 53)
    const withVersion = "35" + reversed;

    // Convert hex to bytes
    const bytes: number[] = [];
    for (let i = 0; i < withVersion.length; i += 2) {
      bytes.push(parseInt(withVersion.substr(i, 2), 16));
    }

    // Double SHA256 for checksum using Web Crypto API
    const data = new Uint8Array(bytes);
    const hash1 = await crypto.subtle.digest("SHA-256", data);
    const hash2 = await crypto.subtle.digest("SHA-256", hash1);
    const checksumBytes = Array.from(new Uint8Array(hash2)).slice(0, 4);

    // Append checksum
    const dataWithChecksum = [...bytes, ...checksumBytes];

    // Base58 encode
    let num = BigInt(0);
    for (const byte of dataWithChecksum) {
      num = num * BigInt(256) + BigInt(byte);
    }

    let encoded = "";
    while (num > 0) {
      const remainder = Number(num % BigInt(58));
      encoded = BASE58_ALPHABET[remainder] + encoded;
      num = num / BigInt(58);
    }

    // Add leading '1's for leading zero bytes
    for (const byte of dataWithChecksum) {
      if (byte === 0) encoded = "1" + encoded;
      else break;
    }

    return encoded || scriptHash;
  } catch {
    return scriptHash;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
