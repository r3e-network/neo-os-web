/**
 * TransferService - Token transfer operations for miniapps.
 *
 * Provides a clean API for GAS/NEO/custom token transfers, including
 * the direct-prepaid GAS pattern that most miniapps use for payments.
 * All transfers emit EventBus events for cross-component reactivity.
 *
 * @example
 * ```ts
 * // Simple GAS transfer
 * const result = await services.transfer.transferGas("NXyz...", "1.5");
 *
 * // Prepaid GAS pattern (most common for miniapps)
 * const result = await services.transfer.prepayGas("100000000", "play_game");
 * ```
 */

import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { gasToBaseUnits, neoToInteger } from "../utils/amounts";
import type { ChainService, TxResult } from "./ChainService";
import { EventBus } from "./EventBus";

export class TransferService {
  private chain: ChainService;
  private events: EventBus;

  constructor(chain: ChainService, events: EventBus) {
    this.chain = chain;
    this.events = events;
  }

  /**
   * Transfer GAS to a recipient address.
   *
   * @param to - Recipient Neo N3 address
   * @param amount - Amount in GAS display units (e.g. "1.5" = 1.5 GAS)
   * @param memo - Optional data string attached to the transfer
   */
  async transferGas(to: string, amount: string, memo?: string): Promise<TxResult> {
    return this.transferToken(BLOCKCHAIN_CONSTANTS.GAS_HASH, to, amount, memo);
  }

  /**
   * Transfer NEO (indivisible) to a recipient address.
   *
   * @param to - Recipient Neo N3 address
   * @param amount - Whole number of NEO to transfer
   */
  async transferNeo(to: string, amount: number): Promise<TxResult> {
    return this.transferToken(BLOCKCHAIN_CONSTANTS.NEO_HASH, to, String(amount));
  }

  /**
   * Transfer any NEP-17 token to a recipient address.
   *
   * @param asset - Token script hash (e.g. GAS_HASH, NEO_HASH, or custom)
   * @param to - Recipient Neo N3 address
   * @param amount - Amount in display units (will be scaled for GAS)
   * @param memo - Optional data string attached to the transfer
   */
  async transferToken(asset: string, to: string, amount: string, memo?: string): Promise<TxResult> {
    const sender = await this.chain.ensureWallet();
    const scriptHash = this.resolveAssetHash(asset);
    const scaledAmount = this.scaleAmount(scriptHash, amount);

    const args = [
      { type: "Hash160" as const, value: sender },
      { type: "Hash160" as const, value: to },
      { type: "Integer" as const, value: scaledAmount },
      { type: "String" as const, value: memo ?? "" },
    ];

    const result = await this.chain.invoke("transfer", args, { scriptHash });

    // Emit balance changed for both sender and the asset
    this.events.emit(EventBus.BALANCE_CHANGED, {
      asset: scriptHash,
      address: sender,
    });

    return result;
  }

  /**
   * Direct-prepaid GAS pattern: transfer GAS to the miniapp's own contract
   * with an app-specific memo. This is the most common payment pattern.
   *
   * NOTE: Unlike transferGas() which takes display units (e.g. "1.5"),
   * this method takes base units (Fixed8) because it directly wraps
   * ChainService.invokeWithDirectPrepaidGas which expects base units.
   *
   * @param amount - Amount in base units (Fixed8, e.g. "100000000" = 1 GAS)
   * @param memo - Memo identifying the payment purpose (e.g. "play_game")
   * @param contractHash - Override the default contract hash
   */
  async prepayGas(amount: string, memo: string, contractHash?: string): Promise<TxResult> {
    const sender = await this.chain.ensureWallet();
    const target = contractHash ?? this.chain.contractAddress.value;

    if (!target) {
      throw new Error("Contract address not available for prepaid GAS transfer");
    }

    const args = [
      { type: "Hash160" as const, value: sender },
      { type: "Hash160" as const, value: target },
      { type: "Integer" as const, value: amount },
      { type: "String" as const, value: memo },
    ];

    const result = await this.chain.invoke("transfer", args, {
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    });

    this.events.emit(EventBus.BALANCE_CHANGED, {
      asset: "GAS",
      address: sender,
    });

    return result;
  }

  // -- Helpers --------------------------------------------------------------

  private resolveAssetHash(asset: string): string {
    if (asset === "NEO") return BLOCKCHAIN_CONSTANTS.NEO_HASH;
    if (asset === "GAS") return BLOCKCHAIN_CONSTANTS.GAS_HASH;
    return asset;
  }

  /**
   * Scale a display-unit amount to base units (Fixed8) for GAS.
   * NEO is indivisible, so it passes through as a whole integer.
   *
   * Display units are always numbers with optional decimals (e.g. "1.5", "100").
   * The caller is responsible for passing display units, not base units.
   *
   * Uses the canonical {@link gasToBaseUnits}/{@link neoToInteger} BigInt
   * helpers — float scaling (`amount * 1e8` then round) loses precision near
   * the 8-decimal limit (e.g. "99999999.99999999"). Both helpers return 0n for
   * any invalid / non-positive input; we throw on 0n so a malformed or
   * zero-value transfer is rejected before it reaches the chain.
   */
  private scaleAmount(scriptHash: string, amount: string): string {
    // NEO is indivisible — whole-integer token count, never scaled.
    const base =
      scriptHash === BLOCKCHAIN_CONSTANTS.NEO_HASH
        ? neoToInteger(amount)
        : gasToBaseUnits(amount);
    if (base === 0n) {
      throw new Error(`Invalid transfer amount: ${amount}`);
    }
    return base.toString();
  }
}
