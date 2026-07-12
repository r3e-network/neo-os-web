/**
 * framework/oracle-surface — app.oracle (RFC P0-1 §2 step 8, moved verbatim
 * from index.ts).
 *
 * Envelope builders (http / vrf / compute / seal) + dispatch, extended with
 * the S13 dataFeed reader and seal client. The request/dispatch lanes are
 * guest-guarded and gated on the "oracle:request" manifest permission (S11,
 * default-allow when no manifest permissions are declared); `seal.store` is
 * the documented GUEST_GUARD_ONLY exemption.
 */

import { GUEST_GUARD_ONLY, ORACLE_REQUEST, guardedWrite } from "./internal/guards";
import type { FrameworkGuardDeps } from "./internal/guards";
import type { FrameworkOracleExtensions, FrameworkSealStoreInput } from "./oracle-ext";
import { sha256Hex0x } from "./utils/hash";
import type {
  ComputeOracleRequest,
  FrameworkContractArg,
  FrameworkInvokeOptions,
  FrameworkOracleSurface,
  FrameworkTxResult,
  FrameworkWriteSpec,
  HttpOracleRequest,
  OracleEnvelope,
  SealOracleRequest,
  VrfOracleRequest,
} from "./types";

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

export interface OracleSurfaceDeps {
  /** App id stamped into every envelope payload. */
  appId: string;
  /** Guest guard + S11 permission gate (RFC P0-2). */
  guards: FrameworkGuardDeps;
  /** Lazy accessor for the S13 oracle extensions (dataFeed + seal client). */
  oracleExt(): FrameworkOracleExtensions;
  /** The `app.chain.write` lane (dispatch appends the envelope payload). */
  write(spec: FrameworkWriteSpec & FrameworkInvokeOptions): Promise<FrameworkTxResult>;
}

/**
 * Build the `app.oracle` surface (see module doc).
 *
 * @example
 * ```ts
 * const oracle = createOracleSurface({ appId, guards, oracleExt, write });
 * const envelope = await oracle.vrf({ consumer, salt: "roll" });
 * await oracle.dispatch(envelope, { operation: "requestRoll", successKey: "requested" });
 * ```
 */
export function createOracleSurface(deps: OracleSurfaceDeps): FrameworkOracleSurface {
  const { appId, guards, oracleExt } = deps;

  const createEnvelope = async <TPayload extends Record<string, unknown>>(
    kind: string,
    payload: TPayload,
  ): Promise<OracleEnvelope<TPayload>> => {
    const unsigned = { kind, appId, ...payload };
    const digest = await sha256Hex0x(stableJson(unsigned));
    return {
      kind,
      digest,
      payload: {
        ...unsigned,
        digest,
      } as OracleEnvelope<TPayload>["payload"],
    };
  };

  return {
    http: guardedWrite(guards, ORACLE_REQUEST, async (request: HttpOracleRequest) => {
      const url = new URL(request.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("HTTP oracle request must use http(s) URL");
      }
      const method = request.method ?? "GET";
      return createEnvelope("oracle.http.request", {
        url: url.toString(),
        method,
        path: request.path ?? "$",
        ...(method === "POST" && request.body !== undefined ? { body: request.body } : {}),
      });
    }),
    vrf: guardedWrite(guards, ORACLE_REQUEST, async (request: VrfOracleRequest) => {
      const rounds = Math.max(1, Math.min(64, Math.trunc(Number(request.rounds ?? 1) || 1)));
      return createEnvelope("oracle.vrf.request", {
        consumer: request.consumer,
        salt: request.salt,
        rounds,
        proofMode: request.proofMode ?? (rounds > 1 ? "batch" : "single"),
      });
    }),
    compute: guardedWrite(guards, ORACLE_REQUEST, async (request: ComputeOracleRequest) => {
      const inputDigest = await sha256Hex0x(stableJson(request.input));
      return createEnvelope("oracle.compute.request", {
        workflow: request.workflow,
        sealed: request.sealed === true,
        inputDigest,
        ...(request.sealed ? {} : { input: request.input }),
      });
    }),
    /**
     * Seal lane: the callable keeps the existing envelope-digest builder
     * behavior; the S13 client methods (publicKey/encrypt/store) are
     * attached so `app.oracle.seal.publicKey()` extends — without breaking —
     * `app.oracle.seal(request)`.
     */
    seal: Object.assign(
      guardedWrite(guards, ORACLE_REQUEST, async (request: SealOracleRequest) => {
        const payloadDigest = await sha256Hex0x(stableJson(request.payload));
        return createEnvelope("oracle.seal.envelope", {
          purpose: request.purpose,
          recipient: request.recipient ?? "",
          payloadDigest,
        });
      }),
      {
        /** Oracle X25519 public key (TTL cache + stale fallback). */
        publicKey: (sealOptions?: { forceRefresh?: boolean }) =>
          oracleExt().seal.publicKey(sealOptions),
        /** Encrypt a payload under the pinned envelope algorithm. */
        encrypt: (payload: unknown) => oracleExt().seal.encrypt(payload),
        /**
         * Submit a sealed envelope to the confidential store. Unlike the
         * wallet-free publicKey/encrypt read/compute lanes, `store` WRITES
         * to the oracle's confidential store, so it is guest-guarded like
         * every other oracle write entry point — a DOCUMENTED exemption
         * from the "oracle:request" gate (named GUEST_GUARD_ONLY policy).
         */
        store: guardedWrite(guards, GUEST_GUARD_ONLY, async (input: FrameworkSealStoreInput) =>
          oracleExt().seal.store(input),
        ),
      },
    ),
    /** DataFeed reader (S13): wallet-free price reads + freshness math. */
    get dataFeed() {
      return oracleExt().dataFeed;
    },
    dispatch: guardedWrite(
      guards,
      ORACLE_REQUEST,
      async (
        envelope: OracleEnvelope,
        spec: Omit<FrameworkWriteSpec & FrameworkInvokeOptions, "args"> & {
          args?: FrameworkContractArg[];
        },
      ) =>
        deps.write({
          ...spec,
          args: [
            ...(spec.args ?? []),
            { type: "String", value: JSON.stringify(envelope.payload) },
          ],
        }),
    ),
  };
}
