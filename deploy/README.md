# MiniApp Platform Contract Deployment

This directory contains deployment scripts and configuration for the **Neo MiniApp Platform** contracts.

## Quick Start (Neo Express)

```bash
# 1. Setup environment (create wallets, build contracts)
make setup

# 2. Start Neo Express in another terminal
make run-neoexpress

# 3. Deploy all contracts
make deploy

# 4. Initialize contracts (register TEE, set fees, etc.)
make init

# 5. Run Go integration tests (neo-express)
make test-go
```

Or run everything at once:

```bash
make all
```

## Directory Structure

```
deploy/
├── Makefile                    # Main entry point
├── config/
│   ├── default.neo-express     # Neo Express config (auto-generated)
│   ├── deployed_contracts.json # Deployed contract addresses
│   └── testnet.json           # TestNet configuration
├── scripts/
│   ├── setup_neoexpress.sh    # Setup Neo Express environment
│   ├── deploy_all.sh          # Deploy contracts
│   ├── sync_deployed_contracts.sh # Sync deployed hashes from Neo Express
│   ├── initialize.py          # Initialize deployed contracts
│   └── (tests live under ./test/contract)
└── wallets/
    ├── owner.json             # Admin wallet
    ├── tee.json               # TEE wallet
    └── user.json              # Test user wallet
```

## Dependencies

Install required tools:

```bash
# Neo Express (local blockchain)
dotnet tool install -g Neo.Express

# Neo Contract Compiler
dotnet tool install -g Neo.Compiler.CSharp

# Python 3 (for scripts)
# Usually pre-installed on Linux

# Check all dependencies
make check-deps
```

## Deployment Targets

### Neo Express (Local Development)

```bash
# Full setup and deployment
make all NETWORK=neoexpress

# Or step by step:
make setup
make build
make deploy
make init
```

If a contract is already deployed (present in `deploy/config/deployed_contracts.json`),
`deploy_all.sh` will **update** it in-place instead of redeploying. This preserves
storage and avoids losing on-chain state.
Keep `deployed_contracts.json` under version control or back it up so update
targets remain available.

If Neo Express already has contracts deployed but `deployed_contracts.json` is
missing or incomplete, sync the hashes from the chain:

```bash
./deploy/scripts/sync_deployed_contracts.sh
```

### TestNet

1. Set environment variables:

```bash
export TESTNET_OWNER_WALLET=/path/to/owner.json
export TESTNET_OWNER_ADDRESS=<neo-n3-owner-address>
export TESTNET_TEE_WALLET=/path/to/tee.json
export TESTNET_TEE_ADDRESS=<neo-n3-tee-address>
export TESTNET_TEE_PUBKEY=<33-byte-compressed-pubkey-hex>
```

2. Ensure wallets have GAS for deployment (~50 GAS recommended)

3. Deploy:

```bash
make build
make deploy NETWORK=testnet
make init NETWORK=testnet
```

If the contracts are already deployed on testnet, use `neo-go contract update`
with the existing hash instead of redeploying.

### Mainnet

1. Ensure the mainnet deployer wallet is available:

```bash
# Default wallet config path:
deploy/mainnet/wallets/wallet-config.yaml
```

2. Build + deploy:

```bash
make build
deploy/scripts/deploy_mainnet_contracts.py
```

Contract addresses are recorded in `deploy/config/mainnet_contracts.json`.

3. Set platform updaters (TEE signer) once you have the updater address:

```bash
export NEO_MAINNET_TEE_ADDRESS=<neo-n3-tee-address>
deploy/scripts/set_mainnet_updaters.sh
```

You can override the RPC endpoint with `NEO_MAINNET_RPC`.

## Contract Initialization

After deployment, contracts are initialized with:

1. **Updater Configuration (TEE signer)**
   - `PriceFeed.setUpdater(tee)`
   - `RandomnessLog.setUpdater(tee)`
   - `AutomationAnchor.setUpdater(tee)`
   - `ServiceLayerGateway.setUpdater(tee)`

In production, the updater should be the enclave-managed signer (GlobalSigner / TxProxy).

## Testing

### Run Go Integration Tests

```bash
make test-go
```

## neo-fairy-test Integration

This deployment system is designed to work with [neo-fairy-test](https://github.com/r3e-network/neo-fairy-test), a Foundry-style testing framework for Neo N3.

Key features used:

- **VirtualDeploy**: Deploy contracts in isolated test sessions
- **Session Snapshots**: Revert state between tests
- **Cheatcodes**: `Prank` (impersonate), `Deal` (set balance), `Warp` (set time)

This repo’s primary validation path is the Go integration tests under `test/contract`.
For ad-hoc Fairy deployments, use `go run ./cmd/deploy-fairy/main.go`.

## Deployed Contracts

After deployment, contract addresses are saved to `config/deployed_contracts.json`.

### Neo N3 Testnet (Live)

| Contract            | Address                              | Description                |
| ------------------- | ------------------------------------ | -------------------------- |
| PaymentHub          | `NZLGNdQUa5jQ2VC1r3MGoJFGm3BW8Kv81q` | GAS payments & settlement  |
| Governance          | `NLRGStjsRpN3bk71KNoKe74fNxUT72gfpe` | NEO voting & governance    |
| PriceFeed           | `NTdJ7XHZtYXSRXnWGxV6TcyxiSRCcjP4X1` | Price oracle anchoring     |
| RandomnessLog       | `NR9urKR3FZqAfvowx2fyWjtWHBpqLqrEPP` | Randomness anchoring       |
| AppRegistry         | `NXZNTXiPuBRHnEaKFV3tLHhitkbt3XmoWJ` | MiniApp registration       |
| AutomationAnchor    | `NcVrd4Z7W8sxv9jvdBF72xfiWBnvRsgVkx` | Task execution logs        |
| ServiceLayerGateway | `NTWh6auSz3nvBZSbXHbZz4ShwPhmpkC5Ad` | On-chain service callbacks |

**Network:** Neo N3 Testnet
**RPC:** `https://testnet1.neo.coz.io:443`
**Network Magic:** `894710606`

### Neo N3 Mainnet (Live)

| Contract            | Address                              | Description                |
| ------------------- | ------------------------------------ | -------------------------- |
| PaymentHub          | `NaqDPjXnYsm8W5V3xXuDUZe5W1HRLsMsx2` | GAS payments & settlement  |
| Governance          | `NMhpz6kT77SKaYwNHrkTv8QXpoPuSd3VJn` | NEO voting & governance    |
| PriceFeed           | `NPW7dXnqBUoQ3aoxg86wMsKbgt8VD2HhWQ` | Price oracle anchoring     |
| RandomnessLog       | `NPJXDzwaU8UDct7247oq3YhLxJKkJsmhaa` | Randomness anchoring       |
| AppRegistry         | `NYkvPQcFdnmhmB7uYss7rS9YppC3jFzmgJ` | MiniApp registration       |
| AutomationAnchor    | `NS9Y32DUzyQbmH9vEHDXP3JskbwdbDXGfm` | Task execution logs        |
| ServiceLayerGateway | `NfaEbVnKnUQSd4MhNXz9pY4Uire7EiZtai` | On-chain service callbacks |

**Network:** Neo N3 Mainnet
**RPC:** `https://mainnet1.neo.coz.io:443`
**Network Magic:** `860833102`

### Local Development (Neo Express)

```json
{
  "PaymentHub": "0x1234...",
  "Governance": "0xdef0...",
  "PriceFeed": "0xaaaa...",
  "RandomnessLog": "0xbbbb...",
  "AppRegistry": "0xcccc...",
  "AutomationAnchor": "0xdddd...",
  "ServiceLayerGateway": "0xeeee..."
}
```

## Troubleshooting

### "neoxp not found"

```bash
dotnet tool install -g Neo.Express
export PATH="$PATH:$HOME/.dotnet/tools"
```

### "nccs not found"

```bash
dotnet tool install -g Neo.Compiler.CSharp
```

### Contract deployment fails

- Ensure Neo Express is running: `make run-neoexpress`
- Check wallet has sufficient GAS
- Verify contract compiled successfully in `contracts/build/`

### Initialization fails

- Ensure contracts are deployed first
- Check `deployed_contracts.json` has valid contract addresses
