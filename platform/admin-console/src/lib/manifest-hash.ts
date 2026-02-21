import { createHash } from "crypto";
import { stableStringify } from "../../../shared/manifest";

export { stableStringify };

export function computeManifestHashHex(manifest: unknown): string {
  return createHash("sha256").update(stableStringify(manifest)).digest("hex");
}
