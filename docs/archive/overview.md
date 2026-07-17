# P3 素材替换管线 — 收口概览

## 做了什么
为 4 款「主体视觉烤死在 webp、代码层改不动」的游戏，建立并跑通 **SVG → sharp → webp** 生成管线，生产真实素材并挂接到游戏，使其更贴近现实原型。

| 游戏 | 原作 | 素材动作 | 验证 |
|---|---|---|---|
| gas-lucky-pool | 幸运转盘 | 新增 `public/wheel.webp`（512×512，6 分区紫金/青/玫瑰交替 + 轮毂 + 指针）；场景 hero 位改转盘、`revealReward` 触发缓动旋转（reduced-motion 门控） | tsc 0 + build 0 |
| gasbox | 扭蛋机 | 覆盖 `src/gasbox-capsule-machine-cutout.webp`（480×560）+ `src/gasbox-prize-capsule-cutout.webp`（220×220），纯素材替换零代码 | build 0 |
| on-chain-tarot | 塔罗 | 覆盖 `public/cards/back.webp`（825×1425，神秘紫金几何纹牌背） | build 0 |
| pet-potion | 宠物养成 | 覆盖 pet-egg/baby/teen/adult.webp + 新增 `potion-bottle.webp` + 场景键挂接（PET_ASSETS.potion / preload / updatePotion） | tsc 0 + build 0 |

## 管线模式（复用 sheep-solitaire）
- `sharp(SVG 字符串).webp({ quality: 92, alphaQuality: 100 }).toFile(...)`；保留 SVG 源可二次编辑。
- sharp 装在 managed node workspace（`~/.workbuddy/binaries/node/workspace`），用 managed node（`~/.workbuddy/binaries/node/versions/22.22.2/bin/node`）运行，从 app 目录经 root hoist 解析。
- 各 app 生成脚本：`scripts/generate-wheel.mjs` / `generate-machine.mjs` / `generate-card-back.mjs` / `generate-pet-art.mjs`。

## 踩坑记录
- **gasbox 输出路径错一层**：脚本初版 `OUT = join(__dirname, "..")`（脚本在 app 根，应为 `src/`），写到 `apps/gasbox/` 而非 `apps/gasbox/src/`，游戏仍加载旧素材。已修正路径 + 清理误放文件 + 显式 `.resize(W,H)` 钉死尺寸。

## 文档同步
- `docs/game-realcase-audit-2026.md`：§7 进度表 4 款「待素材替换 → ✅ 完成」；新增「素材替换管线」小节；Changelog 加 P3 素材管线条目。
- `.workbuddy/memory/2026-07-13.md`：追加管线说明 + 踩坑 + P3 累计进度（16 款已动手，剩 3 款待确认）。

## 仍待确认（3 款）
- zhuada-e：需先确认原作机制
- red-envelope / last-survivor：Web3 产品决策是否投入

## 验证口径提醒
本环境无浏览器，所有改动仅 `tsc` + `vite build` 验证编译；**最终视觉保真度需真机/用户目检**（尤其 4 款新素材的观感）。
