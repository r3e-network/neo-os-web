# MiniAppSelfLoan

## Overview

MiniAppSelfLoan is a self-repaying loan smart contract inspired by Alchemix. Users deposit NEO as collateral to borrow GAS with tiered loan-to-value ratios (20/30/40%). The collateral generates yields that automatically repay the debt over time, allowing users to access liquidity without selling their assets.

## 中文说明

NEO 借贷 - 自动还款贷款系统

### 功能特点

- 抵押 NEO 借出 GAS
- 贷款价值比：20/30/40% LTV
- 抵押物收益自动还款
- 债务还清后取回抵押物
- 无清算风险（低 LTV）

### 使用方法

1. 存入 NEO 作为抵押物
2. 按选择的 LTV 档位自动借出 GAS
3. 抵押物产生的收益自动还款
4. 手动还款加速债务清偿
5. 债务归零后取回 NEO

### 贷款参数

- **LTV 比率**：20/30/40%（档位可选）
- **抵押资产**：NEO
- **借出资产**：GAS
- **还款方式**：收益自动 + 手动
- **手续费**：0.5% 生成费
- **清算风险**：极低（低 LTV）

## English

### Features

- Collateralize NEO to borrow GAS
- Loan-to-value ratio: 20/30/40% LTV tiers
- Collateral yields auto-repay debt
- Retrieve collateral after debt cleared
- No liquidation risk (low LTV)

### Usage

1. Deposit NEO as collateral
2. Automatically borrow GAS based on selected LTV tier
3. Collateral yields auto-repay debt
4. Manual repayment accelerates clearance
5. Retrieve NEO after debt reaches zero

### Loan Parameters

- **LTV Ratio**: 20/30/40% (tiered)
- **Collateral**: NEO
- **Borrowed**: GAS
- **Repayment**: Auto yield + manual
- **Origination Fee**: 0.5%
- **Liquidation Risk**: Very low (low LTV tiers)

## Technical Details

### Contract Information

- **Contract**: MiniAppSelfLoan
- **Category**: DeFi / Lending
- **Permissions**: Gateway integration
- **Collateral**: NEO
- **Borrowed Asset**: GAS
- **LTV**: 20/30/40% (tiered)

### Key Methods

#### User Methods

**CreateLoan(borrower, neoAmount, ltvTier)**

- Creates new loan with NEO collateral
- Calculates loan amount based on selected LTV tier
- Transfers GAS to borrower
- Records loan details
- Emits: LoanCreated

**RepayDebt(loanId, amount)**

- Manually repays loan debt
- Reduces outstanding debt
- Auto-closes loan if fully repaid
- Emits: LoanRepaid, LoanClosed

### Data Storage

```
PREFIX_LOAN_BORROWER: loanId → borrower address
PREFIX_LOAN_COLLATERAL: loanId → NEO amount
PREFIX_LOAN_DEBT: loanId → remaining debt
PREFIX_LOAN_ACTIVE: loanId → active status
```

### Events

**LoanCreated(loanId, borrower, collateral, borrowed)**

- Emitted when loan is created
- Records collateral and borrowed amounts

**LoanRepaid(loanId, repaid, remaining)**

- Emitted when debt is repaid
- Shows repayment progress

**LoanClosed(loanId, borrower)**

- Emitted when loan fully repaid
- Collateral returned to borrower

## Game Mechanics

### Loan Calculation

```
LoanAmount = NEOCollateral * LTVTier * GASPrice
LoanAmount = NEOCollateral * {0.20/0.30/0.40} * 1 GAS
```

Example:

- Deposit: 100 NEO
- Borrow: 20 GAS (20% LTV) / 30 GAS (30% LTV) / 40 GAS (40% LTV)
- Collateral value: 100 GAS equivalent

### Repayment Flow

**Automatic Repayment**

- NEO generates GAS over time
- Platform collects GAS yields
- Yields applied to debt reduction
- Gradual debt clearance

**Manual Repayment**

- User can repay anytime
- Accelerates debt clearance
- Partial or full repayment
- Immediate collateral return if full

### Risk Management

**Low LTV Benefits**

- Low LTV tiers = high collateralization
- Extremely safe from liquidation
- NEO price can drop substantially before risk
- No liquidation mechanism needed

## Use Cases

### Liquidity Without Selling

- Access cash without selling NEO
- Maintain NEO exposure
- Use borrowed GAS for opportunities
- Debt auto-repays over time

### Tax Optimization

- Borrowing is not taxable event
- Avoid capital gains tax
- Maintain long-term holdings
- Generate liquidity efficiently

### Yield Farming

- Use borrowed GAS for farming
- Collateral yields repay debt
- Farming yields are profit
- Leveraged yield strategy

## Integration

### NEO/GAS Transfers

The contract handles native assets:

- NEO.Transfer() for collateral
- GAS.Transfer() for loans
- Automatic balance tracking
- Secure asset custody

### Gateway Integration

All operations route through ServiceLayerGateway:

- Access control enforcement
- Event monitoring
- Integration with yield services
- Automated repayment tracking

## Security Considerations

- Low LTV eliminates liquidation risk
- Collateral locked until debt cleared
- Cannot borrow against same collateral twice
- Repayment validation prevents errors
- Admin cannot access user collateral

## Future Enhancements

- Yield service integration for auto-repayment
- Variable LTV based on collateral type
- Multiple collateral asset support
- Debt refinancing options
- Interest rate adjustments

## Version

**Version**: 1.0.0
**Author**: R3E Network
**License**: See project root
