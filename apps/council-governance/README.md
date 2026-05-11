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
| neo-n3-mainnet | ✅ Deployed     | `0xc7e50e67589df63302cbea1a6b00beb649ee74d8` |
| neo-n3-testnet | ✅ Deployed     | `0x4c61e5575ae9e151027f6724d07fac127d4cc25f` |

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
   After deployment, add the contract address to the app manifest and any host-side registry that mirrors deployment state:

   ```javascript
   MiniAppCouncilGovernance: "0x...", // Add deployed address
   ```

3. **Sync addresses to neo-manifest.json**:

   ```bash
   node scripts/sync-contract-addresses.js
   ```

4. **Verify deployment**:
   - Check `neo-manifest.json` has the correct network-specific contract address
   - Test the miniapp in the host-app

## API Dependencies

The miniapp reads proposal state directly from the Council Governance contract.
If a wallet read provider is not available, the app falls back to the host
`/api/rpc/neo-read` proxy for read-only calls. Proposal creation and voting are
always wallet-signed contract invocations.

## Contract Methods

| Method                     | Description                        | Access       |
| -------------------------- | ---------------------------------- | ------------ |
| `getProposalCount()`       | Get total number of proposals      | Public       |
| `getProposalDetails(id)`   | Get proposal details and quorum    | Public       |
| `createProposal(...)`      | Create a new proposal              | Council Only |
| `vote(voter, id, support)` | Cast a vote                        | Council Only |
| `hasVoted(voter, id)`      | Check if user has voted            | Public       |
| `isCandidate(address)`     | Check if address is council member | Public       |
| `finalizeProposal(id)`     | Finalize an expired proposal       | Public       |
| `revokeProposal(owner, id)` | Revoke own proposal                | Creator      |

## Development

```bash
# Navigate to the miniapp directory
cd apps/council-governance

# Install dependencies
npm install

# Start development server
npm run dev
```

## Platform Integration

- Standalone dApp: `apps/council-governance/src/PlayArea.tsx` renders the full
  proposal workspace.
- Host/OneGate detail page: `platform/host-app/components/playarea/PlayAreaRegistry.tsx`
  maps `miniapp-council-governance` to a native council play area instead of the
  generic placeholder.
- Contract registry: `apps/shared/constants/rpc.ts` and
  `platform/host-app/lib/rpc-helpers.ts` include both mainnet and testnet
  Council Governance hashes.

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

1. **Identity Verification**: The app verifies if a connected wallet is a Neo Council member through `isCandidate`
2. **Proposal Management**: Council members create and manage governance proposals on-chain
3. **Voting Mechanism**: Each council member can cast one vote per proposal
4. **On-Chain Recording**: All votes and proposals are permanently recorded on Neo N3 blockchain
5. **Transparency**: Voting history and proposal details are publicly accessible
6. **Security**: Only verified council members can create proposals and vote

## License

MIT License - R3E Network
