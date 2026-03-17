# SelfLoan — Borrow Against Your Future, Repay With Time

> Lock NEO. Borrow GAS instantly. Your staking rewards repay the loan automatically. Zero liquidation risk, ever.

## What is SelfLoan?

SelfLoan is an Alchemix-style self-repaying lending protocol built natively on Neo N3. Lock your NEO as collateral, instantly receive GAS against it, and let time do the rest — your NEO continues generating staking rewards (GAS) while locked, and those rewards automatically pay down your loan. When the loan is fully repaid, your NEO unlocks.

The elegance of SelfLoan is that it's impossible to get liquidated. Unlike traditional DeFi lending where a price drop can wipe out your collateral, SelfLoan's debt is denominated in the same yield your collateral produces. There is no price oracle dependency, no margin calls, no cascading liquidations. You're simply borrowing from your own future yield.

Three LTV (Loan-to-Value) tiers let you choose your risk profile: Conservative (20%), Balanced (30%), or Aggressive (40%). Higher LTV means more GAS upfront but slower repayment. A small platform fee (0.5%) is deducted at origination. Keeper automation monitors health factors and sends alerts if anything needs attention.

## How to Use

1. **Connect Wallet** — Link your Neo N3 wallet containing NEO.
2. **Choose LTV Tier** — Select Conservative (20%), Balanced (30%), or Aggressive (40%) based on how much GAS you want upfront versus how quickly you want repayment.
3. **Enter Collateral** — Specify how many NEO to lock (must be whole numbers).
4. **Take Loan** — Confirm the transaction. GAS is credited to your wallet immediately, minus the 0.5% platform fee.
5. **Wait & Watch** — Your locked NEO generates GAS staking rewards that automatically repay the loan balance. Monitor progress on the dashboard.
6. **Manage & Auto-Unlock** — The current miniapp UI focuses on opening and monitoring loans. The contract also supports manual repayment, and your NEO unlocks automatically once debt reaches zero.

The live borrow path is a two-step wallet flow under the hood:

1. `NEO.transfer(..., "miniapp-self-loan:collateral")`
2. `createLoan(...)`

The frontend executes both steps for you.

## Key Features

- **Zero Liquidation**: Debt is repaid by yield from the same collateral. No price oracle risk, no margin calls.
- **Instant GAS Liquidity**: Borrow GAS immediately against locked NEO — no waiting for staking rewards to accumulate.
- **Three LTV Tiers**: Conservative (20%), Balanced (30%), Aggressive (40%) — choose your tradeoff between immediate liquidity and repayment speed.
- **Self-Repaying**: The loan repays itself over time through NEO staking rewards. Set it and forget it.
- **Health Factor Dashboard**: Real-time view of your loan health, current LTV, collateral utilization, and repayment progress.
- **Keeper Monitoring**: Automated health factor monitoring with alerts if intervention is needed.
- **Low Fee**: Only 0.5% origination fee, deducted at loan creation.

## Technical Architecture

### Smart Contract

| Component         | Details                               |
| ----------------- | ------------------------------------- |
| **Contract Name** | `MiniAppSelfLoan`                     |
| **Language**      | C# (Neo N3 Smart Contract)            |
| **Blockchain**    | Neo N3                                |
| **LTV Tiers**     | Tier 1: 20%, Tier 2: 30%, Tier 3: 40% |
| **Platform Fee**  | 0.5% (50 bps) origination             |
| **Min Duration**  | 24 hours                              |
| **Collateral**    | NEO (whole numbers only)              |
| **Borrow Asset**  | GAS                                   |

### Service Layer Technologies

- **Keeper (Automation)**: Continuously monitors health factors across all active loans. Triggers alerts when health factors approach thresholds and auto-unlocks collateral when loans are fully repaid by accumulated yield.

### Contract Methods

| Method             | Type   | Parameters                          | Description                                     |
| ------------------ | ------ | ----------------------------------- | ----------------------------------------------- |
| `CreateLoan`       | Action | `borrower`, `collateral`, `ltvTier` | Lock NEO and receive GAS                        |
| `GetLoanDetails`   | Query  | `loanId`                            | Get loan status (collateral, debt, active, LTV) |
| `GetPlatformStats` | Query  | —                                   | Get platform LTV tiers, min duration, fee       |
| `RepayDebt`        | Action | `loanId`, `payer`, `amount` | Contract-level manual repayment path using direct prepaid GAS |

## Getting Started

```bash
# Navigate to the app directory
cd miniapps/apps/self-loan

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production (H5)
npm run build
```

## Contract Addresses

| Network | Address                                      |
| ------- | -------------------------------------------- |
| Testnet | `0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b` |
| Mainnet | `0x942da575b31f39cbb59e64b5813b128739b44c25` |

### Explorer Links

- **Testnet**: [View on NeoTube](https://testnet.neotube.io/contract/0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b)
- **Mainnet**: [View on NeoTube](https://neotube.io/contract/0x942da575b31f39cbb59e64b5813b128739b44c25)

## Domains

- Mainnet domain: `selfloan.miniapp.neo`

## Tech Stack

| Layer             | Technology                   |
| ----------------- | ---------------------------- |
| Frontend          | Vue 3 + TypeScript (uni-app) |
| Smart Contract    | C# / Neo N3                  |
| Health Monitoring | Keeper (Automated Alerts)    |
| Collateral        | NEO (Staking Yield → GAS)    |

## Latest Testnet Validation

- Borrow collateral transfer tx: `0xb2597e1f0ccb16e14b5b97b0f1788084ea83c6fbd2da185323cdb002783e9ac9`
- Borrow create-loan tx: `0xd3efe7e23da846911b45784737f2c754eb866f3ad81b6724630f0bbaf2892f3f`
- Result: `loanId = 1`, `collateral = 1 NEO`, `debt = 0.2 GAS`

## License

MIT License — R3E Network
