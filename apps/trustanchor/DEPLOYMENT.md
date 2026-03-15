# TrustAnchor 部署与操作指南

## 概述

TrustAnchor 是一个非营利投票委托系统，允许用户将 NEO/GAS 投票权委托给可信代理人。

## 目录

1. [合约部署](#合约部署)
2. [初始化配置](#初始化配置)
3. [Agent 注册](#agent-注册)
4. [用户委托操作](#用户委托操作)
5. [管理员操作](#管理员操作)
6. [前端配置](#前端配置)

---

## 合约部署

### 前置条件

- Neo N3 开发环境
- neo-express 或 Neo 节点
- 部署钱包（需要 GAS）

### 步骤 1: 编译合约

```bash
cd apps/trustanchor/contracts
dotnet build -c Release
```

编译产物位于:
- `bin/Release/net8.0/MiniAppTrustAnchor.nef`
- `bin/Release/net8.0/MiniAppTrustAnchor.manifest.json`

### 步骤 2: 部署到测试网

```bash
# 使用 neo-express
neo-express contract deploy \
  ./bin/Release/net8.0/MiniAppTrustAnchor.nef \
  deployer-wallet

# 或使用 neo-cli
neo-cli deploy MiniAppTrustAnchor.nef
```

### 步骤 3: 记录合约地址

部署成功后记录合约 Script Hash:
```
Contract Hash: 0x1234567890abcdef...
```

---

## 初始化配置

### 自动初始化

合约部署时 `_deploy` 方法自动执行:

```csharp
public static void _deploy(object data, bool update)
{
    if (update) return;
    // 部署者自动成为 Admin
    Storage.Put(PREFIX_ADMIN, Runtime.Transaction.Sender);
    Storage.Put(PREFIX_TOTAL_DELEGATIONS, 0);
    Storage.Put(PREFIX_TOTAL_AGENTS, 0);
    Storage.Put(PREFIX_ACTIVE_AGENTS, 0);
}
```

**重要:** 部署交易的发送者将成为初始管理员。

### 验证初始化

```bash
# 检查 Admin 地址
neo-cli invoke <contract-hash> getAdmin

# 检查计数器
neo-cli invoke <contract-hash> getTotalAgents
neo-cli invoke <contract-hash> getActiveAgentCount
```

---

## Agent 注册

### 概念说明

- **Agent (代理人)**: 接受他人委托投票权的可信实体
- **最大数量**: 21 个 Agent
- **任何人都可以注册**，但需要社区信任

### 注册单个 Agent

```bash
# 使用 neo-cli
neo-cli invoke <contract-hash> registerAgent \
  "Agent Display Name" \
  "https://metadata.example.com/agent1.json"
```

### 注册多个不同地址的 Agent

**方法 1: 使用不同钱包**

```bash
# Agent 1 - 使用钱包 A
neo-cli open wallet agent1.json
neo-cli invoke <contract-hash> registerAgent "Agent Alpha" "https://..."

# Agent 2 - 使用钱包 B  
neo-cli open wallet agent2.json
neo-cli invoke <contract-hash> registerAgent "Agent Beta" "https://..."

# Agent 3 - 使用钱包 C
neo-cli open wallet agent3.json
neo-cli invoke <contract-hash> registerAgent "Agent Gamma" "https://..."
```

**方法 2: 批量脚本**

```python
# deploy_agents.py
from neo3.wallet import Wallet
from neo3.contracts import SmartContract

CONTRACT_HASH = "0x..."

agents = [
    {"wallet": "agent1.json", "name": "Council Member A", "uri": "https://..."},
    {"wallet": "agent2.json", "name": "Council Member B", "uri": "https://..."},
    {"wallet": "agent3.json", "name": "Council Member C", "uri": "https://..."},
]

for agent in agents:
    wallet = Wallet.from_file(agent["wallet"])
    contract = SmartContract(CONTRACT_HASH)
    tx = contract.invoke("registerAgent", [agent["name"], agent["uri"]], wallet)
    print(f"Registered {agent['name']}: {tx.hash}")
```

### 验证 Agent 注册

```bash
# 获取 Agent 数量
neo-cli invoke <contract-hash> getTotalAgents
# 返回: 3

# 获取特定 Agent 信息
neo-cli invoke <contract-hash> getAgentInfo <agent-address>
```

---

## 用户委托操作

### 委托投票权

```bash
# 用户将投票权委托给 Agent
neo-cli invoke <contract-hash> delegateTo <agent-address>
```

### 切换委托

```bash
# 直接调用 delegateTo 新地址即可
neo-cli invoke <contract-hash> delegateTo <new-agent-address>
```

### 撤销委托

```bash
neo-cli invoke <contract-hash> revokeDelegation
```

### 查询委托状态

```bash
# 查询用户当前委托
neo-cli invoke <contract-hash> getDelegationInfo <user-address>

# 查询用户投票权
neo-cli invoke <contract-hash> calculateVotingPower <user-address>
```

---

## 管理员操作

### 转移管理员权限

```bash
# 当前 Admin 执行
neo-cli invoke <contract-hash> setAdmin <new-admin-address>
```

### 强制注销恶意 Agent

```bash
# Admin 可以强制注销任何 Agent
neo-cli invoke <contract-hash> forceUnregisterAgent <agent-address>
```

---

## 前端配置

### 更新合约地址

编辑 `src/pages/index/composables/useTrustAnchor.ts`:

```typescript
// 替换为实际部署的合约地址
const CONTRACT_ADDRESS = "0x1234567890abcdef...";
```

### 环境变量配置

```bash
# .env
VITE_TRUSTANCHOR_CONTRACT=0x1234567890abcdef...
VITE_NETWORK=neo-n3-mainnet
```

### 更新 neo-manifest.json

```json
{
  "contracts": {
    "neo-n3-mainnet": "0x1234567890abcdef...",
    "neo-n3-testnet": "0xabcdef1234567890..."
  }
}
```

---

## 部署检查清单

- [ ] 编译合约成功
- [ ] 部署到目标网络
- [ ] 记录合约地址
- [ ] 验证 Admin 地址正确
- [ ] 注册所需数量的 Agent
- [ ] 更新前端合约地址
- [ ] 更新 neo-manifest.json
- [ ] 测试委托功能
- [ ] 测试撤销功能

---

## 常见问题

### Q: 如何创建多个 Agent 钱包？

```bash
# 创建新钱包
neo-cli create wallet agent1.json
neo-cli create wallet agent2.json
neo-cli create wallet agent3.json

# 为每个钱包转入少量 GAS 用于交易费
```

### Q: Agent 注册失败 "Max agents reached"？

已达到 21 个 Agent 上限。需要先注销现有 Agent。

### Q: 用户委托失败 "No voting power"？

用户钱包中没有 NEO 或 GAS。投票权 = NEO数量 + GAS数量/1亿。

### Q: 如何查看所有 Agent？

```bash
# 遍历索引
for i in range(21):
    neo-cli invoke <contract-hash> getAgentByIndex $i
```

---

## 事件监听

合约会触发以下事件，可用于前端监听:

| 事件 | 参数 |
|------|------|
| AgentRegistered | agent, displayName |
| AgentUnregistered | agent |
| DelegationCreated | delegator, delegatee, votingPower |
| DelegationChanged | delegator, oldDelegatee, newDelegatee |
| DelegationRevoked | delegator, delegatee |

---

## 安全建议

1. **Admin 钱包安全**: 使用硬件钱包或多签
2. **Agent 审核**: 建立社区审核机制
3. **定期监控**: 监控异常委托行为
4. **备份**: 保存所有钱包备份
