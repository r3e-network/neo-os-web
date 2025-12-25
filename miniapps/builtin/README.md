# Builtin MiniApps

Builtin MiniApps are delivered via **Module Federation** from `platform/builtin-app`.
Each manifest uses `mf://builtin?app=<app_id>` to route the host to the federated
remote while keeping GAS-only / NEO-only policy enforcement intact.

## MiniApp Categories

### Gaming (8 apps)

| App            | Description               | Key Features                |
| -------------- | ------------------------- | --------------------------- |
| `lottery`      | Decentralized lottery     | VRF randomness, 95% payout  |
| `coin-flip`    | 50/50 coin flip           | Instant settlement          |
| `dice-game`    | Roll dice, win up to 6x   | Multiple bet options        |
| `scratch-card` | Instant win scratch cards | VRF reveals                 |
| `gas-spin`     | Lucky wheel with 8 tiers  | VRF prize selection         |
| `secret-poker` | TEE Texas Hold'em         | Hidden cards in TEE         |
| `fog-chess`    | Chess with fog of war     | TEE position hiding         |
| `nft-evolve`   | Dynamic pet evolution     | Time-based growth, 6 stages |

### DeFi (10 apps)

| App                 | Description                 | Key Features                |
| ------------------- | --------------------------- | --------------------------- |
| `prediction-market` | Bet on price movements      | Oracle-powered              |
| `flashloan`         | Instant borrow and repay    | 1 GAS flash loans           |
| `price-ticker`      | Query price feeds           | Read-only datafeed          |
| `price-predict`     | Binary price prediction     | 0.1% datafeed               |
| `micro-predict`     | 60-second predictions       | Ultra-fast settlement       |
| `turbo-options`     | 30s/60s binary options      | 0.1% datafeed, 1.85x payout |
| `il-guard`          | Impermanent loss protection | Auto-withdraw on threshold  |
| `ai-trader`         | Autonomous AI trading agent | TEE strategy, 24/7 trading  |
| `grid-bot`          | Automated grid trading      | Price-triggered orders      |
| `bridge-guardian`   | Cross-chain asset bridge    | SPV verification, TEE       |

### Governance (2 apps)

| App           | Description                 | Key Features                  |
| ------------- | --------------------------- | ----------------------------- |
| `secret-vote` | Privacy-preserving voting   | TEE vote encryption           |
| `gov-booster` | NEO governance optimization | Auto-compound, vote switching |

### Social (2 apps)

| App            | Description            | Key Features            |
| -------------- | ---------------------- | ----------------------- |
| `red-envelope` | Web3 lucky red packets | VRF random distribution |
| `gas-circle`   | Daily savings circle   | VRF lottery, automation |

### Security (1 app)

| App               | Description                 | Key Features       |
| ----------------- | --------------------------- | ------------------ |
| `guardian-policy` | Multi-sig security guardian | TEE-enforced rules |

## Platform Capabilities Used

| Capability         | Apps Using It                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **GAS Payments**   | All apps                                                                                                             |
| **VRF/RNG**        | lottery, coin-flip, dice-game, scratch-card, gas-spin, secret-poker, fog-chess, red-envelope, gas-circle, nft-evolve |
| **0.1% Datafeed**  | price-predict, micro-predict, turbo-options, il-guard, gov-booster, ai-trader, grid-bot, bridge-guardian             |
| **TEE Compute**    | secret-poker, fog-chess, secret-vote, guardian-policy, ai-trader, grid-bot, bridge-guardian                          |
| **Automation**     | gas-circle, il-guard, turbo-options, gov-booster, ai-trader, grid-bot, nft-evolve, bridge-guardian                   |
| **NEO Governance** | secret-vote, gov-booster                                                                                             |

## File Structure

Each MiniApp contains:

```
miniapps/builtin/<app-name>/
├── manifest.json    # App configuration and permissions
├── index.html       # Entry point with styles
├── app.js           # Application logic
└── README.md        # App-specific documentation
```

## Development

Static HTML bundles remain in each folder for iframe-based previews or CDN
distribution builds (exported by `scripts/export_host_miniapps.sh`).

### Running Locally

```bash
# Start the host app
cd platform/host-app && npm run dev

# Or serve static files
npx serve miniapps/builtin/<app-name>
```

### Registering New Apps

```bash
# Register all builtin apps to AppRegistry
go run scripts/register_builtin_miniapps.go
```
