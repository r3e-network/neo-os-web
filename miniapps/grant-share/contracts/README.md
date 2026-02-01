# Grant Share - Contracts

## Overview

This directory is intentionally empty. **Grant Share does not use on-chain smart contracts.**

## Architecture

Grant Share is an **API-based application** that reads grant proposal data from an external backend service.

### How It Works

1. **Data Source**: Grant proposals are fetched from `/api/grantshares/proposals`
2. **Data Flow**:
   - App requests proposals from the API
   - API returns structured data including title, proposer, voting status, comments
   - App displays and filters proposals

3. **No Blockchain Operations**:
   - No contract invocations
   - No wallet connection required for viewing grants
   - No GAS fees or transaction signing

## Why API-Based?

- **Simplicity**: No blockchain interaction needed for read-only proposal browsing
- **Flexibility**: External API can aggregate grants from multiple sources
- **Performance**: Faster data fetching compared to on-chain reads
- **Cost**: Zero blockchain fees for users

## Data Structure

The API returns proposals with:
- `id` - Unique identifier
- `title` - Grant title (base64 encoded)
- `proposer` - Proposer's address or name
- `state` - Current status (active, review, voting, executed, etc.)
- `votesAccept/votesReject` - Voting results
- `discussionUrl` - Link to discussion forum
- `offchainCreationTimestamp` - Creation date
- `offchainCommentsCount` - Number of comments

## Security Considerations

- API responses should be validated before display
- Links to discussion forums should open in safe contexts
- No sensitive data is stored or transmitted
- The app is read-only; no on-chain actions are performed

## For Developers

To integrate on-chain voting or fund management in the future:
1. Deploy a governance contract
2. Add wallet connection via `@neo/uniapp-sdk`
3. Implement `invokeContract` calls for voting operations
4. Store vote records on-chain
