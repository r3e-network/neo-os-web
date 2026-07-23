import { sha256 } from "../shims/noble-hashes-sha256.js";
import { addressToScriptHash } from "@shared/utils/neo";
import { FACTORY_TEMPLATE_ARTIFACTS } from "./generated-template-artifacts";
import type { FactoryContractArg, FactoryKind } from "./factoryPlan";

type ArtifactFactoryKind = Extract<FactoryKind, "nep17" | "nep11">;

export interface FactoryArtifactCall {
  artifactDigest: string;
  initParamsJson: string;
  manifest: string;
  nefBase64: string;
  args: FactoryContractArg[];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(...values: Uint8Array[]): Uint8Array {
  const length = values.reduce((total, value) => total + value.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function hashToBase64(account: unknown): string {
  const hash = addressToScriptHash(String(account ?? "").trim());
  if (!/^0x[0-9a-f]{40}$/.test(hash)) {
    throw new Error("invalid factory artifact account");
  }
  const bytes = Uint8Array.from(
    hash.slice(2).match(/.{2}/g) ?? [],
    (pair) => Number.parseInt(pair, 16),
  );
  return bytesToBase64(bytes);
}

function deploymentInitParams(
  kind: ArtifactFactoryKind,
  initParams: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === "nep17") {
    return {
      ...initParams,
      ownerHashBase64: hashToBase64(initParams.owner),
      treasuryHashBase64: hashToBase64(initParams.treasury),
    };
  }
  return {
    ...initParams,
    ownerHashBase64: hashToBase64(initParams.owner),
  };
}

function instanceManifest(baseManifest: string, packageId: string): string {
  const manifest = JSON.parse(baseManifest) as Record<string, unknown>;
  manifest.name = packageId;
  return JSON.stringify(manifest);
}

export function buildFactoryArtifactCall(
  kind: ArtifactFactoryKind,
  templateId: string,
  packageId: string,
  initParams: Record<string, unknown>,
): FactoryArtifactCall {
  const artifact = FACTORY_TEMPLATE_ARTIFACTS[kind];
  const manifest = instanceManifest(artifact.manifest, packageId);
  const initParamsJson = JSON.stringify(deploymentInitParams(kind, initParams));
  const nef = base64ToBytes(artifact.nefBase64);
  const artifactDigest = bytesToBase64(
    sha256(concatBytes(nef, utf8(manifest), utf8(initParamsJson))),
  );
  return {
    artifactDigest,
    initParamsJson,
    manifest,
    nefBase64: artifact.nefBase64,
    args: [
      { type: "String", value: templateId },
      { type: "String", value: packageId },
      { type: "String", value: artifactDigest },
      { type: "String", value: initParamsJson },
      { type: "ByteArray", value: artifact.nefBase64 },
      { type: "String", value: manifest },
    ],
  };
}

export function factoryTemplateArtifactHashes(kind: ArtifactFactoryKind): {
  nefHash: string;
  manifestHash: string;
} {
  const artifact = FACTORY_TEMPLATE_ARTIFACTS[kind];
  return {
    nefHash: artifact.nefSha256,
    manifestHash: artifact.manifestSha256,
  };
}
