# 鹅篮翻翻乐设计 QA

## 对照范围

- 参考：用户提供的 308×720 玩法视频，主基准帧为 24 秒满堆状态。
- 实现：308×720 与 390×844，L3、三个主题、托盘入槽/三消/补位的真实浏览器状态。
- 比较方法：将参考帧与实现截图放入同一张同视口对照图，再检查构图、密度、层级、控件、材质和动作连续性。

## 结果

| 检查项 | 结果 | 证据 |
|---|---|---|
| 顶视与可读性 | 通过 | 三个容器均为近垂直顶视；边缘不遮挡主体；可见表面可直接点选 |
| 主容器比例 | 通过 | 308px 视口中容器占宽约 93%–96%，与参考 95%–98% 同一量级 |
| 物品层次与质感 | 通过 | 每主题 12 个多 mesh PBR 模型；瓶/罐底部有厚玻璃与闭合内容物，粽子由叶片、折痕、叶脉、绳结和尾绳构成，无 Sprite 假 3D |
| 尺寸一致性 | 通过 | 过大的茶罐/帆船已缩小并同步碰撞体；圆形、长条、器皿与盒体保持可辨但不抢画面 |
| 物理密度 | 通过 | 初始可见约 35–45 件；48 active、162 reserve；底部补货时上层受碰撞推挤重排 |
| 长局连续性 | 通过 | 第 6 次抽取触发 9 件底部涌现；L3 总量 210，运行时活跃刚体上限 54 |
| 托盘/道具一体化 | 通过 | 单排 7 格托盘与五个道具使用同一主题表面并连续贴底；清除后左压缩，同款新物品自动贴近已有同款，右侧物品平移动画补位 |
| 手机全屏 | 通过 | 390×844：canvas 708px、工具栏底部 842px、页面 `scrollWidth=390` / `scrollHeight=844` |
| 三主题一致性 | 通过 | 鲜集篮、农庄木箱、夜市灯笼各自拥有独立背景、容器、模型、图标、配色与氛围 |
| 动画反馈 | 通过 | 普通入槽/归组采用 692ms 可读节奏；三件匹配先入槽/归组、240ms 高亮、420ms 清除、460ms 左移补位，总视觉编舞约 1812ms；托盘移动使用 `translate3d`、`will-change`、`contain: layout paint` 和自然 cubic-bezier；3D 按压、飞入托盘弧线、420ms 镜头微震、820ms 颠锅回弹由 `scene-motion.ts` 统一约束，避免跳动、过冲和散落魔法数 |
| 摇动反馈 | 通过（浏览器） | 强度 0.65–1.35 映射影响范围、冲量与角速度；1.35 重甩保持 60 FPS 且未见出界 |
| 随机开局 | 通过 | 每局重新抽取主题种类子集、三元组包顺序、位置和朝向；连续两局截图哈希不同 |
| 可访问交互 | 通过 | 触控/鼠标点选可入槽；键盘 Enter/Space 可抽取最高可用物；状态通过 live region 宣告 |

## 当前回归截图

1. 参考动作序列与实现四阶段对照：`/tmp/goose-v31-model-motion/26-reference-vs-prototype-motion.jpg`
2. 粽子分层模型：`/tmp/goose-v31-model-motion/05-zongzi-lit-layers-loaded.png`
3. 农庄瓶/罐厚底透明模型：`/tmp/goose-v31-model-motion/07-farm-bottle-loaded.png`
4. 托盘首次入槽左对齐：`/tmp/goose-v31-model-motion/09-tray-pick-1.png`
5. 同款第二件相邻归组：`/tmp/goose-v31-model-motion/10-tray-pick-2.png`
6. 三件匹配高亮、清除、补位：`/tmp/goose-v31-model-motion/22-triple-highlight.png`、`/tmp/goose-v31-model-motion/23-triple-clearing.png`、`/tmp/goose-v31-model-motion/24-triple-compacting.png`、`/tmp/goose-v31-model-motion/25-triple-final.png`

## 未计入设计缺陷的发布设备证据

- iOS `DeviceMotionEvent.requestPermission()` 与 Android `devicemotion` 仍需各一台真机录像。
- 中端真机 60 秒 P95 帧时间、长局内存曲线、真实扬声器/触觉效果仍属于发布验收，不属于本次浏览器视觉 QA。
- 2026-07-11 当前 Codex in-app browser URL policy 阻止本轮重新访问 `localhost:4173`，所以本轮新增的是代码/测试级动画闸门；真机与可控浏览器性能录像仍按 Production Readiness 发布门禁收集。

P0: 0  
P1: 0  
P2: 0

final result: passed
