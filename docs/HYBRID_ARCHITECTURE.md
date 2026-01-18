# MiniApp Hybrid Architecture

## Overview

This document describes the hybrid on-chain/off-chain architecture implemented across MiniApp contracts. The goal is to minimize on-chain computation while maintaining security and verifiability.

## Core Principle

**On-chain handles only:**
1. Initial state (payment validation, seed generation, state initialization)
2. Final state (result verification, asset transfers, status records)

**Off-chain handles:**
- All intermediate calculations
- UI previews and simulations
- Complex business logic

## Refactoring Patterns

### Pattern 1: Frontend Calculation + Verification

Frontend calculates results using exposed constants, contract verifies and executes.

**Example: DailyCheckin**
```
Flow:
1. Frontend calls GetCheckInStateForFrontend() → gets streak, lastDay, constants
2. Frontend calculates: newStreak, reward, streakReset
3. Frontend calls CheckInWithCalculation(calculatedValues)
4. Contract verifies calculations match expected values
5. Contract updates state (final state only)
```

**Contracts using this pattern:**
- `MiniAppDailyCheckin.Hybrid.cs` - CheckInWithCalculation
- `MiniAppBurnLeague.Hybrid.cs` - BurnGasWithCalculation
- `MiniAppCompoundCapsule.Hybrid.cs` - UnlockCapsuleWithCalculation, EarlyWithdrawWithCalculation
- `MiniAppDoomsdayClock.Hybrid.cs` - BuyKeysWithCost

### Pattern 2: Two-Phase (Initiate/Settle)

Phase 1 generates deterministic seed, Phase 2 verifies frontend-calculated results.

**Example: RedEnvelope**
```
Flow:
1. InitiateEnvelope() → generates seed, stores pending envelope, returns [envelopeId, seed]
2. Frontend calculates packet distribution using seed
3. SettleEnvelope(envelopeId, calculatedAmounts) → verifies distribution, stores packets
```

**Contracts using this pattern:**
- `MiniAppRedEnvelope.Hybrid.cs` - InitiateEnvelope/SettleEnvelope
- `MiniAppLottery.Hybrid.cs` - BuyScratchTicketHybrid/RevealScratchWithCalculation
- `MiniAppLottery.Hybrid.cs` - StoreDrawRandomness/SettleRoundOptimized

### Pattern 3: O(1) Formula Replacement

Replace O(n) loops with O(1) mathematical formulas.

**Example: DoomsdayClock Key Cost**
```csharp
// Before: O(n) loop
for (i = 0; i < keyCount; i++) {
    totalCost += BASE_PRICE + (currentKeys + i) * INCREMENT;
}

// After: O(1) arithmetic sequence sum
BigInteger firstKeyPrice = BASE_PRICE + currentKeys * INCREMENT;
BigInteger totalCost = keyCount * firstKeyPrice + keyCount * (keyCount - 1) / 2 * INCREMENT;
```

### Pattern 4: Frontend Search + O(1) Verification

Frontend searches off-chain for eligible items, submits ID for O(1) verification.

**Example: TimeCapsule Fish**
```
Flow:
1. Frontend calls GetCapsuleFishStatus(id) for multiple capsules off-chain
2. Frontend finds fishable capsule (isPublic && !isRevealed && unlocked)
3. Frontend calls FishWithId(capsuleId)
4. Contract verifies capsule is fishable (O(1) check)
5. Contract processes fish action
```

**Contracts using this pattern:**
- `MiniAppTimeCapsule.Hybrid.cs` - FishWithId

### Pattern 5: RNG Callback + Deferred Settlement

RNG callback only stores randomness, frontend calculates selection, separate settle verifies.

**Example: NeoGacha RNG Flow**
```
Flow:
1. PlayMachine() → requests RNG from service
2. OnServiceCallbackHybrid() → stores randomness only (NO O(n) selection)
3. Frontend receives OnRngStored event with randomness
4. Frontend calculates: availableWeight, selectedIndex, cumulativeWeightBefore
5. SettlePlayWithRng(selectedIndex, cumulativeWeightBefore, availableWeight)
6. Contract verifies selection with O(1) range check
7. Contract executes transfer
```

**Contracts using this pattern:**
- `MiniAppNeoGacha.Hybrid.cs` - OnServiceCallbackHybrid/SettlePlayWithRng

### Pattern 6: Deterministic Seed + Frontend Calculation (Recommended for Games)

Contract generates deterministic seed, frontend calculates all game steps locally, contract verifies bounds and records final state.

**Example: TurtleMatch Blindbox Game**
```
Flow:
1. StartGame(boxCount) → payment validation + seed generation → emit GameStarted(seed)
2. Frontend receives seed from event
3. Frontend computes locally: open blindboxes → match colors → calculate rewards
4. Frontend displays animation to user
5. SettleGame(totalMatches, totalReward) → contract verifies bounds → pays reward
```

**Key Characteristics:**
- On-chain: Initial state (payment, seed) + Final state (results, payout)
- Off-chain (Frontend): ALL intermediate computation using deterministic seed
- No service callback needed - frontend is trusted for calculation
- Contract verifies results are within valid bounds (max matches, max reward)

**Security Model:**
- Seed is generated on-chain (unpredictable before transaction)
- Frontend calculation is deterministic (same seed = same results)
- Contract verifies bounds to prevent cheating (reward ≤ maxPossibleReward)
- Player can only settle their own session

**Contracts using this pattern:**
- `MiniAppTurtleMatch` - StartGame/SettleGame

## Refactored Contracts Summary

| Contract | Base Class | Method | Pattern | Status |
|----------|------------|--------|---------|--------|
| DailyCheckin | MiniAppServiceBase | CheckInWithCalculation | Frontend Calc | ✅ |
| BurnLeague | MiniAppServiceBase | BurnGasWithCalculation | Frontend Calc | ✅ |
| CompoundCapsule | MiniAppServiceBase | UnlockCapsuleWithCalculation | Frontend Calc | ✅ |
| CompoundCapsule | MiniAppServiceBase | EarlyWithdrawWithCalculation | Frontend Calc | ✅ |
| RedEnvelope | **MiniAppComputeBase** | InitiateEnvelope/SettleEnvelope | TEE Two-Phase | ✅ |
| Lottery | **MiniAppGameComputeBase** | BuyScratchTicketHybrid/RevealScratchWithCalculation | TEE Two-Phase | ✅ |
| Lottery | **MiniAppGameComputeBase** | SettleRoundOptimized | O(1) Verification | ✅ |
| DoomsdayClock | MiniAppGameBase | BuyKeysWithCost | Frontend Calc + O(1) | ✅ |
| DoomsdayClock | MiniAppGameBase | CalculateKeyCost | O(1) Arithmetic Formula | ✅ |
| NeoGacha | **MiniAppGameComputeBase** | InitiatePlayOptimized/SettlePlayOptimized | TEE Two-Phase + O(1) | ✅ |
| NeoGacha | **MiniAppGameComputeBase** | OnServiceCallbackHybrid/SettlePlayWithRng | RNG Callback + O(1) | ✅ |
| NeoGacha | **MiniAppGameComputeBase** | SetMachineActiveWithValidation | O(1) Spot Check | ✅ |
| MasqueradeDAO | MiniAppServiceBase | VoteWithCalculation | Cached Power O(1) | ✅ |
| MasqueradeDAO | MiniAppServiceBase | DelegateWithCacheUpdate | Cache Management | ✅ |
| CoinFlip | **MiniAppGameComputeBase** | InitiateBet/SettleBet | TEE Two-Phase | ✅ |
| OnChainTarot | **MiniAppComputeBase** | InitiateReading/SettleReading | TEE Two-Phase | ✅ |
| TimeCapsule | MiniAppServiceBase | FishWithId | Frontend Search + O(1) Verify | ✅ |
| TurtleMatch | **MiniAppGameComputeBase** | StartGame/SettleGame | Seed + Frontend Calc | ✅ |

## Contracts Not Requiring Refactoring

| Contract | Reason |
|----------|--------|
| DevTipping | All logic is O(1) threshold checks |
| Graveyard | Simple memorial storage |
| CandidateVote | Voting is direct state update |
| CouncilGovernance | Proposal/vote is direct state update |
| GardenOfNeo | All methods are O(1) calculations |
| OnChainTarot | Fixed-size card arrays (max 10 cards) |
| MillionPieceMap | Direct pixel ownership updates |
| ExFiles | Simple file record storage |
| FlashLoan | Single loan execution |
| HeritageTrust | Trust creation/claim is O(1) |
| GuardianPolicy | User methods are O(1), automation has bounded loops |
| SelfLoan | User methods are O(1), automation batch is bounded |
| GasSponsor | User methods are O(1), automation batch is bounded |
| BreakupContract | User methods are O(1), automation batch is bounded |

## Implementation Guidelines

### For Frontend Developers

1. **Always fetch state before calculation**
   ```typescript
   const state = await contract.GetXxxStateForFrontend(params);
   const calculated = calculateLocally(state);
   await contract.XxxWithCalculation(calculated);
   ```

2. **Use exposed constants**
   ```typescript
   const constants = await contract.GetCalculationConstants();
   // Use constants.tierXApyBps, constants.feeRate, etc.
   ```

3. **Handle verification failures gracefully**
   - "mismatch" errors indicate stale state
   - Refetch state and recalculate

### For Contract Developers

1. **Expose all calculation constants**
   ```csharp
   [Safe]
   public static Map<string, object> GetCalculationConstants() { ... }
   ```

2. **Return raw data, not derived values**
   ```csharp
   // Good: return raw timestamps
   state["unlockTime"] = capsule.UnlockTime;
   state["currentTime"] = Runtime.Time;

   // Bad: return calculated status
   state["status"] = capsule.UnlockTime > Runtime.Time ? "locked" : "unlocked";
   ```

3. **Verify before execute**
   ```csharp
   ExecutionEngine.Assert(calculatedValue == expectedValue, "mismatch");
   // Only after verification, update state
   ```

## TEE Script Registration & Verification

### Overview

For contracts requiring off-chain computation in a Trusted Execution Environment (TEE), we implement a **script registration mechanism** that ensures only authorized, verified scripts can be used for calculations.

### Base Classes

The inheritance hierarchy for hybrid compute contracts:

```
MiniAppBase
  └── MiniAppServiceBase
        └── MiniAppComputeBase          (for non-game apps with TEE compute)
              └── MiniAppGameComputeBase (for games with TEE compute + bet limits)
```

**Storage Prefix Layout:**
- `0x00-0x0F`: MiniAppBase (admin, gateway, pause)
- `0x10-0x17`: MiniAppGameBase (bet limits, player stats)
- `0x18-0x1B`: MiniAppServiceBase (service config)
- `0x20-0x2F`: MiniAppComputeBase (script registry, operation seeds)
- `0x30-0x3F`: MiniAppGameComputeBase (game-specific compute)
- `0x40+`: App-specific prefixes
- `0x50+`: Hybrid mode prefixes

### Script Registration Flow

```
Admin Flow:
1. Admin deploys TEE script to NeoCompute service
2. Admin calls RegisterScript(scriptName, scriptHash) on contract
3. Contract stores SHA256 hash of script content
4. Admin calls EnableScript(scriptName) to activate

Runtime Flow:
1. InitiateXxx() checks IsScriptEnabled(scriptName)
2. InitiateXxx() calls GenerateOperationSeed(operationId, user, scriptName)
3. Returns [operationId, seed, scriptName] to frontend
4. Frontend calls TEE compute-verified endpoint with seed + script
5. TEE verifies script hash matches on-chain registration
6. TEE executes script, returns result + verification info
7. Frontend calls SettleXxx() with result + scriptHash
8. Contract calls ValidateScriptHash(scriptName, scriptHash)
9. Contract verifies result using stored seed from GetOperationSeed()
10. Contract calls DeleteOperationSeed() after successful settlement
```

### MiniAppComputeBase Methods

```csharp
// Script Registration (Admin only)
public static void RegisterScript(string scriptName, ByteString scriptHash)
public static void EnableScript(string scriptName)
public static void DisableScript(string scriptName)

// Script Queries
[Safe] public static bool IsScriptEnabled(string scriptName)
[Safe] public static ByteString GetScriptHash(string scriptName)

// Operation Seed Management
protected static ByteString GenerateOperationSeed(BigInteger operationId, UInt160 user, string scriptName)
protected static ByteString GetOperationSeed(BigInteger operationId)
protected static void DeleteOperationSeed(BigInteger operationId)

// Verification
protected static void ValidateScriptHash(string scriptName, ByteString providedHash)
```

### Pattern 7: TEE-Verified Two-Phase (Recommended for Complex Calculations)

For calculations too complex for frontend verification, use TEE with script hash verification.

**Example: OnChainTarot Reading**
```
Flow:
1. InitiateReading() → validates payment, generates seed, returns [readingId, seed, scriptName]
2. Frontend calls TEE compute-verified endpoint:
   POST /compute-verified
   {
     "app_id": "on-chain-tarot",
     "contract_hash": "0x...",
     "script_name": "calculate-cards",
     "seed": "...",
     "input": { "cardCount": 3 }
   }
3. TEE verifies script hash against on-chain registration
4. TEE executes script in secure enclave
5. TEE returns:
   {
     "result": { "cards": [12, 45, 78], "cardDetails": [...] },
     "verification": { "script_hash": "...", "attestation": "..." }
   }
6. Frontend calls SettleReading(readingId, cards, scriptHash)
7. Contract validates scriptHash matches registered hash
8. Contract verifies cards using stored seed
9. Contract stores reading result
```

**Contracts using this pattern:**
- `MiniAppOnChainTarot` - InitiateReading/SettleReading
- `MiniAppCoinFlip` - InitiateBet/SettleBet
- `MiniAppLottery` - InitiateRound/SettleRound
- `MiniAppNeoGacha` - InitiatePlayOptimized/SettlePlayOptimized
- `MiniAppRedEnvelope` - InitiateEnvelope/SettleEnvelope

### Frontend Integration

```typescript
import { useHybridCompute } from '@/composables/useHybridCompute';

const { executeHybrid } = useHybridCompute();

const result = await executeHybrid<InitResult, ComputeResult, SettleResult>(
  // Phase 1: Initiate on-chain
  async () => {
    const tx = await invokeContract({
      operation: "InitiateXxx",
      args: [...]
    });
    const event = await waitForEvent(tx.txid, "XxxInitiated");
    return { operationId, seed, scriptName };
  },

  // Get compute params
  (initResult) => ({
    app_id: "my-app",
    contract_hash: contractHash,
    script_name: initResult.scriptName,
    seed: initResult.seed,
    input: { ... }
  }),

  // Phase 3: Settle on-chain with script hash
  async (initResult, computeResult) => {
    const scriptHash = computeResult._verification?.script_hash || "";
    await invokeContract({
      operation: "SettleXxx",
      args: [
        { type: "Integer", value: initResult.operationId },
        { type: "Array", value: computeResult.items },
        { type: "ByteArray", value: scriptHash }  // Script hash verification
      ]
    });
  },

  authToken
);
```

### Edge Function: compute-verified

The `compute-verified` Edge function handles TEE script execution:

```typescript
// POST /compute-verified
interface ComputeVerifiedRequest {
  app_id: string;
  contract_hash: string;
  script_name: string;
  seed: string;
  input: Record<string, unknown>;
}

interface ComputeVerifiedResponse {
  result: unknown;
  verification: {
    script_hash: string;
    attestation?: string;
    timestamp: number;
  };
}
```

**Verification Steps:**
1. Load script from NeoCompute registry
2. Compute SHA256 hash of script content
3. Query on-chain `GetScriptHash(scriptName)`
4. Assert hashes match
5. Execute script in TEE with seed + input
6. Return result with verification metadata

## Security Considerations

1. **Seed Generation**: Seeds must include unpredictable on-chain data
   - Block time, executing script hash, transaction-specific data
   - Never use only user-provided data

2. **Verification**: Contract MUST verify all frontend calculations
   - Never trust frontend values without verification
   - Use Assert for all verification checks

3. **State Consistency**: Check state hasn't changed between phases
   - Store seeds/pending state in Phase 1
   - Verify state matches in Phase 2

4. **Script Hash Verification**: For TEE-computed results
   - Admin registers script hash on-chain before use
   - TEE verifies script hash before execution
   - Contract validates script hash in settle phase
   - Prevents unauthorized script substitution

## Deprecated Methods

The following legacy methods have O(n) loops and are marked `[DEPRECATED]`:

| Contract | Method | Issue | Replacement |
|----------|--------|-------|-------------|
| NeoGacha | `OnServiceCallback` | O(n) weighted selection | `OnServiceCallbackHybrid` + `SettlePlayWithRng` |
| NeoGacha | `GetAvailableWeight` | O(n) item iteration | Frontend calculation |
| NeoGacha | `CalculateExpectedSelection` | O(n) item iteration | `VerifySelectionO1` |
| NeoGacha | `SetMachineActive` | O(n) item validation | `SetMachineActiveWithValidation` |
| Lottery | `SelectWinner` | O(n) participant iteration | `SettleRoundOptimized` |
| Lottery | `GetPlayerUnrevealedTickets` | O(2n) two-pass | Frontend filtering |
| Lottery | `GetRoundParticipantsForFrontend` | O(n) participant loop | Edge function query |
| RedEnvelope | `OnServiceCallback` | O(n) packet storage | `InitiateEnvelope` + `SettleEnvelopeLazy` |
| RedEnvelope | `SettleEnvelope` | O(n) verification + storage | `SettleEnvelopeLazy` (on-demand) |
| RedEnvelope | `VerifyDistribution` | O(n) verification loop | O(1) single-packet verification |
| RedEnvelope | `PreviewDistribution` | O(n) distribution loop | Frontend/edge function |
| MasqueradeDAO | `GetEffectiveVotingPower` | O(n) delegation search | `GetCachedDelegatedPower` |
| TimeCapsule | `Fish` | O(n) capsule search | `FishWithId` |

**Note**: Deprecated methods are kept for backward compatibility but should not be used in new integrations.
