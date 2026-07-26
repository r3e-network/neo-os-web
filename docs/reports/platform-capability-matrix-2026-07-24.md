# Platform Capability Matrix — 2026-07-24

## Scope

This matrix separates three states that must not be conflated:

1. **Platform source capability** — a multi-tenant contract and framework surface exist locally.
2. **Consumer readiness** — at least one miniapp route and focused regression exercise the surface.
3. **Live adoption** — the exact artifact, Registry binding, funded lifecycle, and read-back are proven on testnet.

The current evidence is credential-free and read-only on testnet. No WIF was read or used, and no signed transaction or chain write is part of this matrix.

## Current matrix

| Domain | Platform contract / shared service | Tenant model | Framework surface | Consumer evidence | Live boundary | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Directory and app identity | `PlatformRegistry` + UnifiedSmartWallet V3 integration | `appId` directory row plus stable V2 `(core, accountId)` virtual account | `app.registry`, `app.platformAccount` | Registry/AA source and runtime tests; stable id survives pre-materialization app-admin rotation; 77/77 predicted unique roster entries | Live Registry/AA lack the stable reciprocal shared-AA ABI; 0/77 identities materialized | P0 bootstrap |
| Optional treasury custody | `AppAccount` | One deployed shim per opted-in app | `app.platformAccount` snapshot and treasury lane | Source/build accepted; artifact checksum matches retained testnet artifact | Optional lane only; no shim materialized | P1 demand-gated |
| Games and rewards | `PlatformGame` | `appId` game, credit, pool, and descriptor state | `app.platformGame`, `app.game.reward` adapter | 11 migrated local routes; framework ABI and model tests | 0/11 funded-complete; live adoption must follow exact artifact and settle proof | P0 migration |
| Social payments | `PlatformSocial` | `appId` plus payer credits, tenant/global liabilities | `app.platformSocial` | 36/36 local ABI surface; Notary, Envelope, RangePool, Trust, Vault lanes | No deployment record; no production binding | P1 deployment |
| Anchoring and staking | `PlatformAnchor` | `appId` anchor records, NEO stake accounting, and `(appId,payer)` NEO/GAS credit liabilities | `app.platformAnchor` | 38/38 local ABI surface; TrustAnchor/ProfitAnchor routes | Live artifact drift and ABI removal gap | P1 compatibility |
| DeFi lending/capsules/flash | `PlatformDeFi` v1.3 | `(appId,payer)` NEO/GAS credits and per-tenant liabilities | `app.platformDeFi` | 58/58 local ABI surface; SelfLoan profile and solvency tests | Live artifact drift; zero shared bindings; fresh deployment preferred over legacy recovery | P1 redeploy |
| Vesting and streams | `PlatformVesting` | `(appId,asset,payer)` credits and stream liabilities | `app.platformVesting` | NeoPay compatibility route; 13/13 framework ABI | No deployment, Registry binding, funded lifecycle, or migration read-back | P1 deployment |
| Conditional release | `PlatformEscrow` | `(appId,asset,payer)` credits, milestones, tenant/global liabilities | `app.platformEscrow` | `milestone-escrow` compatibility route; 17/17 framework ABI | No deployment, Registry binding, funded lifecycle, or migration read-back | P1 deployment |
| Artifact/template deployment | `MiniAppFactory` | Template and deployment records keyed by package/digest | `app.platformFactory` | Asset Factory, NFT Factory, and MiniApp Factory guarded routes | Live Factory lacks `deployArtifactFromTemplate`; no full funded lifecycle certification | P1 ABI upgrade |
| Native credits/payments | `MiniAppCredits` and per-engine native credit lanes | Mostly payer-global or engine-specific; not one universal tenant engine | Existing app-specific/framework payment helpers | Multiple standalone consumers and native prepayment tests | Not yet a unified platform ledger; do not claim it as one | P2 consolidation |
| Oracle/private compute | Morpheus Oracle / DataFeed / TEE runtime | External service and app request context | `app.oracle`, `app.game.reward` | Three-repository local gates and engine sync | Local proof does not establish deployed Nitro/relayer/control-plane health | P0 operations |
| Governance/voting | `CouncilGovernance` standalone contract | Single-app governance state | App-specific composable only | Local app and production-safety tests | No shared tenant governance engine | P2 demand-gated |
| NFT/ticket/SBT | `MiniAppEventTicketPass`, `MiniAppSoulboundCertificate` | Standalone app contracts | App-specific routes | Local standalone contracts and UI flows | No shared ticket/NFT platform surface | P2 demand-gated |
| Randomness/VRF | `MiniAppTarotVrf` pattern | Standalone oracle/signer path | App-specific | Local pattern compiled | VRF signer operations are not proven live; no shared RandomnessLane | P2 operations-gated |
| AMM/swap, prediction, subscriptions, DID registry, NNS | External or standalone lanes | No common tenant model | No shared surface | Product-specific code or explicit non-goal | Deliberately uncovered; do not represent as platform coverage | P3 explicit decision |

## Design conclusions

- The reusable platform kernel is now the combination of `PlatformRegistry`, shared-AA identity, `MiniAppEngineBase`, appId-first tenant ABI, native credit/liability accounting, pause-immune exits, and one framework surface per engine.
- The source conformance audit is now reproducible via `npm run -s audit:platform:engine-base`: `PlatformGame`, `PlatformVesting`, and `PlatformEscrow` adopt the base; `PlatformSocial`, `PlatformDeFi`, and `PlatformAnchor` retain ABI-compatible wrappers over the shared `MiniAppStorageKeys` algorithm. All six engines now pass the source conformance invariants, including Anchor's app-scoped credit-liability lane.
- `manifest.platformBindings` is the correct additive frontend composition layer: it lets one app consume several platform engines while retaining a custom primary contract. Legacy `contract.mode=shared` remains a compatibility lane.
- A standalone contract is not automatically a platform contract. It becomes a platform candidate only after tenant isolation, registry binding, framework routing, acceptance tests, and a named first consumer are present.
- The next safe expansion should be demand-led. Governance and NFT/ticketing have existing consumers, but neither should be called covered until a shared tenant model and framework surface are implemented. Randomness remains gated on real Morpheus signer operations; AMM and pull-subscription primitives require separate product decisions.

## Current verification snapshot

- Local platform acceptance: **9/9** platform contracts source/build/test accepted; **2/9** retained testnet artifacts match current local artifacts; **4/9** drift; **3/9** have no deployment record.
- Framework: **50/50 files, 619/619 tests**; standard reward-game difficulty selection is shared across **11/11** compatible games, with game-specific rule semantics preserved.
- Shared React runtime: **398/398 files, 4446/4446 tests**.
- Manifest/wallet focused regression: **13/13 tests**, plus platform composition **2/2**.
- Abstract-account live state: **0/77** identities materialized; live reciprocal ABI remains incomplete, and the local stable V2 derivation requires a coordinated AA then Registry upgrade.
- Chain writes: **0**; WIF: **not read or used**.
- Engine-base conformance: **3/6** base adopters, **0** duplicate storage algorithms, and **0** missing capability findings; `PlatformGame` now consumes the canonical `AppKey` kit, while `PlatformAnchor` and `PlatformSocial` lock their external transfer paths and Anchor records app-scoped credit liabilities.
