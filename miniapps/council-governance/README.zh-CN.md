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
| neo-n3-mainnet | ❌ 未部署 | - |
| neo-n3-testnet | ✅ 已部署 | `0xab120f4586e5691e909aae23d36e73dc5395e6a1` |

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

MiniApp 使用以下接口验证理事会成员身份：

- `GET /api/neo/council-members?chain_id={chain_id}&address={address}`
  - 返回 `{ isCouncilMember: boolean, chainId: string }`

## 合约方法

| 方法 | 说明 | 权限 |
| ---- | ---- | ---- |
| `GetProposalCount()` | 获取提案总数 | 公共 |
| `GetProposal(id)` | 获取提案详情 | 公共 |
| `CreateProposal(...)` | 创建提案 | 仅理事会 |
| `Vote(voter, id, support)` | 投票 | 仅理事会 |
| `HasVoted(voter, id)` | 是否已投票 | 公共 |
| `IsCandidate(address)` | 是否为理事会成员 | 公共 |

## 开发

```bash
# Navigate to the miniapp directory
cd miniapps-uniapp/apps/council-governance

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## 多链支持变更文件

- `src/pages/index/index.vue`：已支持 `chain_id` 参数调用
