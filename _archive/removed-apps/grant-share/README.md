# GrantShare 资助分享

Create and fund community grants, share resources with transparent on-chain tracking

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-grant-share` |
| **Category** | Social |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Community funding with transparent milestone tracking

GrantShares provides community funding for Neo ecosystem projects. This miniapp surfaces the latest proposals and their status; browse, discuss, and track GrantShares proposals directly from your wallet.

## Features

- **📋 Proposal Browsing**: View all active and past GrantShares proposals in one place
- **🏷️ Status Tracking**: Monitor proposal states including Active, Review, Voting, Executed, and more
- **📊 Voting Statistics**: See real-time vote counts (for/against) for each proposal
- **💬 Community Engagement**: Access discussion links for full proposal context
- **📈 Grant Pool Stats**: Overview of total proposals and active projects
- **🔗 Easy Sharing**: Copy discussion links to share with community members
- **🌿 Eco Theme**: Modern, nature-inspired interface design

## Usage

### Getting Started

1. **Launch the App**: Open GrantShare from your Neo MiniApp dashboard
2. **Connect Wallet** (optional): Connect your Neo wallet for full functionality
3. **Browse Proposals**: View the list of community funding proposals

### Exploring Proposals

**Grants Tab:**
1. Scroll through the list of active proposals
2. Each card displays:
   - Proposal title
   - Proposer address
   - Current status badge
   - Vote counts (for/against)
   - Comment count
   - Creation date
3. Tap any proposal card to view detailed information
4. Click "Copy Discussion Link" to share the proposal

**Stats Tab:**
1. View grant pool overview statistics:
   - Total number of proposals
   - Number of active projects
   - Currently displayed proposals count
2. Monitor ecosystem funding activity

**Documentation Tab:**
1. Learn about the GrantShares platform
2. Understand how community funding works
3. Discover how to participate in governance

### Understanding Proposal Statuses

| Status | Description |
|--------|-------------|
| **Active** | Proposal is currently open for voting |
| **Review** | Under review by the community |
| **Voting** | Active voting period |
| **Discussion** | In community discussion phase |
| **Executed** | Successfully funded and executed |
| **Cancelled** | Withdrawn by proposer |
| **Rejected** | Did not pass voting |
| **Expired** | Voting period ended without quorum |

### Participating in GrantShares

While this MiniApp provides read-only access to proposals, you can:
1. Copy discussion links to join conversations
2. Visit the full GrantShares platform to submit proposals
3. Vote on proposals through the official interface
4. Track proposal progress over time

## How It Works

### Architecture

GrantShare aggregates data from the GrantShares platform:

**Data Source:**
- Fetches proposals from `/api/grantshares/proposals`
- Real-time vote counts and status updates
- Base64 decoded proposal titles for readability

**Frontend Components:**
- Responsive card-based proposal list
- Status badges with color coding
- Statistics dashboard
- Copy-to-clipboard functionality

**State Management:**
- Proposal data cached in memory
- Detail view passes data via local storage
- Error handling for failed requests

### Data Processing

1. **Fetch**: Request latest proposals from API
2. **Parse**: Decode Base64 titles and normalize data
3. **Filter**: Remove incomplete entries
4. **Display**: Render in themed card components
5. **Update**: Auto-refresh on page load

### Integration with GrantShares

This MiniApp serves as a lightweight frontend for the GrantShares ecosystem:
- Provides visibility into community funding
- Encourages participation through easy access
- Links to full platform for actions (vote, propose)

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ✅ Yes |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- No on-chain contract is deployed; the app relies on off-chain APIs and wallet signing flows.

## Network Configuration

No on-chain contract is deployed.

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### Mainnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

## Assets

- **Allowed Assets**: NEO, GAS

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

### Project Structure

```
apps/grant-share/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue           # Main app component
│   │   │   └── grant-share-theme.scss
│   │   └── detail/
│   │       └── index.vue           # Proposal detail view
│   ├── composables/
│   │   └── useI18n.ts              # Internationalization
│   └── static/
├── package.json
└── README.md
```

### API Response Format

```typescript
interface Grant {
  id: string;
  title: string;
  proposer: string;
  state: 'active' | 'review' | 'voting' | 'discussion' | 'executed' | 'cancelled' | 'rejected' | 'expired';
  votesAccept: number;
  votesReject: number;
  discussionUrl: string;
  createdAt: string;
  comments: number;
  onchainId: number | null;
}
```

## Troubleshooting

**Proposals not loading:**
- Check internet connection
- Verify API endpoint availability
- Try refreshing the page

**Discussion links not working:**
- Some proposals may not have associated discussions
- Links open external resources
- Check browser permissions for external links

**Status not updating:**
- Proposal statuses update periodically
- Refresh the app to get latest data

## Support

For questions about specific proposals or the GrantShares platform, visit the official GrantShares website.
