# MiniAppWhisperChain | 语音漂流瓶

## Overview | 概述

**English**: Voice message drift bottles on blockchain. Send encrypted voice messages that randomly find recipients, creating serendipitous connections.

**中文**: 区块链上的语音漂流瓶。发送加密语音消息，随机找到接收者，创造偶然的连接。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppWhisperChain`
- **App ID**: `miniapp-whisperchain`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Send Whisper**: Upload encrypted voice message hash
2. **Floating Period**: Message floats for 7 days
3. **Random Claim**: Others can claim random floating whispers
4. **One-Time Delivery**: Each whisper claimed once
5. **Expiry**: Unclaimed whispers expire after 7 days

### 中文

1. **发送私语**: 上传加密语音消息哈希
2. **漂流期**: 消息漂流7天
3. **随机认领**: 他人可认领随机漂流私语
4. **一次性投递**: 每条私语认领一次
5. **过期**: 未认领私语7天后过期

## Key Features | 核心特性

### English

- **Voice Messages**: Encrypted audio content
- **Random Discovery**: Serendipitous message finding
- **Privacy**: Content hash only, actual audio off-chain
- **Time Limit**: 7-day expiry window
- **Anti-Self-Claim**: Cannot claim own whispers

### 中文

- **语音消息**: 加密音频内容
- **随机发现**: 偶然的消息发现
- **隐私**: 仅内容哈希，实际音频链下
- **时间限制**: 7天过期窗口
- **防自我认领**: 不能认领自己的私语

## Main Functions | 主要函数

### User Functions | 用户函数

#### `SendWhisper(sender, contentHash, receiptId)`

**English**: Send a voice message whisper.

- `sender`: Sender address
- `contentHash`: 32-byte content hash
- `receiptId`: Payment receipt (0.05 GAS)

**中文**: 发送语音消息私语。

- `sender`: 发送者地址
- `contentHash`: 32字节内容哈希
- `receiptId`: 支付收据（0.05 GAS）

#### `ClaimWhisper(receiver)`

**English**: Claim a random floating whisper.

- `receiver`: Receiver address
  Returns: Whisper ID (0 if none available)

**中文**: 认领随机漂流私语。

- `receiver`: 接收者地址
  返回: 私语ID（无可用则为0）

### Query Functions | 查询函数

#### `GetWhisper(whisperId)`

**English**: Get whisper details.

**中文**: 获取私语详情。

## Events | 事件

### `WhisperSent`

**English**: Emitted when whisper is sent.

**中文**: 发送私语时触发。

### `WhisperReceived`

**English**: Emitted when whisper is claimed.

**中文**: 认领私语时触发。

## Economic Model | 经济模型

### English

- **Send Fee**: 0.05 GAS per whisper
- **Claim Fee**: Free
- **Expiry**: 7 days (604800 seconds)
- **Random Matching**: Up to 20 attempts per claim

### 中文

- **发送费用**: 每条私语0.05 GAS
- **认领费用**: 免费
- **过期**: 7天（604800秒）
- **随机匹配**: 每次认领最多20次尝试

## Use Cases | 使用场景

### English

1. **Anonymous Messages**: Send messages to strangers
2. **Voice Diary**: Share voice thoughts publicly
3. **Social Discovery**: Connect with random people
4. **Message in a Bottle**: Digital drift bottle experience

### 中文

1. **匿名消息**: 向陌生人发送消息
2. **语音日记**: 公开分享语音想法
3. **社交发现**: 与随机的人连接
4. **瓶中信**: 数字漂流瓶体验
