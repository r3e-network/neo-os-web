# 区块链灵位

> 永恒存在，永恒记忆

## 概述

区块链灵位是一项去中心化纪念服务，可在 Neo 区块链上为逝去的亲友创建永久数字纪念。

## 功能

- **创建灵位**：记录逝者姓名、照片、人生日期、传记与讣告
- **祭奠缅怀**：使用虚拟供品（香、烛、花等）祭拜，链上留痕
- **永久存储**：所有数据永久保存于区块链
- **讣告板**：主页展示最新讣告
- **访问记录**：追踪已祭拜的灵位

## 合约方法

### CreateMemorial

创建新灵位（免费）。

```
CreateMemorial(
  creator: Hash160,
  deceasedName: string,
  photoHash: string,
  relationship: string,
  birthYear: int,
  deathYear: int,
  biography: string,
  obituary: string
) → memorialId
```

### PayTribute

使用虚拟供品进行祭拜。

```
PayTribute(
  visitor: Hash160,
  memorialId: int,
  offeringType: int,
  message: string,
  receiptId: int
) → tributeId
```

### 供品列表

| 类型 | 名称 | 费用 (GAS) |
|------|------|-----------|
| 1 | 香 | 0.01 |
| 2 | 蜡烛 | 0.02 |
| 3 | 鲜花 | 0.03 |
| 4 | 水果 | 0.05 |
| 5 | 酒 | 0.1 |
| 6 | 祭宴 | 0.5 |

## 开发

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## 非营利说明

本服务为非营利项目，所有费用仅用于覆盖区块链交易成本。
