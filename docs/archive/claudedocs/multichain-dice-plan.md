# Multi-chain miniapp OS — Neo N3 + Neo X (dice exemplar)

Goal: dice-game works on both Neo N3 and Neo X, auto-detecting the chain from the
connected wallet; the OS `ctx.services.chain` abstraction becomes multi-chain.

## Backend (DONE + validated on Neo X mainnet)
- `MiniAppDiceGameEVM` @ `0xFA795F814d38F218153d21838360096f3F5cb774` (neo-os-services/contracts-evm):
  payable `placeBet(uint8 face)` → escrows stake, requests VRF from `MorpheusOracleEVM`
  (`0xeCFC1C65…`) via `requestFromCallback`, settles in `onOracleResult` (win 5.7x from
  bankroll, loss keeps stake, VRF-fail refunds). `settleFromKernel(id)` = trustless recovery.
  Registered (app "dice", granted random.generate), bankroll funded 12 GAS.
- Relayer (multi-chain, already live) fulfils Neo X VRF; gas-buffer fix (2x estimate) so the
  nested callback isn't starved by the 63/64 rule. Validated: bets settle on-chain.

## Frontend (OS) — the work
Current state: 100% Neo N3 NeoVM, **zero EVM wallet support** (no window.ethereum/ethers).
There is a `chainType` observable in `apps/shared/utils/wallet-sdk.ts` used only for validation.

### Files to change
1. **dep**: add `ethers@^6` to `apps/shared/package.json`.
2. **`apps/shared/utils/evm-chain.ts`** (NEW, self-contained): EIP-1193 via `window.ethereum`
   + ethers. `detectEvmNetwork()` (chainId 47763→neo-x-mainnet, 12227332→neo-x-testnet),
   `connectEvm()`, `ensureNeoX(network)` (wallet_switchEthereumChain/addEthereumChain),
   `evmInvokeWithValue({address,abi,method,args,valueWei,waitEvent})` → {txid,event} (parse
   receipt logs), `evmRead({address,abi,method,args})`.
3. **`apps/shared/utils/chain.ts`**: add `evmNetworkFromChainId(chainId)` + keep `isEvmChain`.
4. **`apps/shared/services/ChainService.ts`**: add `get network()` (exposes chainType);
   route `ensureWallet` / `invokeWithPayment` / `read` to evm-chain when `isEvmChain(network)`.
   `InvokeOptions` gains optional `evmAbi` + `evmValueWei` so the EVM branch can encode.
5. **`apps/shared/utils/wallet-sdk.ts`**: in `useWallet`, detect injected EVM provider; when the
   active chain is Neo X, set `chainType`/`chainId` to `evm-neo-x[-testnet]` and expose address.
   (Additive — Neo N3 dAPI path unchanged; only activates when wallet is on Neo X.)
6. **`apps/dice-game/src/manifest.ts`** + **`neo-manifest.json`**: add `neo-x-mainnet` /
   `neo-x-testnet` contract addresses (`0xFA795F81…`) alongside the Neo N3 hashes.
7. **`apps/dice-game/src/main.tsx`** (`placeDiceBet`): read `ctx.services.chain.network`; on
   Neo X, call `invokeWithPayment(stakeWei, memo, "placeBet", [{type:"uint8",value:face}],
   {evmAbi: DICE_ABI, evmValueWei: stakeWei, waitForEvent:"DiceBetPlaced"})`; else the
   existing Neo N3 path. Same UI/state.

### Auto-detection UX
`ctx.services.chain.network` reflects the connected wallet's chain. The dice handler picks the
contract + encoding by network. A chain-switch prompt (`ensureNeoX`) fires if the user is on an
unsupported EVM chain.

### Verification
- `tsc`/vite build of the platform + dice app; existing Vitest suites (no Neo N3 regression).
- Browser e2e (MetaMask on Neo X) is the only way to fully validate the wallet path — cannot be
  done headlessly; document a manual test script.

### Risk / scope notes
- Neo N3 path is untouched unless the wallet is on Neo X (zero-regression by construction).
- OS service proxies (`ctx.os.*` storage/payment/game) remain Neo N3 only — dice uses
  `ctx.services.chain` directly, so it does not need them. Other apps that use `ctx.os.*` stay
  Neo N3 until those proxies are ported (separate, larger initiative).
