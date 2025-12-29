# MiniAppCanvas - Collaborative Pixel Canvas

A 1920x1080 collaborative pixel canvas where users pay to paint pixels, with daily NFT snapshots.

## Features

- **Global Canvas**: Single shared 1920x1080 pixel canvas
- **Pay-to-Paint**: 1000 datoshi per pixel
- **Batch Operations**: Paint up to 1000 pixels per transaction
- **Daily NFT**: Automatic NFT creation at midnight via AutomationAnchor
- **Image Upload**: Upload, scale, rotate, and position images

## Contract Methods

| Method           | Parameters                    | Description                        |
| ---------------- | ----------------------------- | ---------------------------------- |
| `SetPixel`       | painter, x, y, r, g, b        | Set single pixel color             |
| `SetPixelBatch`  | painter, pixels[]             | Set multiple pixels (7 bytes each) |
| `GetPixel`       | x, y                          | Get pixel RGB (returns 3 bytes)    |
| `GetPixelBatch`  | startX, startY, width, height | Get region (max 100x100)           |
| `CreateDailyNFT` | -                             | Create NFT snapshot (once per day) |

## Pixel Batch Format

Each pixel in batch: `[x_high, x_low, y_high, y_low, r, g, b]` (7 bytes)

## Pricing

- **Pixel**: 100 datoshi (0.000001 GAS)
- **NFT**: 1 GAS (to platform treasury)

## Events

- `PixelSet(painter, x, y, r, g, b)`
- `BatchPixelsSet(painter, count, totalCost)`
- `CanvasNFTCreated(nftId, day, treasury)`

---

## 中文说明

### 概述

MiniAppCanvas 是一个协作像素画布合约，用户可以付费绘制像素，并每日生成 NFT 快照。这是一个 1920x1080 的全球共享画布，支持批量操作和图像上传功能。

### 核心功能

- **全球画布**: 单一共享的 1920x1080 像素画布
- **付费绘制**: 每像素 1000 datoshi（0.00001 GAS）
- **批量操作**: 每次交易最多绘制 1000 个像素
- **每日 NFT**: 通过 AutomationAnchor 在午夜自动创建 NFT
- **图像上传**: 上传、缩放、旋转和定位图像

### 使用方法

#### 绘制像素

**单个像素:**

```
SetPixel(painter, x, y, r, g, b)
```

- 设置单个像素的颜色
- 费用: 1000 datoshi

**批量像素:**

```
SetPixelBatch(painter, pixels[])
```

- 一次设置多个像素（最多 1000 个）
- 每个像素格式: `[x_high, x_low, y_high, y_low, r, g, b]` (7 字节)
- 批量操作更节省 GAS

#### 查询像素

**单个像素:**

```
GetPixel(x, y) → [r, g, b]
```

- 返回指定坐标的 RGB 颜色值（3 字节）

**批量查询:**

```
GetPixelBatch(startX, startY, width, height)
```

- 获取矩形区域的像素数据（最大 100x100）

#### 创建 NFT

```
CreateDailyNFT()
```

- 创建当天画布的 NFT 快照
- 每天只能创建一次
- 费用: 1 GAS（支付给平台金库）

### 参数说明

#### 合约方法参数

| 方法             | 参数                          | 说明                              |
| ---------------- | ----------------------------- | --------------------------------- |
| `SetPixel`       | painter, x, y, r, g, b        | 画家地址、坐标 (x, y)、RGB 颜色值 |
| `SetPixelBatch`  | painter, pixels[]             | 画家地址、像素数组（每个 7 字节） |
| `GetPixel`       | x, y                          | 坐标 (x, y)                       |
| `GetPixelBatch`  | startX, startY, width, height | 起始坐标和区域大小                |
| `CreateDailyNFT` | -                             | 无参数                            |

#### 定价

- **像素**: 1000 datoshi (0.00001 GAS)
- **NFT**: 1 GAS（支付给平台金库）

#### 事件

- `PixelSet(painter, x, y, r, g, b)`: 单个像素设置时发出
- `BatchPixelsSet(painter, count, totalCost)`: 批量像素设置时发出
- `CanvasNFTCreated(nftId, day, treasury)`: NFT 创建时发出

### 使用场景

- **协作艺术**: 社区成员共同创作像素艺术作品
- **广告位**: 项目方购买像素区域展示 Logo
- **像素战争**: 不同社区竞争画布空间
- **NFT 收藏**: 收集每日画布快照 NFT
- **社交互动**: 通过像素绘制表达创意和想法
