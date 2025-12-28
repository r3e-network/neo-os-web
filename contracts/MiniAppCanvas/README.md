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
