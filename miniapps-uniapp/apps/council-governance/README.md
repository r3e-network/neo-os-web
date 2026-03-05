# Council Governance MiniApp

Decentralized governance for Neo Council members. Only top 21 committee members can create and vote on proposals.

## Features

- **Council Member Validation**: Validates if connected wallet is a council member
- **Proposal Creation**: Council members can create text or policy change proposals
- **Voting**: Council members can vote for or against proposals
- **Proposal Management**: View active proposals, history, and vote status

## Supported Networks

- Neo N3 Mainnet
- Neo N3 Testnet

## Contract Deployment Status

| Network        | Status          | Address                                      |
| -------------- | --------------- | -------------------------------------------- |
| neo-n3-mainnet | ❌ Not Deployed | -                                            |
| neo-n3-testnet | ✅ Deployed     | `0xab120f4586e5691e909aae23d36e73dc5395e6a1` |

## Deployment Requirements

### Prerequisites

1. **Compiled Contract**: The contract is already compiled at `contracts/build/MiniAppCouncilGovernance.nef`
2. **Deployer Wallet**: A Neo wallet with sufficient GAS for deployment
3. **RPC Endpoint**: Access to Neo N3 testnet/mainnet RPC

### Deployment Steps

1. **Deploy the contract**:

   ```bash
   # Set environment variables
   export NEO_TESTNET_WIF="your-wallet-wif"
   export NEO_RPC_URL="https://testnet1.neo.coz.io:443"

   # Run deployment script
   go run scripts/deploy_miniapp_contracts.go
   ```

2. **Update contract addresses**:
   After deployment, add the contract address to `scripts/sync-contract-addresses.js`:

   ```javascript
   MiniAppCouncilGovernance: "0x...", // Add deployed address
   ```

3. **Sync addresses to neo-manifest.json**:

   ```bash
   node scripts/sync-contract-addresses.js
   ```

4. **Verify deployment**:
   - Check `neo-manifest.json` has the correct contract address
   - Test the miniapp in the host-app

## API Dependencies

The miniapp uses the following API endpoint for council member validation:

- `GET /api/neo/council-members?chain_id={chain_id}&address={address}`
  - Returns `{ isCouncilMember: boolean, chainId: string }`

## Contract Methods

| Method                     | Description                        | Access       |
| -------------------------- | ---------------------------------- | ------------ |
| `GetProposalCount()`       | Get total number of proposals      | Public       |
| `GetProposal(id)`          | Get proposal details               | Public       |
| `CreateProposal(...)`      | Create a new proposal              | Council Only |
| `Vote(voter, id, support)` | Cast a vote                        | Council Only |
| `HasVoted(voter, id)`      | Check if user has voted            | Public       |
| `IsCandidate(address)`     | Check if address is council member | Public       |

## Development

```bash
# Navigate to the miniapp directory
cd miniapps-uniapp/apps/council-governance

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Files Modified for Multi-Chain Support

- `src/pages/index/index.vue`: Updated to use `chain_id` parameter for API calls

## Usage

### For Council Members

1. **Connect Wallet**: Link your Neo wallet that is registered as a council member
2. **View Proposals**: Browse active proposals requiring council votes
3. **Create Proposal**: Submit new text or policy change proposals for council review
4. **Cast Vote**: Vote For or Against proposals within the voting period
5. **View Results**: Monitor proposal status and vote tallies in real-time

### Proposal Lifecycle

1. A council member creates a proposal with title, description, and type
2. Other council members review and cast their votes during the active period
3. Once voting ends, the proposal status is finalized based on vote results
4. Approved policy changes can be implemented according to Neo governance rules

## How It Works

Council Governance provides decentralized decision-making for Neo Council members:

1. **Identity Verification**: The app verifies if a connected wallet is a Neo Council member via API
2. **Proposal Management**: Council members create and manage governance proposals on-chain
3. **Voting Mechanism**: Each council member can cast one vote per proposal
4. **On-Chain Recording**: All votes and proposals are permanently recorded on Neo N3 blockchain
5. **Transparency**: Voting history and proposal details are publicly accessible
6. **Security**: Only verified council members can create proposals and vote

## License

MIT License - R3E Network
