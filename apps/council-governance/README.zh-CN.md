# 理事会治理 MiniApp

Neo 理事会成员的去中心化治理。仅前 21 名理事会成员可创建并投票提案。

## 功能

- **理事会成员校验**：验证当前连接的钱包是否为理事会成员
- **提案创建**：理事会成员可提交文本或政策变更提案
- **投票表决**：对提案进行赞成或反对投票
- **提案管理**：查看活跃提案、历史记录与投票状态

## 支持网络

- Neo N3 主网
- Neo N3 测试网

## 合约部署状态

| 网络 | 状态 | 地址 |
| ---- | ---- | ---- |
| neo-n3-mainnet | ✅ 已部署 | `0xc7e50e67589df63302cbea1a6b00beb649ee74d8` |
| neo-n3-testnet | ✅ 已部署 | `0x4c61e5575ae9e151027f6724d07fac127d4cc25f` |

## 部署要求

### 前置条件

1. **已编译合约**：`contracts/build/MiniAppCouncilGovernance.nef`
2. **部署钱包**：需要足够 GAS 用于部署
3. **RPC 端点**：可访问 Neo N3 主网或测试网 RPC

### 部署步骤

1. **部署合约**：

```bash
# Set environment variables
export NEO_TESTNET_WIF="your-wallet-wif"
export NEO_RPC_URL="https://testnet1.neo.coz.io:443"

# Run deployment script
go run scripts/deploy_miniapp_contracts.go
```

2. **更新合约地址**：
部署后将合约地址写入 `scripts/sync-contract-addresses.js`：

```javascript
MiniAppCouncilGovernance: "0x...", // Add deployed address
```

3. **同步到 neo-manifest.json**：

```bash
node scripts/sync-contract-addresses.js
```

4. **验证部署**：
- 确认 `neo-manifest.json` 中的合约地址正确
- 在 host-app 中验证 MiniApp

## API 依赖

MiniApp 直接从 Council Governance 合约读取提案状态。没有可用的钱包读取
provider 时，只读调用会回退到 host 的 `/api/rpc/neo-read` 代理；创建提案
和投票始终通过钱包签名发起真实合约调用。

## 合约方法

| 方法 | 说明 | 权限 |
| ---- | ---- | ---- |
| `getProposalCount()` | 获取提案总数 | 公共 |
| `getProposalDetails(id)` | 获取提案详情和法定人数 | 公共 |
| `createProposal(...)` | 创建提案 | 仅理事会 |
| `vote(voter, id, support)` | 投票 | 仅理事会 |
| `hasVoted(voter, id)` | 是否已投票 | 公共 |
| `isCandidate(address)` | 是否为理事会成员 | 公共 |
| `finalizeProposal(id)` | 终结已到期提案 | 公共 |
| `revokeProposal(owner, id)` | 撤销自己的提案 | 创建者 |

## 开发

```bash
# Navigate to the miniapp directory
cd apps/council-governance

# Install dependencies
npm install

# Start development server
npm run dev
```

## 平台集成

- 独立 dApp：`apps/council-governance/src/PlayArea.tsx` 渲染完整提案工作台。
- Host/OneGate 详情页：`platform/host-app/components/playarea/PlayAreaRegistry.tsx`
  将 `miniapp-council-governance` 映射到原生 council play area，不再走泛化占位。
- 合约注册表：`apps/shared/constants/rpc.ts` 和 `platform/host-app/lib/rpc-helpers.ts`
  均包含主网/测试网 Council Governance 合约地址。
