# Neo MiniApps (UniApp)

Canonical source for all Neo N3 MiniApp frontends built with UniApp + Vue 3.

## Structure

```
miniapps-uniapp/
├── apps/                    # 62 MiniApp applications
│   ├── lottery/
│   │   └── src/
│   │       ├── pages/       # Vue components
│   │       ├── static/      # Assets (icon.svg, banner.svg)
│   │       ├── shared/      # Shared styles/utils
│   │       ├── App.vue
│   │       ├── main.ts
│   │       ├── manifest.json
│   │       └── pages.json
│   └── ...
├── packages/
│   └── @neo/uniapp-sdk/     # SDK with Vue composables
└── shared/                  # Cross-app shared resources
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Dev single app
cd apps/lottery && pnpm dev

# Build all apps
pnpm build:all
```

## SDK Usage

```vue
<script setup lang="ts">
import { useWallet, usePayments, useRNG } from "@neo/uniapp-sdk";

const { address, connect } = useWallet();
const { payGAS } = usePayments();
const { requestRandom } = useRNG();
</script>
```

## Apps (62)

| Category   | Apps                                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gaming     | lottery, coin-flip, dice-game, scratch-card, neo-crash, secret-poker, fog-chess, fog-puzzle, algo-battle, candle-wars, crypto-riddle, puzzle-mining, on-chain-tarot, scream-to-earn, bounty-hunter, world-piano |
| DeFi       | flashloan, grid-bot, il-guard, compound-capsule, no-loss-lottery, self-loan, dark-pool, quantum-swap, price-ticker, dutch-auction, gas-circle, neoburger                                                        |
| Social     | red-envelope, dev-tipping, whisper-chain, dark-radio, ex-files, geo-spotlight, breakup-contract, million-piece-map                                                                                              |
| NFT        | nft-evolve, nft-chimera, schrodinger-nft, melting-asset, parasite, canvas, garden-of-neo                                                                                                                        |
| Governance | secret-vote, gov-booster, gov-merc, masquerade-dao, candidate-vote, burn-league                                                                                                                                 |
| Utility    | time-capsule, heritage-trust, dead-switch, guardian-policy, bridge-guardian, unbreakable-vault, zk-badge, pay-to-view, graveyard, doomsday-clock, ai-trader, ai-soulmate, prediction-market                     |
