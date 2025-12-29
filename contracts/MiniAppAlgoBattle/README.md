# Algo Battle Arena

Code gladiator battles where algorithms compete in TEE-secured environments.

## 中文说明

算法角斗场 - 代码角斗士战斗，算法在TEE安全环境中竞技

### 功能特点

- 上传战斗脚本（JS/Lua策略）
- 脚本加密存储，在TEE中执行
- 匹配运行100轮，仅结果可见
- 基于胜负的天梯排名系统

### 使用方法

1. 支付0.1 GAS上传你的战斗脚本
2. 支付0.5 GAS发起与其他脚本的对战
3. TEE执行战斗并返回比分
4. 查看胜负记录和排名

### 技术细节

- **费用**: 上传0.1 GAS，对战0.5 GAS
- **存储**: 脚本哈希、胜负统计、对战记录
- **TEE服务**: 执行战斗脚本并返回比分

## English

### Features

- Upload battle scripts (JS/Lua strategies)
- Scripts stored encrypted, executed in TEE
- Matches run 100 rounds, only results visible
- Ladder ranking based on win/loss records

### Usage

1. Pay 0.1 GAS to upload your battle script
2. Pay 0.5 GAS to request match against another script
3. TEE executes battle and returns scores
4. View win/loss records and rankings

### Technical Details

- **Fees**: 0.1 GAS upload, 0.5 GAS per match
- **Storage**: Script hash, win/loss stats, match data
- **TEE Service**: Executes battle scripts and returns scores

## Technical

- **Contract**: MiniAppAlgoBattle
- **Category**: Gaming/Competition
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: TEE compute for battle execution
