# Scream to Earn

Voice-powered mining where users earn GAS by screaming into their microphone.

## 中文说明

尖叫挖矿 - 语音驱动的挖矿，用户通过对着麦克风尖叫来赚取GAS

### 功能特点

- 通过尖叫赚取GAS奖励
- TEE验证音频输入并测量分贝级别
- 最低70分贝才能获得奖励
- 实时排行榜显示最响亮的尖叫者

### 使用方法

1. 对着麦克风尖叫（至少70分贝）
2. TEE验证音频并测量分贝级别
3. 根据分贝级别获得GAS奖励（每分贝0.0001 GAS）
4. 查看个人累计奖励和排行榜排名

### 技术细节

- **最低分贝**: 70 dB
- **最高分贝**: 150 dB（防止无效读数）
- **奖励公式**: (分贝 - 70) × 0.0001 GAS
- **存储**: 尖叫记录、用户总奖励、排行榜
- **TEE服务**: 验证音频真实性和分贝测量

## English

### Features

- Earn GAS rewards by screaming
- TEE verifies audio input and measures decibel levels
- Minimum 70 decibels required for rewards
- Real-time leaderboard of loudest screamers

### Usage

1. Scream into microphone (minimum 70 decibels)
2. TEE verifies audio and measures decibel level
3. Receive GAS reward based on decibel level (0.0001 GAS per dB)
4. View cumulative rewards and leaderboard ranking

### Technical Details

- **Minimum Decibels**: 70 dB
- **Maximum Decibels**: 150 dB (prevents invalid readings)
- **Reward Formula**: (Decibels - 70) × 0.0001 GAS
- **Storage**: Scream records, user totals, leaderboard
- **TEE Service**: Audio authenticity verification and decibel measurement

## Technical

- **Contract**: MiniAppScreamToEarn
- **Category**: Entertainment/Gaming
- **Permissions**: Full contract permissions
- **Assets**: GAS
- **Services**: TEE audio verification and measurement
