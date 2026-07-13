# Screw Sort — P2 灵魂还原设计文档（螺丝工坊）

> 版本：v1.0 · 日期：2026-07-13 · 作者：GameDesigner
> 配套审计：`docs/game-realcase-audit-2026.md`（现实案例保真度审计，screw-sort 节 3.3）
> 范围：P2 = 软化/移除失败 + 2.5D 化视觉，贴合原作「解压无压力」定位

---

## 0. 审计结论回顾（为什么做 P2）

审计对 `screw-sort` 评级 **核心 B / 风格 B**，偏离原作两处：

1. **失败条件**：原作多数版本**无失败**，仅效率/步数挑战；平台有「缓冲满即负」的硬性失败（`screw-engine.ts:393-396`）。
2. **维度**：原作是 **3D 可旋转模型**；平台是 **2D 层叠木板**——立体机械解压的签名丢失。
3. ✅ 颜色→盒映射、遮挡顺序、撤销、确定性可解——核心都对了。

P2 目标：**去掉压力、强化机械手感**，让平台从「B 级机制对、灵魂偏」升到「贴近原作定位」。

---

## 1. 设计支柱（Design Pillars）

| # | 支柱 | 玩家体验目标 | 验证问题 |
|---|------|-------------|---------|
| P1 | **解压无压力** | 永不判负，玩家可以慢慢想、随便试 | "玩家是否感到焦虑或被迫？" |
| P2 | **机械满足感** | 拧螺丝有重量、有金属反光、有落位手感 | "点这颗螺丝爽不爽？" |
| P3 | **确定性可解保留** | 每个种子都可通关，平台已有优势 | "是否仍 100% 可解？" |
| P4 | **效率驱动重玩** | 用星级而非失败激励再来一局 | "通关后想不想冲三星？" |

> 任何后续改动都用这四根支柱衡量；违反任意一根需回头。

---

## 2. 核心循环

### Moment-to-Moment（0–30 秒）
- **Action**：点一颗露出的螺丝
- **Feedback**：螺丝「拧出」旋转飞向同色工具箱/暂存槽，金属高光闪过，落位时箱体轻弹
- **Reward**：螺丝归位的清脆感 + 进度条推进

### Session Loop（3–8 分钟）
- **Goal**：把所有螺丝收进同色工具箱，清空木板
- **Tension**：暂存槽会满（**不再判负**，但溢出拉低星级）——玩家要学会先清上层木板、再处理被遮螺丝
- **Resolution**：全部归位 → 结算星级（无失败态）

### Long-Term Loop（天–周）
- **Progression**：最佳星级本地留存（`bestStars`），每关冲三星
- **Retention Hook**：每日/随机种子新关卡（`newPuzzle`）+ 练习排行榜（`guestLeaderboard`）

---

## 3. 机制规格

### 3.1 软失败（Soft-Fail）— 移除 lost 状态

**Purpose**：去掉「缓冲满即负」的硬性压力，贴合原作「解压无压力」。

**Player Fantasy**：这是一个可以慢慢拆的工坊，没有时钟、没有 Game Over。

**Input**：点螺丝（同前）

**Output**：
- 有同色且有空位的箱 → 入箱（`destination: "box"`）
- 无匹配箱但暂存槽未满 → 入槽（`destination: "buffer"`）
- 无匹配箱且暂存槽已满 → **仍入槽，但 `overflows += 1`**（软缓冲，不再判负）

**Success Condition**：`runWon` 不变 —— 所有螺丝移除 + 暂存槽清空 + 箱体全部完成。
**Failure State**：**已移除**。原 `status = "lost"` 不再可达；游戏永远可推进到 won。

**Edge Cases**：
- 暂存槽无限溢出：玩家仍可继续点；flushBuffer 在箱体转色时自动回灌，最终可清空 → 无死局。
- 全部剩余螺丝被遮、暂存槽非空：顶层木板（phase 0）无遮挡，永远有可点螺丝 → 永远能推进。

**Tuning Levers**：
- `BUFFER_CAPACITY`（安全槽数，现 5）— 软缓冲的「无惩罚区」
- `STAR_DEMERIT_TWO`（2 星门槛，[PLACEHOLDER] = 3）— 见 3.2

### 3.2 效率星级（Efficiency Stars）

**Purpose**：用「评分」替代「失败」作为重玩动力。

**公式**（[PLACEHOLDER] 阈值需真机校准）：
```
demerits = undosUsed + overflows
stars = demerits === 0        ? 3
      : demerits <= STAR_DEMERIT_TWO ? 2
      : 1
```
- **3 星**：零撤回、零溢出 —— 一气呵成
- **2 星**：少量撤回/溢出（≤ STAR_DEMERIT_TWO）
- **1 星**：通关即至少 1 星（永不空手）

**Rationale**：原作「无失败」意味着通关必然发生；差异只在「多优雅」。demerits 直接度量优雅度。
**Tuning Levers**：`STAR_DEMERIT_TWO`（现假设 3，[PLACEHOLDER]）。

### 3.3 2.5D 伪3D 视觉

**Purpose**：在现有 Phaser 2D 图片渲染内，补回「立体机械解压」签名，不换引擎。

**实现手段**（均已确认资产为图片 webp，可叠加）：
1. **金属高光**：每颗螺丝叠加一个低透明度白色径向高光点（左上偏移），制造金属球面反光。
2. **投影**：每颗螺丝下方 + 每块木板下方加暗色椭圆投影（offset y，alpha≈0.18），建立纵深。
3. **拧转动效**：飞行螺丝 `angle: 540` 旋转（已有）→ 加强：源螺丝点选时先做一次快速 `scale*1.12 + 旋转 30°` 的「拧出」预备动画再起飞。
4. **箱体厚度**：工具箱图片底部加一条深色边带，模拟厚度前沿。
5. **溢出轻反馈**：暂存槽溢出时，镜头极轻 `shake(80, 0.003)` + 该螺丝落位弹一下（**非失败**，只是「哎哟槽满了」提示）。
6. **reduced-motion 全部门控**：上述动效在 `this.reducedMotion` 下关闭或降到 0 时长。

**Explicit non-goal**：真 3D 可旋转模型（three.js）——工作量大、需新建渲染管线、可能与框架 `BaseScene` 契约冲突。留作未来独立评估，不在 P2。

---

## 4. 数值表（[PLACEHOLDER]）

| 变量 | 基础值 | 最小 | 最大 | 调优说明 |
|------|--------|------|------|---------|
| BUFFER_CAPACITY | 5 | 5 | 12 | 安全槽数；软缓冲下非上限，仅无惩罚区 |
| STAR_DEMERIT_TWO | 3 | 1 | 6 | 2 星门槛（undosUsed+overflows）；[PLACEHOLDER] 真机校准 |
| 溢出 shake 强度 | 0.003 | 0 | 0.01 | 仅反馈非惩罚；reduced-motion 下 0 |
| 拧出预备旋转 | 30° | 0 | 90 | 手感；[PLACEHOLDER] |

> 所有 [PLACEHOLDER] 需真机 playtest 锁定。本环境无浏览器，无法手测。

---

## 5. 状态机（简化）

```
        ┌─────────────┐
        │  playing    │◀──── undo / restart
        └──────┬──────┘
               │ 所有螺丝归位 + 暂存清空
               ▼
        ┌─────────────┐
        │    won      │──► 结算星级（1-3）+ bestStars 留存
        └─────────────┘
   （原 lost 状态已删除，永不进入）
```

---

## 6. 验证计划

- [x] tsc 0 错误 ✅（重跑确认）
- [x] vitest：软缓冲（第 6 颗不判负、overflows++）、computeStars 三档、确定性可解仍成立 ✅（26 passed）
- [x] vite build 通过 ✅（1871 模块，exit 0）
- [ ] **真机 playtest（本环境无法）**：STAR_DEMERIT_TWO 是否让「普通玩家」多落在 2 星、「完美玩家」3 星；溢出反馈是否够轻不引发焦虑；2.5D 高光/投影在 400×680 下是否清晰不糊。

---

## 7. Changelog

- **2026-07-13** — v1.0 初版：定义 P2 四支柱 + 软失败规格 + 效率星级公式 + 2.5D 视觉规格 + 数值 [PLACEHOLDER] + 验证计划。
- **2026-07-13** — **P2 收口**：全部代码实现 + 验证绿（tsc 0 / vitest 26 / build 1871 模块）。改动清单——`screw-engine.ts`（RunStatus 删 `lost`；MoveEvent.destination 删 `loss`；CoreRunState 加 `overflows`；新增 `STAR_DEMERIT_TWO` + `computeStars`）；`guest-engine.ts`（ScrewSortStats 加 `bestStars`；validCore 状态集删 `lost`、buffer 上限 64；selectScrew 溢出走 `statusOverflow` 而非 `statusLost`，won 时算星并刷新 `bestStars`）；`main.tsx`（stats 初值 +bestStars）；`ScrewSortScene.ts`（SceneLabels 换星义词、星级结算同步 overlay、2.5D 高光/投影、拧出 wiggle、溢出轻 shake、缓冲精灵降 alpha）；`PhaserPlayArea.tsx`（去 lost、显示 `bestStars`）；`messages.ts`（去失败化文案）；`PlayArea.scss`（.screw-sort-best）；三处测试适配。审计评级 **核心 B→A、风格 B→B+**。数值仍 [PLACEHOLDER] 待真机 playtest 锁定（见 §4）。
