# Masquerade DAO

Anonymous DAO voting with mask identities and TEE-verified privacy.

## 中文说明

面具舞会 - 匿名DAO投票，使用面具身份和TEE验证隐私

### 功能特点

- 创建匿名面具身份进行投票
- TEE确保投票隐私
- 防止双重投票机制
- 可选的身份揭示功能

### 使用方法

1. 支付0.1 GAS创建面具身份（使用身份哈希）
2. 使用面具ID对提案进行匿名投票
3. 每个面具每个提案只能投票一次
4. 可选择在投票后揭示真实身份

### 技术细节

- **费用**: 创建面具0.1 GAS
- **存储**: 身份哈希、创建时间、活跃状态
- **隐私**: TEE确保投票隐私同时防止双重投票

## English

### Features

- Create anonymous mask identities for voting
- TEE ensures vote privacy
- Double-voting prevention mechanism
- Optional identity reveal functionality

### Usage

1. Pay 0.1 GAS to create mask identity (with identity hash)
2. Use mask ID to vote anonymously on proposals
3. Each mask can vote once per proposal
4. Optionally reveal real identity after voting

### Technical Details

- **Fees**: 0.1 GAS mask creation
- **Storage**: Identity hash, creation time, active status
- **Privacy**: TEE ensures vote privacy while preventing double voting

## Technical

- **Contract**: MiniAppMasqueradeDAO
- **Category**: Governance/Privacy
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: TEE for privacy-preserving vote verification
