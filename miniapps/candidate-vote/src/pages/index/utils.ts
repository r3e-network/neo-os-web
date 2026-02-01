import type { Candidate, CandidatesResponse } from "@neo/uniapp-sdk";
import { bytesToHex, hexToBytes } from "@shared/utils/format";
import crypto from "crypto";

const sha256 = (data: Uint8Array): Uint8Array => {
  return new Uint8Array(crypto.createHash("sha256").update(Buffer.from(data)).digest());
};

const ripemd160 = (data: Uint8Array): Uint8Array => {
  return new Uint8Array(crypto.createHash("ripemd160").update(Buffer.from(data)).digest());
};

export interface GovernanceCandidate extends Candidate {
  logo?: string;
  website?: string;
  email?: string;
  location?: string;
  description?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  github?: string;
}

export type GovernanceCandidatesResponse = Omit<CandidatesResponse, "candidates"> & {
  candidates: GovernanceCandidate[];
};

type GovernanceNetwork = "mainnet" | "testnet";

interface CandidateInfo {
  scriptHash: string;
  address: string;
  entity?: string;
  location?: string;
  website?: string;
  email?: string;
  github?: string;
  telegram?: string;
  twitter?: string;
  description?: string;
  logo?: string;
}

const KNOWN_CANDIDATES: Record<string, string> = {
  "0248a37e04c7a5fb9fdc9f0323b2955a94cbb2296d2ad1feacea24ec774a87c4a4": "Neo News Today",
  "035d574cc6a904e82dfd82d7f6fc9c2ca042d4410a4910ecc8c07a07db49dc6513": "Everstake",
  "023e9b32ea892944b2bd6dc757b3bf93781e6b8a8b13996f2648fb166c3c552099": "Binance Staking",
  "020f2887f41474cfeb11fd23a5990269774b375d685526cd5825bb8d479153592b": "Neo SPCC",
  "021033e0811e56994cf41777271891d17d50d0327f2f114c023d53ba50c37077e5": "COZ",
};

const GOVERNANCE_RPC: Record<GovernanceNetwork, { rpcUrl: string; committeeInfoContract: string }> = {
  mainnet: {
    rpcUrl: "https://n3seed2.ngd.network:10332",
    committeeInfoContract: "0xb776afb6ad0c11565e70f8ee1dd898da43e51be1",
  },
  testnet: {
    rpcUrl: "https://n3seed2.ngd.network:40332",
    committeeInfoContract: "0x6177bfcef0f51b5dd21b183ff89e301b9c66d71c",
  },
};

const FILESEND_BASE = "https://filesend.ngd.network/gate/get/CeeroywT8ppGE4HGjhpzocJkdb2yu3wD5qCGFTjkw1Cc/";
const URL_PATTERN = /^((http|https|ftp):\/\/)/i;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NEO_PUSHDATA1 = "0c";
const NEO_SYSCALL = "41";
const NEO_CHECKSIG_SYSCALL = "56e7b327";

const requestJson = async (url: string, data: unknown): Promise<unknown> => {
  if (typeof uni !== "undefined" && typeof uni.request === "function") {
    return new Promise((resolve, reject) => {
      uni.request({
        url,
        method: "POST",
        data,
        timeout: 12000,
        header: { "content-type": "application/json" },
        success: (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(`Request failed: ${res.statusCode ?? "unknown"}`));
          }
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
};

const rpcRequest = async <T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> => {
  const payload = {
    jsonrpc: "2.0",
    method,
    params,
    id: 1,
  };
  const response = (await requestJson(rpcUrl, payload)) as { result?: T; error?: { message?: string } };
  if (response?.error) {
    throw new Error(response.error.message || "RPC error");
  }
  return response?.result as T;
};

const normalizePublicKey = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/^0x/i, "");
};

const normalizeScriptHash = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/^0x/i, "").toLowerCase();
};

const normalizeVotes = (value: unknown) => {
  if (value === null || value === undefined) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Math.floor(value).toString();

  const raw = String(value).replace(/,/g, "").trim();
  if (!raw) return "0";
  if (/^\d+$/.test(raw)) return raw;
  if (/^\d+\.\d+$/.test(raw)) return raw.split(".")[0];
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return Math.floor(parsed).toString();
  return raw;
};

const normalizeUrl = (value: unknown) => {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("www.")) return `https://${raw}`;
  return raw;
};

const normalizeSocial = (value: unknown, prefix: string) => {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("@")) return `${prefix}${raw.slice(1)}`;
  return `${prefix}${raw}`;
};

const base64ToBytes = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return new Uint8Array();
  const normalized = raw.replace(/[\r\n\s]/g, "");
  const bufferRef = (globalThis as any)?.Buffer;
  if (bufferRef?.from) {
    return Uint8Array.from(bufferRef.from(normalized, "base64"));
  }
  const atobRef = (globalThis as any)?.atob;
  if (typeof atobRef === "function") {
    const binary = atobRef(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array();
};

const bytesToText = (bytes: Uint8Array) => {
  if (!bytes.length) return "";
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  let output = "";
  for (const byte of bytes) {
    output += String.fromCharCode(byte);
  }
  return output;
};

const base64ToText = (value: unknown) => bytesToText(base64ToBytes(value));

const base64ToHex = (value: unknown) => bytesToHex(base64ToBytes(value));

const reverseHex = (hex: string) => {
  if (!hex) return "";
  const bytes = hexToBytes(hex);
  return bytesToHex(Uint8Array.from(bytes).reverse());
};

const base58Encode = (bytes: Uint8Array): string => {
  if (!bytes.length) return "";
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (const byte of bytes) {
    if (byte === 0) {
      digits.push(0);
    } else {
      break;
    }
  }
  return digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join("");
};

const base58CheckEncode = (payload: Uint8Array) => {
  const checksum = sha256(sha256(payload)).slice(0, 4);
  const data = new Uint8Array(payload.length + 4);
  data.set(payload, 0);
  data.set(checksum, payload.length);
  return base58Encode(data);
};

const scriptHashToAddress = (scriptHash: string) => {
  const normalized = normalizeScriptHash(scriptHash);
  if (!normalized) return "";
  const bytes = hexToBytes(normalized);
  if (!bytes.length) return "";
  const payload = new Uint8Array(1 + bytes.length);
  payload[0] = 0x35;
  payload.set(Uint8Array.from(bytes).reverse(), 1);
  return base58CheckEncode(payload);
};

const publicKeyToScriptHash = (publicKey: string) => {
  const normalized = normalizePublicKey(publicKey);
  if (!/^[0-9a-fA-F]{66}$/.test(normalized)) return "";
  const verificationScript = `${NEO_PUSHDATA1}21${normalized}${NEO_SYSCALL}${NEO_CHECKSIG_SYSCALL}`;
  const scriptBytes = hexToBytes(verificationScript);
  const sha = sha256(scriptBytes);
  const ripe = ripemd160(sha);
  return reverseHex(bytesToHex(ripe));
};

const decodeCandidateInfoEntry = (entry: any): CandidateInfo | null => {
  const values = Array.isArray(entry?.value) ? entry.value : Array.isArray(entry) ? entry : null;
  if (!values || values.length === 0) return null;

  const getValue = (index: number) => values[index]?.value ?? values[index]?.Value ?? "";
  const scriptHashRaw = base64ToHex(getValue(0));
  const scriptHash = normalizeScriptHash(reverseHex(scriptHashRaw));
  if (!scriptHash) return null;

  const entity = base64ToText(getValue(1)).trim();
  const location = base64ToText(getValue(2)).trim();
  const website = base64ToText(getValue(3)).trim();
  const email = base64ToText(getValue(4)).trim();
  const github = base64ToText(getValue(5)).trim();
  const telegram = base64ToText(getValue(6)).trim();
  const twitter = base64ToText(getValue(7)).trim();
  const description = base64ToText(getValue(8)).trim();
  const iconValue = base64ToText(getValue(9)).trim();

  let logo: string | undefined;
  if (iconValue) {
    logo = URL_PATTERN.test(iconValue) ? iconValue : `${FILESEND_BASE}${iconValue}`;
  }

  return {
    scriptHash,
    address: scriptHashToAddress(scriptHash),
    entity: entity || undefined,
    location: location || undefined,
    website: normalizeUrl(website),
    email: email || undefined,
    github: normalizeSocial(github, "https://github.com/"),
    telegram: normalizeSocial(telegram, "https://t.me/"),
    twitter: normalizeSocial(twitter, "https://twitter.com/"),
    description: description || undefined,
    logo,
  };
};

const parseCandidateInfoPayload = (payload: unknown): CandidateInfo[] => {
  if (!payload || typeof payload !== "object") return [];
  const response = payload as { stack?: unknown[]; result?: { stack?: unknown[] } };
  const stack = response.stack || response.result?.stack || [];
  if (!Array.isArray(stack) || stack.length === 0) return [];
  const rootValue = (stack[0] as any)?.value ?? [];
  if (!Array.isArray(rootValue)) return [];

  const infos: CandidateInfo[] = [];
  for (const entry of rootValue) {
    const info = decodeCandidateInfoEntry(entry);
    if (info) infos.push(info);
  }
  return infos;
};

const parseCommitteeList = (payload: unknown) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && Array.isArray((payload as any).committee)) {
    return (payload as any).committee;
  }
  return [] as unknown[];
};

const parseBlockHeight = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return 0;
  const raw = payload as Record<string, unknown>;
  const value = raw.blockheight ?? raw.blockHeight ?? raw.localrootindex ?? raw.validatedrootindex;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeCandidateActive = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return fallback;
};

export const fetchCandidates = async (
  chain: "neo-n3-mainnet" | "neo-n3-testnet",
): Promise<GovernanceCandidatesResponse> => {
  const network: GovernanceNetwork = chain === "neo-n3-testnet" ? "testnet" : "mainnet";
  const config = GOVERNANCE_RPC[network];

  const [heightResult, candidatesResult, committeeResult, infoResult] = await Promise.allSettled([
    rpcRequest<Record<string, unknown>>(config.rpcUrl, "getstateheight"),
    rpcRequest<any[]>(config.rpcUrl, "getcandidates"),
    rpcRequest<any[]>(config.rpcUrl, "getcommittee"),
    rpcRequest<Record<string, unknown>>(config.rpcUrl, "invokefunction", [
      config.committeeInfoContract,
      "getAllInfo",
      [],
      [],
    ]),
  ]);

  if (candidatesResult.status !== "fulfilled") {
    throw candidatesResult.reason || new Error("Failed to fetch candidates from governance RPC");
  }

  const candidatesRaw = Array.isArray(candidatesResult.value) ? candidatesResult.value : [];
  const committeeRaw = committeeResult.status === "fulfilled" ? parseCommitteeList(committeeResult.value) : [];
  const committeeKeys = new Set(committeeRaw.map((key) => normalizePublicKey(key)).filter(Boolean));

  const infoList = infoResult.status === "fulfilled" ? parseCandidateInfoPayload(infoResult.value) : [];
  const infoByScriptHash = new Map(infoList.map((info) => [info.scriptHash, info]));

  const candidates: GovernanceCandidate[] = candidatesRaw
    .map((raw) => {
      const publicKey = normalizePublicKey(raw.publickey ?? raw.publicKey ?? raw.key ?? "");
      if (!publicKey) return null;

      const votes = normalizeVotes(raw.votes ?? raw.vote ?? raw.totalVotes);
      const active = normalizeCandidateActive(raw.active ?? raw.isActive, committeeKeys.has(publicKey));
      const scriptHash = publicKeyToScriptHash(publicKey);
      const info = scriptHash ? infoByScriptHash.get(scriptHash) : undefined;
      const address = info?.address || (scriptHash ? scriptHashToAddress(scriptHash) : publicKey);

      return {
        publicKey,
        address,
        name: info?.entity || resolveCandidateName(publicKey) || undefined,
        votes,
        active,
        logo: info?.logo,
        website: info?.website,
        email: info?.email,
        location: info?.location,
        description: info?.description,
        twitter: info?.twitter,
        telegram: info?.telegram,
        github: info?.github,
      };
    })
    .filter((candidate): candidate is GovernanceCandidate => Boolean(candidate));

  const totalVotes = candidates.reduce((sum, candidate) => sum + BigInt(candidate.votes || "0"), BigInt(0)).toString();
  const blockHeight = heightResult.status === "fulfilled" ? parseBlockHeight(heightResult.value) : 0;

  return { candidates, totalVotes, blockHeight };
};

export const resolveCandidateName = (publicKey: string): string | undefined => {
  return KNOWN_CANDIDATES[normalizePublicKey(publicKey)];
};
