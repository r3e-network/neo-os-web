# MiniAppWorldPiano | 全球共奏钢琴

## Overview | 概述

**English**: Global collaborative piano where anyone can play notes. Each note costs GAS and is recorded on-chain forever, creating a permanent musical record.

**中文**: 全球协作钢琴，任何人都可以演奏音符。每个音符消耗GAS并永久记录在链上，创建永久的音乐记录。

## Contract Information | 合约信息

- **Contract Name**: `MiniAppWorldPiano`
- **App ID**: `miniapp-worldpiano`
- **Version**: 1.0.0
- **Author**: R3E Network

## Game Mechanics | 游戏机制

### English

1. **Play Notes**: Pay 0.01 GAS per note
2. **MIDI Range**: 128 pitch values (0-127)
3. **Duration Control**: Note length 1-4000ms
4. **Permanent Record**: All notes stored on-chain
5. **Collaborative Music**: Global composition

### 中文

1. **演奏音符**: 每个音符支付0.01 GAS
2. **MIDI范围**: 128个音高值（0-127）
3. **时长控制**: 音符长度1-4000毫秒
4. **永久记录**: 所有音符存储在链上
5. **协作音乐**: 全球作曲

## Key Features | 核心特性

### English

- **Global Piano**: Anyone can contribute notes
- **On-Chain Music**: Permanent musical record
- **MIDI Standard**: Standard pitch values
- **Timestamped**: Each note has timestamp
- **Low Cost**: 0.01 GAS per note

### 中文

- **全球钢琴**: 任何人都可以贡献音符
- **链上音乐**: 永久音乐记录
- **MIDI标准**: 标准音高值
- **时间戳**: 每个音符有时间戳
- **低成本**: 每个音符0.01 GAS

## Main Functions | 主要函数

### User Functions | 用户函数

#### `PlayNote(player, pitch, duration, receiptId)`

**English**: Play a note on the global piano.

- `player`: Player address
- `pitch`: MIDI pitch (0-127)
- `duration`: Note duration in ms (1-4000)
- `receiptId`: Payment receipt (0.01 GAS)

**中文**: 在全球钢琴上演奏音符。

- `player`: 玩家地址
- `pitch`: MIDI音高（0-127）
- `duration`: 音符时长（毫秒，1-4000）
- `receiptId`: 支付收据（0.01 GAS）

### Query Functions | 查询函数

#### `GetNote(noteId)`

**English**: Get note details.

**中文**: 获取音符详情。

#### `GetTotalNotes()`

**English**: Get total notes played.

**中文**: 获取演奏的音符总数。

## Events | 事件

### `NotePlayed`

**English**: Emitted when a note is played.

**中文**: 演奏音符时触发。

## Economic Model | 经济模型

### English

- **Note Fee**: 0.01 GAS per note
- **Pitch Range**: 0-127 (MIDI standard)
- **Duration Range**: 1-4000ms
- **Permanent Storage**: All notes stored forever

### 中文

- **音符费用**: 每个音符0.01 GAS
- **音高范围**: 0-127（MIDI标准）
- **时长范围**: 1-4000毫秒
- **永久存储**: 所有音符永久存储

## Use Cases | 使用场景

### English

1. **Collaborative Music**: Global composition project
2. **Musical Messages**: Express through music
3. **On-Chain Art**: Permanent musical artwork
4. **Social Experiment**: Collective creativity

### 中文

1. **协作音乐**: 全球作曲项目
2. **音乐消息**: 通过音乐表达
3. **链上艺术**: 永久音乐艺术品
4. **社会实验**: 集体创造力
