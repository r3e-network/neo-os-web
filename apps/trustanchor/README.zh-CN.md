# TrustAnchor MiniApp

TrustAnchor 正在重构为 **verification-script agent 账户** 模型，而不是每个候选人一个 agent 合约。

## 概览

| 属性 | 值 |
|------|----|
| **App ID** | `miniapp-trustanchor` |
| **分类** | Governance |
| **版本** | 1.0.0 |
| **框架** | Vue 3 (uni-app) |

## 当前产品模型

- 整个质押路由被拆成 21 个 verification-script agent 账户。
- 每个 agent 账户绑定一个候选人目标。
- 所有新流入默认先进入 **candidate 21 对应的 agent 账户**。
- 管理员调整投票敞口的方式不是改一个抽象权重，而是把 **真实 NEO** 从 agent A 转到 agent B。
- 新架构里不再存在每个候选人一个子合约；每个候选人只对应一个编号化的 agent 账户。
- GAS 奖励仍按池级别统一记账，再按比例分配给质押者。
- 如果核心合约里有足够 NEO 流动性，解押可以即时到账。
- 如果流动性还在各个 agent 账户里，解押会进入待领取队列，直到足够的 NEO 回流到核心合约。

## 为什么要这样重构

旧的 agent 合约模型部署面太大、运维链路太重。新的 TrustAnchor 小程序只保留更直接的逻辑：

1. 用 verification-script agent 账户做投票桶。
2. 每个 agent 账户只绑定一个候选人公钥目标。
3. 调仓必须对应一次真实资产转移。
4. 费用策略保持最简单的 0% 费率、100% 奖励返还。

## 小程序界面

当前重构后的界面只保留 3 个页面：

- **概览**：池级别记账、零费率说明、默认路由摘要。
- **路由**：展示 21 个 verification-script agent 账户，明确 candidate 21 是默认入口。
- **架构**：解释 verification-script agent 账户模型和管理员转仓规则。

不再保留候选人排名页，也不再保留旧的 agent 合约管理页。

## 网络配置

### 测试网

| 属性 | 值 |
|------|----|
| **合约** | `0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2` |
| **RPC** | `https://n3seed1.ngd.network:20332` |
| **浏览器** | [在 Neo3Scan 查看](https://www.neo3scan.com/contract/0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2) |
| **网络魔数** | `894710606` |

### 主网

| 属性 | 值 |
|------|----|
| **合约** | `verification-script agent 账户版本待上线` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **浏览器** | `https://www.neo3scan.com` |
| **网络魔数** | `860833102` |

> 测试网单合约版本已经上线。主网地址仍然故意留空，等待 verification-script agent 账户运维模型进一步验证后再上线。

## 已验证的测试网流程

- 用户存入后，`stakeOf(user)` 会增加，同时同额 NEO 自动路由进 `agent 21`。
- 用户发起解押后，`stakeOf(user)` 会立即扣减。
- 如果核心池暂时没有足够 NEO，解押会记录进 `pendingWithdrawOf(user)`。
- GAS 奖励分配采用 RPS 累加器模型，并由自动化测试覆盖。
