# Charity Vault - Contracts

## Overview

This directory is intentionally empty. **Charity Vault does not deploy its own on-chain smart contract.**

## Architecture

Charity Vault is a **frontend-only application** that interacts with a pre-existing charity contract deployed on the Neo blockchain.

### How It Works

1. **Contract Interaction**: The app uses `@neo/uniapp-sdk` to invoke read/write operations on the charity contract
2. **Contract Methods Used**:
   - `getCampaigns` - Fetch all charity campaigns
   - `getUserDonations` - Fetch donation history for a user
   - `getCampaignDonations` - Fetch donations for a specific campaign
   - `donate` - Submit a donation to a campaign
   - `createCampaign` - Create a new charity campaign

3. **Contract Address**: Retrieved dynamically via `getContractAddress()` from the SDK

## Why No Custom Contract?

- **Reusability**: Uses a standardized charity contract maintained separately
- **Security**: Battle-tested contract code reduces attack surface
- **Upgradability**: Contract improvements benefit all users without app updates
- **Cost Efficiency**: Single contract deployment saves network fees

## Security Considerations

- All blockchain operations require wallet connection and user approval
- The app never handles private keys or seed phrases
- Transaction verification occurs on-chain via `waitForEvent()`
- Input validation is performed both client-side and by the contract

## For Developers

If you need to deploy a custom charity contract, see the `/contracts` directory in the root of this repository for templates and documentation.
