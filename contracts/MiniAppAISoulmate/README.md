# AI Soulmate

AI companion with TEE-encrypted memories and evolving personality traits.

## 中文说明

AI 灵魂伴侣进化论 - 基于TEE加密记忆的AI伴侣，具有可进化的个性特征

### 功能特点

- 创建具有个性特征的AI伴侣NFT
- 聊天记录通过TEE加密存储（仅AI可读）
- 基于互动的个性进化系统
- 可选择保留或清除记忆的转移功能

### 使用方法

1. 支付1 GAS创建AI伴侣，设定初始个性
2. 支付0.01 GAS与伴侣聊天，触发TEE处理
3. 随着互动增加，AI个性会自动进化
4. 可转移伴侣所有权，选择是否保留记忆

### 技术细节

- **费用**: 创建1 GAS，每次聊天0.01 GAS
- **存储**: 个性特征、记忆哈希、聊天计数
- **TEE服务**: 处理聊天并返回新记忆哈希和个性变化

## English

### Features

- Create AI companion NFT with personality traits
- Chat history stored encrypted in TEE (AI-only access)
- Personality evolution based on interactions
- Transfer with optional memory retention

### Usage

1. Pay 1 GAS to create AI soulmate with initial personality
2. Pay 0.01 GAS per chat message to interact with companion
3. Personality evolves automatically based on conversation patterns
4. Transfer ownership with choice to keep or wipe memories

### Technical Details

- **Fees**: 1 GAS creation, 0.01 GAS per chat
- **Storage**: Personality traits, memory hash, chat count
- **TEE Service**: Processes chat and returns new memory hash and personality changes

## Technical

- **Contract**: MiniAppAISoulmate
- **Category**: Social/AI
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: TEE compute for chat processing
