# Milestone Escrow

Staged escrow releases with explicit milestone approvals.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-milestone-escrow` |
| **Category** | defi |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Create Escrow**: Sender creates an escrow with milestone definitions
2. **Fund Escrow**: Deposit funds that will be released upon milestone completion
3. **Milestone Review**: Milestones are reviewed and approved by the recipient
4. **Release Funds**: Upon approval, funds are released to the recipient
5. **Dispute Resolution**: Unresolved issues can be escalated
## Features

- Lock GAS in escrow
- Creator approves each milestone
- Beneficiary claims on approval
- Creator can cancel and refund remaining funds

## User Flow

1. **Create escrow**: define milestones and deposit funds.
2. **Approve**: creator approves milestones when work is delivered.
3. **Claim**: beneficiary claims approved milestone amounts.
4. **Cancel (optional)**: creator cancels and recovers remaining funds.

## Usage

### Getting Started

1. **Launch the App**: Open Milestone Escrow from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet
3. **Create Escrow**: Set up milestones and deposit funds
4. **Manage**: Approve work and release funds

### Creating an Escrow

1. **Define Milestones**:
   | Milestone | Amount | Description |
   |-----------|--------|-------------|
   | 1 | X GAS | First deliverable |
   | 2 | Y GAS | Second deliverable |
   | 3 | Z GAS | Final deliverable |

2. **Set Details**:
   - Total amount (sum of all milestones)
   - Beneficiary address (who receives funds)
   - Milestone descriptions
   - Title and notes

3. **Deposit Funds**:
   - Lock total GAS in contract
   - Funds held securely
   - Creator retains control

4. **Launch**:
   - Escrow becomes active
   - Beneficiary can begin work
   - Creator can approve milestones

### Managing Milestones

**Creator Actions:**

1. **Review Work**:
   - Evaluate milestone completion
   - Request revisions if needed
   - Make informed approval decision

2. **Approve Milestone**:
   - Click approve on completed milestone
   - Beneficiary can now claim
   - Funds released from escrow

3. **Cancel Escrow**:
   - Recover unapproved funds
   - Cancels remaining milestones
   - Beneficiary keeps approved amounts

**Beneficiary Actions:**

1. **Submit Work**:
   - Complete milestone deliverables
   - Communicate completion to creator
   - Wait for approval

2. **Claim Milestone**:
   - After creator approval
   - Click claim to receive funds
   - GAS transferred to wallet

3. **Track Progress**:
   - View milestone status
   - See approved vs pending
   - Monitor total released

### Milestone Lifecycle

```
Created → In Progress → Approved → Claimed → Complete
                     ↓
                  Cancelled (refund to creator)
```

### Best Practices

**For Creators:**
- Break work into clear milestones
- Set realistic amounts per milestone
- Communicate expectations clearly
- Review work thoroughly before approving

**For Beneficiaries:**
- Understand milestone requirements
- Document work for review
- Request clarification when needed
- Submit quality deliverables

### FAQ

**Can I modify milestones after creation?**
No, milestones are fixed at creation.

**What if there's a dispute?**
Parties must resolve disputes off-chain.

**Can partial refunds happen?**
Yes, unapproved milestones can be cancelled.

**Is there a time limit?**
Check contract for any time constraints.

**How are amounts distributed?**
Equal amounts per milestone by default.

### Troubleshooting

**Cannot approve:**
- Verify you are the creator
- Check milestone state
- Ensure proper wallet connection

**Claim not working:**
- Verify milestone is approved
- Check you are the beneficiary
- Confirm transaction fees

**Escrow stuck:**
- Contact the other party
- Use off-chain communication
- Consider mediation if needed

### Support

For escrow questions, review the contract interface.

For technical issues, contact the Neo MiniApp team.

## Contract Methods

- `CreateEscrow(creator, beneficiary, asset, totalAmount, milestoneAmounts, title, notes)`
- `ApproveMilestone(creator, escrowId, milestoneIndex)`
- `ClaimMilestone(beneficiary, escrowId, milestoneIndex)`
- `CancelEscrow(creator, escrowId)`
- `GetEscrowDetails(escrowId)`

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ❌ No |
| Automation | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | `https://testnet.neotube.io` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | `https://neotube.io` |

> Contract deployment is pending; `neo-manifest.json` keeps empty addresses until deployment.
