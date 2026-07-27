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
| 物品层次与质感 | 通过（代码/源图） | 每主题 54 个匹配身份：18 个原创多 mesh PBR 模型/图标基底，每个造型有 3 个独立近似身份，共 162 个可匹配身份；近似身份只通过整件物体的材质、主色块和尺寸层级区分，实体和缩略图使用同一逻辑 kind；2026-07-25 三张 4×3 源图和 18 个补充图标同步清理了斜线、十字、徽记、花纹、绳线和点状身份噪声；`surface()` 统一注入 produce/glaze/ceramic/metal/wood/fabric/paper/matte 的程序化中性 albedoMap + normalMap + roughnessMap，模型回归覆盖 54 个基底的 skin provenance；瓶/罐底部有厚玻璃与闭合内容物，粽子由三面叶片包裹体与分层材质构成，无 Sprite 假 3D |
| 提示与身份反馈 | 通过（浏览器） | 提示条只说明“高亮了一个可消物品”，目标由本体抬升、放大和发光表达；2026-07-25 当前源不再向物品绘制斜线、十字、圆环或身份徽记 |
| 尺寸一致性 | 通过 | 三主题可见尺度比均 >2、碰撞体尺度比均 >1.8；每主题至少 5 个小件与 2 个大件，圆形、长条、器皿与盒体保持可辨且质量随面积同步变化 |
| 物理密度 | 通过（当前 iOS/Android 模拟器） | L2 起始 54 active、810 reserve；扩大逻辑总量没有扩大同时刚体预算；当前 48 类版本已在 Android Chrome 与 iPhone 17 Pro Safari 的真实 Three.js/Cannon 盘面复核 |
| 长局连续性 | 通过（代码） | 第 9 次抽取触发 9 件底部涌现；L2 总量 864、L3 总量 1,008、后期上限 1,584，运行时活跃刚体上限始终 54；界面直接显示关卡总量和底藏数 |
| 托盘/道具一体化 | 通过 | 单排 7 格托盘与五个道具使用同一主题表面并连续贴底；清除后左压缩，同款新物品自动贴近已有同款，右侧物品平移动画补位 |
| 手机全屏 | 通过 | 308×720 与 390×844 均为完整单屏；390×844 页面实测 `scrollWidth=390` / `scrollHeight=844`，竖屏镜头连续下移但桌面端不偏移 |
| 三主题一致性 | 通过 | 鲜集篮、农庄木箱、夜市灯笼各自拥有独立背景、容器、模型、图标、配色与氛围 |
| 动画反馈 | 通过 | 普通入槽/归组采用 750ms 可读节奏；三件匹配先入槽/归组、240ms 高亮、420ms 清除、460ms 左移补位，总视觉编舞约 1870ms；托盘移动使用 `translate3d`、`will-change`、`contain: layout paint` 和自然 cubic-bezier；3D 按压、飞入托盘弧线、420ms 镜头微震、820ms 颠锅回弹由 `scene-motion.ts` 统一约束，避免跳动、过冲和散落魔法数 |
| 摇动反馈 | 通过（浏览器/Android 模拟器） | 强度 0.65–1.35 映射影响范围、冲量与角速度；当前 48 类 Android 构建收到 4,171 个真实 `devicemotion` 事件，24m/s² 脉冲触发游戏晃动状态；1.35 重甩浏览器测试未见出界 |
| 随机开局 | 通过 | 每局重新抽取主题种类子集、三元组包顺序、位置和朝向；连续两局截图哈希不同 |
| 丰富盘面构成 | 通过（代码/浏览器） | 每主题 54 个身份，每个场景使用不同的 48 个系列；L1 强制大中小各一且轮廓互异，L2 立即跃升为 48 类 / 864 件。54 件首屏由 18 个基础造型组成：14 个小件、2 个中件、2 个大件，先用小件填满层次，再让 30 个后续身份从底部涌现；同轮廓异色身份的实体主色块、真实尺寸和托盘图标保持一一对应。 |
| 可访问交互 | 通过 | 触控/鼠标点选可入槽；键盘 Enter/Space 可抽取最高可用物；状态通过 live region 宣告 |
| iOS Safari 模拟器尺寸 | 当前通过 | iPhone 17 Pro / iOS 26.5 Safari 已在当前源复核完整顶视盘面、单排托盘、连续快速拾取，并通过 DEV-only 主题入口分别冷开鲜集、农庄与夜市；模拟器不能替代实体机运动权限与手感 |
| Android Chrome 真实 3D | 有条件通过 | Android 36 / Chrome 133 模拟器已通过 SwiftShader 冷启动渲染真实 Three.js/Cannon 盘面，当前 54 刚体截图不是 DEV 降级层；后续 CPU 满载发布任务期间 Chrome 记录 GPU channel timeout/SIGTRAP，宿主 GPU 路径仍会出现空白合成，因此模拟器不能替代物理手机性能与稳定性门禁 |
| 道具跨区编舞 | 通过 | Android 实走“移出 3 件到侧架 → 点击第三个同类 → 两个侧架格高亮清除 → 托盘和侧架各自左压缩”；结算后仅保留未匹配物品 |

## 当前回归截图

1. 308×720 参考 / 修改前 / 修改后三联图：`/tmp/zhuada-audit-2026-07-23-pass2/06-reference-before-after.jpg`
2. 308×720 连续拾取并摇晃回稳：`/tmp/zhuada-audit-2026-07-23-pass2/07-after-shake-308x720.png`
3. 390×844 完整单屏：`/tmp/zhuada-audit-2026-07-23-pass2/08-after-390x844-scaled-crop.png`
4. 粽子分层模型：`/tmp/goose-v31-model-motion/05-zongzi-lit-layers-loaded.png`
5. 农庄瓶/罐厚底透明模型：`/tmp/goose-v31-model-motion/07-farm-bottle-loaded.png`
6. 三件匹配高亮、清除、补位：`/tmp/goose-v31-model-motion/22-triple-highlight.png`、`/tmp/goose-v31-model-motion/23-triple-clearing.png`、`/tmp/goose-v31-model-motion/24-triple-compacting.png`、`/tmp/goose-v31-model-motion/25-triple-final.png`
7. iOS Safari 游戏、随机重开与安全区菜单：`/tmp/zhuada-device-qa-2026-07-23/ios/02-game-start.png`、`/tmp/zhuada-device-qa-2026-07-23/ios/08-retry-randomized.png`、`/tmp/zhuada-device-qa-2026-07-23/ios/07-menu-safe-area-fixed.png`
8. Android Chrome 真实 3D 连点、摇动与跨区清除：`/tmp/zhuada-device-qa-2026-07-23/android/16-marker-fix-rapid-picks-settled.png`（历史素材）、`/tmp/zhuada-device-qa-2026-07-23/android/18-shake-settled.png`、`/tmp/zhuada-device-qa-2026-07-23/android/23-remove-shelf-result.png`、`/tmp/zhuada-device-qa-2026-07-23/android/25-cross-zone-settled.png`
9. 同一 L2 连续两次重开的平衡随机组合：`/tmp/zhuada-audit-2026-07-23-pass4/22-balanced-redeal-a.png`、`/tmp/zhuada-audit-2026-07-23-pass4/23-balanced-redeal-b.png`
10. iOS 当前大中小层次：`/tmp/zhuada-audit-2026-07-23-pass4/25-ios-balanced-lan.png`
11. Android 当前 DEV 真实素材降级层点选入槽：`/tmp/zhuada-audit-2026-07-23-pass4/31-android-size-bands.png`、`/tmp/zhuada-audit-2026-07-23-pass4/32-android-after-pick.png`
12. L2 历史 12 类、54 刚体紧凑分层盘面：`/tmp/zhuada-audit-2026-07-23-pass7/02-farm-l2-dense-12types.jpg`
13. L2 54 刚体大中小配比后的桌面 / iOS / Android 实景：`/tmp/zhuada-audit-2026-07-23-pass7/03-farm-l2-balanced-dense.jpg`、`/tmp/zhuada-audit-2026-07-23-pass7/05-ios-pass8-settled.png`、`/tmp/zhuada-audit-2026-07-23-pass7/07-android-pass8-settled.png`
14. 新版 L2 直接显示 `24 类 · 360 件 / 底藏 306 件`：`/tmp/zhuada-audit-2026-07-24-pass9/16-l2-24types-360-visible.png`
15. 新版 L2 连点（4 次 170ms）与同形异色托盘图标：`/tmp/zhuada-audit-2026-07-24-pass9/17-rapid-picks-170ms.png`
16. 新版 L2 满托盘强提示、高亮自救与颠锅后重排：`/tmp/zhuada-audit-2026-07-24-pass9/18-full-tray-rescue-24types.png`、`/tmp/zhuada-audit-2026-07-24-pass9/19-pan-toss-24types.png`
17. iPhone 17 Pro / iOS 26.5 Safari 新版 54 刚体满堆：`/tmp/zhuada-audit-2026-07-24-pass9/20-ios-24types.png`
18. Android 36 / Chrome SwiftShader 冷启动真实 WebGL 满堆与 4 次连续选取后的单排托盘：`/tmp/zhuada-audit-2026-07-24-pass9/26-android-after-search.png`、`/tmp/zhuada-audit-2026-07-24-pass9/27-android-l2-rapid-picks.png`
19. Android 安全来源传感器链路与合批模型复核：`/tmp/zhuada-audit-2026-07-24-pass10-android-merged-low-tier.png`；真实 `devicemotion` 将 `shakeNonce` 从 0 推到 1、强度 1.2367，60 秒补货从 306 降到 216，但 SwiftShader 约 4.5 FPS，不作为真机性能通过证据
20. 48 类 / 864 件 / 底藏 810 件扩容版桌面、iOS 与 Android 真实 3D 盘面：`/tmp/zhuada-audit-2026-07-24-pass12/12-browser-final-48-kinds.jpg`、`/tmp/zhuada-audit-2026-07-24-pass12/04-ios-48-kinds-active.png`、`/tmp/zhuada-audit-2026-07-24-pass12/10-android-48-kinds-active-clean.png`
21. Android 当前扩容版真实点选后托盘状态 `0/7 → 1/7`：`/tmp/zhuada-audit-2026-07-24-pass12/11-android-after-pick.png`；同一构建收到 4,171 个 `devicemotion` 事件，并由 `0:9.8:0 → 24:0:0 → 0:9.8:0` 触发 `The pile got a good shake!`
22. 历史 12 个基础造型首屏重构：参考视频缩略帧与浏览器盘面分别为 `/tmp/zhuada-audit-2026-07-24-pass13/dafbaff250624322fdc1a20b4e5b6e8f.mp4.png`、`/tmp/zhuada-audit-2026-07-24-pass13/05-l2-12-silhouettes.png`；浏览器连续三次拾取进入三个托盘格为 `/tmp/zhuada-audit-2026-07-24-pass13/06-rapid-three-picks.png`
23. 历史 12 造型版本在 iPhone 17 Pro / iOS 26.5 Safari 与 Android 36 / Chrome / SwiftShader 的真实 WebGL 盘面：`/tmp/zhuada-audit-2026-07-24-pass13/10-ios-waited.png`、`/tmp/zhuada-audit-2026-07-24-pass13/12-android-waited.png`；Android 由 UI 树定位 Web View 后实点，托盘 `0/7 → 1/7`：`/tmp/zhuada-audit-2026-07-24-pass13/13-android-after-pick.png`
24. 当前密度/颜色变体浏览器回归：小件主导的 14/2/2 开局与同 kind 的实体/缩略图映射分别为 `/tmp/zhuada-colorway-audit-2026-07-24/01-after.png`、`/tmp/zhuada-colorway-audit-2026-07-24/02-entity-to-tray.png`、`/tmp/zhuada-colorway-audit-2026-07-24/03-near-match-tray.png`
25. 近似身份可读性静态验收：基础物品与两个全身材质/颜色变体在 96px 及托盘尺度下保持原物品轮廓，无额外符号标记：`/tmp/zhuada-audit-current-2026-07-24/05-color-blocks.png`
26. 当前提示反馈与无标记盘面：`/tmp/zhuada-audit-round4-2026-07-25-hint-toast.png`
27. 当前源去除斜线/徽章/印章/细环带类身份噪声后的三主题浏览器回归：农庄 `/tmp/zhuada-audit-followup-farm-marker-clean.png`，鲜集 `/tmp/zhuada-audit-followup-fresh-marker-clean-dense.png`，夜市 `/tmp/zhuada-audit-followup-night-marker-clean-final.png`；提示本体反馈 `/tmp/zhuada-audit-round5-browser-hint.png`
28. 当前夜市快速连续拾取（5 次约 700ms，托盘达到 5/7）：`/tmp/zhuada-audit-followup-rapid-picks.png`
29. Android 36 / Chrome 133 在本次标记清理前的真 Three.js/Cannon 冷启动、点选和颠锅重排参考：`/tmp/zhuada-audit-round5-android-game.png`、`/tmp/zhuada-audit-round5-android-after-pick.png`、`/tmp/zhuada-audit-round5-android-shake4.png`；不作为 digest `e07c55cead1719ae77f1221a5b3ec7a95eac25c7097f518b02cd68bd4f77b875` 的移动端签署，SwiftShader 性能也不作为真机通过证据
30. 当前 digest Android 复跑：密集 WebGL 盘面、首次锅体点选、连续三次快速点选和 Shake 物理重排分别为 `/tmp/zhuada-current-android-after-8s.png`、`/tmp/zhuada-android-pick2.png`、`/tmp/zhuada-android-rapid-picks.png`、`/tmp/zhuada-android-shake2-after.png`；三次快速点选将托盘从 1/7 推到 4/7，Shake 显示 2 秒冷却，crash buffer 为空。该证据覆盖当前模型清理后的 Android 功能路径，不替代 SwiftShader 帧率与真机门禁
31. 2026-07-25 图标源同步清理：三张 4×3 atlas 与 18 个补充 SVG 图标已重新生成并通过透明边界、尺寸、唯一性和全身色块质量门禁；源文件固定在 `art-src/SOURCE_MANIFEST.md`，运行时由 `prebuild` 再生成。当前 atlas 复核图：`/Users/jinghuiliao/git/r3e/neo-miniapps-platform/apps/zhuada-e/art-src/items-farm-kitchen-atlas.png`、`/Users/jinghuiliao/git/r3e/neo-miniapps-platform/apps/zhuada-e/art-src/items-fresh-market-atlas.png`、`/Users/jinghuiliao/git/r3e/neo-miniapps-platform/apps/zhuada-e/art-src/items-night-market-atlas.png`
32. 当前三主题 iOS Safari 蒙皮回归：鲜集 `/tmp/zhuada-ios-fresh-market-2026-07-25.png`、农庄 `/tmp/zhuada-ios-farm-kitchen-2026-07-25.png`、夜市 `/tmp/zhuada-ios-night-market-2026-07-25.png`；DEV-only `simTheme` 会先校验并切换完整主题契约，再启动关卡。
33. 当前 Android Chrome 真 WebGL 交互回归：`/tmp/zhuada-android-settled2.png`、`/tmp/zhuada-android-after-pick.png`、`/tmp/zhuada-android-rapid-picks.png`、`/tmp/zhuada-android-match-settled.jpg`；连续点击无需等待前一次入槽动画，三件同类完成归组、高亮、清除与左压缩。
34. 三主题 QA 初始化竞态修复：修复前 `simTheme` 在保存主题开局后才派发，因进行中保护而被拒绝，三张“主题截图”实际都停留在农庄舞台；修复后主题在 guest engine 和首局创建前完成校验与解析。浏览器三主题分别为 `/tmp/zhuada-theme-stage-audit-2026-07-25/04-fresh-after.png`、`05-farm-after.png`、`06-night-after.png`；iOS 三主题为 `08-ios-fresh.png`、`09-ios-farm.png`、`10-ios-night.png`；Android 当前夜市真 WebGL 与点击后状态为 `16-android-night-settled.png`、`17-android-night-after-pick.png`。

## 未计入设计缺陷的发布设备证据

- iOS `DeviceMotionEvent.requestPermission()` 与 Android `devicemotion` 仍需各一台真机录像。
- 中端真机 60 秒 P95 帧时间、长局内存曲线、真实扬声器/触觉效果仍属于发布验收，不属于本次浏览器视觉 QA。
- 2026-07-24 已在 Codex in-app browser、iOS Safari 模拟器与 Android Chrome/SwiftShader 模拟器复核 54 刚体满堆、连续拾取、摇晃回稳和完整底栏；Android 当前截图来自真实 WebGL/Cannon 画面，不是 DEV 降级层。模拟器 GPU 路径仍不等于物理手机，真机性能录像继续按 Production Readiness 发布门禁收集。
- 2026-07-24 继续复核发现 SwiftShader 的持续帧率不足，已把同材质模型部件合并为每物品 2–7 个运行表面，并加入不减少物品/刚体/规则的低配自适应渲染档。该改动通过几何、材质、双面细节、封底、射线拾取和物理配置回归；模拟器帧率失败仍明确保留，不能替代中端 Android 真机门禁。
- 2026-07-24 的历史 12 造型复核首次截图受宿主高负载影响：iOS 停在加载白屏，Android 出现 Pixel Launcher ANR，均被拒绝。恢复后 iOS 完整渲染；Android SwiftShader 约 65 秒后渲染完整盘面并接受一次真实点击，最终 crash buffer 为空。该恢复证明功能路径，但慢冷启仍不计为性能通过；当前图标/密度源变更后的 Android 复核已在第 30 项补齐，iOS 当前 digest 仍待重跑。
- 2026-07-25 当前源新增 Android DOM 回落暂停/恢复时钟闭环，并把三主题模型的身份表达收敛到轮廓、整件色块、比例和材质：去除斜线/徽章/四角徽记/绳线/细环带类噪声；8 类 finish 已升级为 64×64 平滑 albedo/normal/roughness 三贴图蒙皮，缩略图会分离主体与木柄、金属圈、果梗、陶瓷边等固定材质后再换色。该轮 iOS 三主题截图与 Android 夜市点击截图对应保留的 digest `9b4e8dbaf65f99e6c0035f0652ffa9a5ca6dabd6b1b3d36c2969fa0877cd075b`（214 files），旧的错误主题截图不再作为三主题证明。
- 2026-07-25 后续手机尺寸审计发现固定色相偏移把不同物品集中成紫色/薄荷绿，并会让同类三个大件随机抱团。该轮构建改为按物品家族分布的整件配色、同步重生成 162 张托盘图，把每个开局三件包分散到三个扇区，并优先选择不同产品家族组成密集开局；308×720 证据见 `/tmp/zhuada-material-audit-2026-07-25/05-night-after-palette-308x720.png`、`06-fresh-after-palette-308x720.png`、`08-farm-separated-triples-308x720.png`、`09-farm-tray-consistency-308x720.png`，最终家族多样性截图为 `/tmp/zhuada-material-audit-2026-07-25/22-browser-family-diverse-current-build.png`。该轮生产 digest 为 `6846f6e5717449d3654ce65a1e6c24779a19033947ba143dee663d32e180ff75`（214 files），bundle scan、gzip budget 与 staged host parity 通过。
- 该轮 digest 已在 iPhone 17 Pro / iOS 26.5 Safari 重新渲染真实 L2 WebGL 盘面（`/tmp/zhuada-material-audit-2026-07-25/23-ios-final-current-build.png`）。Android 36 / Chrome 133 同一源状态复跑中，真实 WebGL 在 85 秒后仍为空白，logcat 出现 `GL_INVALID_ENUM`，因此拒绝作为 Android 签署；DEV-only fallback 可见并由 UI 树坐标完成一次拾取，托盘 `0/7 -> 1/7`、crash buffer 为空（`/tmp/zhuada-material-audit-2026-07-25/20-android-fallback-after-pick.png`），只证明规则与输入链，不证明生产 WebGL。
- 2026-07-25 材质细化发现 v2 八类贴图虽然完整，但统一的高强度凹凸会让瓷器、釉面、蔬果和布料都呈现相似的颗粒/编织噪声。v3 改为材质专属响应：瓷釉平滑、金属细拉丝、木材方向纹、布料织物起伏、纸张与蔬果保留低强度自然变化；物理属性回归同时约束 metalness、clearcoat、sheen、roughness 和相对 normalScale。该轮生产 digest 为 `ed472321aeb40631dfc56e9a44d54ac80c54405eabdcd058effe9400f4d05fb2`（214 files）；308×720 开局与 450ms 内连续四次拾取证据为 `/tmp/zhuada-material-refinement-2026-07-25/01-farm-subtle-finishes.png`、`02-rapid-four-picks.png`，iPhone 17 Pro / iOS 26.5 Safari WebGL 为 `03-ios-material-v3.png`。
- 2026-07-25 重新抽取用户参考视频 16 秒与 20 秒帧，确认其关键节奏是“盘面接近清空、短暂露底、随后整层物品从底部涌现”，不是每移除三组就立即小批补齐。当前流式规则因此从 `54→45+9` 改为 `54→18+27`：开场仍有 18 个身份/54 个真实刚体，总量与后续 30 个新身份不变；玩家先挖走 36 件，才会涌出 9 个完整三元组组成的 27 件新层。72 项流式/引擎测试、4,000+1,500 次主/侧平衡模拟、24 关完全信息可解性与生产门禁均通过。当前 digest 为 `eafe1398f05c28da67d7522ddda52d5e28d51b6a7eb12d005905f6e07caa6211`（214 files）；参考帧保存在 `/tmp/zhuada-reference-audit-2026-07-25/05-reference-16.00s.png`、`06-reference-20.00s.png`，当前 54 件开局浏览器证据为 `/tmp/zhuada-reference-refill-2026-07-25/01-opening-54.png`，同一源码的 iPhone 17 Pro / iOS 26.5 Safari WebGL 证据为 `/tmp/zhuada-reference-refill-2026-07-25/02-ios-current-deep-refill.png`。
- 2026-07-25 材质蒙皮继续升级为 v4：同一 finish 不再让全部物品共用一张中性贴图，而是按物品主色稳定派生 6 组独立皮肤相位；果蔬表皮、釉面橘皮、陶瓷烧制云纹、金属拉丝、木纹、布料经纬和纸纤维分别拥有可见的微结构。自定义粽叶三角面补齐 UV，所有 162 个身份的可见生产表面均通过 albedo/normal/roughness/UV/不透明性回归。农场线团移除易被误读成额外斜线标记的长针，改由完整球形、宽纤维层与自然拖尾形成身份。Android Emulator OpenGL ES Translator 会被生产运行时自动识别并切换至真实素材、权威状态驱动的兼容物品堆。完整发布门禁、186 项主逻辑测试、45 项场景/物理测试、5 轮随机引擎复跑与 4,000+1,500 次平衡模拟通过；当前 digest 为 `3125d989ff5a3babd1fe5c8c46878e54551975e85bb3f0abf5ac8ff1b619b114`（214 files）。iOS 三主题与夜市拾取证据为 `/tmp/zhuada-device-v4-2026-07-25/ios-fresh-market.png`、`ios-farm-kitchen.png`、`ios-night-market-current.png`、`ios-night-market-picked.png`；Android 三主题与拾取证据为 `/tmp/zhuada-device-v4-2026-07-25/android-fresh-market.png`、`android-farm-kitchen.png`、`android-auto-fallback-v2.png`、`android-auto-fallback-picked.png`。物理 Android 真机 WebGL、音频、触觉和动作传感器仍是独立发布门禁。
- 2026-07-25 当前运行审计发现点击白色圆盘后托盘进入红色果酱罐：较大的隐形交互代理可能先于另一物品的真实可见表面命中射线。拾取规则现改为始终优先最近的可见 authored surface，仅在射线没有命中任何真实表面时才使用空心物品的代理体。390×720 Chrome 复验中，粉色陶碗进入同一粉色陶碗缩略图；第二关四次无等待点击在约一秒内全部受理，托盘显示汤面碗、竹杯、莲花灯和小鼓；Shake 后 54 件物品位置和朝向明显重排。证据为 `/tmp/zhuada-current-audit-2026-07-25/03-farm-pick-fix-before.png`、`04-farm-pick-fix-after.png`、`08-night-l2-clean.png`、`09-night-l2-rapid-picks.png`、`10-night-shake-mid.png`。完整发布门禁、186 项主逻辑测试、47 项场景/物理测试、82 项发布契约测试、4,000+1,500 次平衡模拟、资源/包体/宿主同步均通过；当前 digest 为 `fd160286e8dfe8e4d2cb0ff201ea86478d3c8f593d747eaa22581880c7e091dc`（214 files）。该 digest 尚未重跑 iOS/Android 模拟器，且夜市 L2 首屏薄荷绿与浅色物品比例仍偏高，继续保留为视觉分布优化项。
- 2026-07-25 首屏视觉分布与材质继续细化：18 个开局身份仍由 12 种造型、6 对近似身份、14/2/2 小中大配比随机组成，但 treatment 选择会在每次新局内优先覆盖至少 7 个宽色相家族并限制单色桶拥挤；三主题 × 48 个随机种子回归覆盖该约束。v5 蒙皮提高八类 finish 的可见色素层次、法线起伏和粗糙度差异，并加入木材/纸张暖纤维、瓷釉/金属冷高光、果蔬皮肤的材质专属通道变化，不绘制斜线、徽章或额外身份标记。390×720 夜市与鲜集证据为 `/tmp/zhuada-color-balance-2026-07-25/01-night-market-l2.png`、`03-fresh-market-skin-v5.png`；材质/模型、色彩分布、162 张唯一缩略图、资源、包体和宿主同步门禁通过。当前 digest 为 `ba756178e089426107dcde969e97572570a8a76246b34c36c35379efdda427ab`（214 files），保留的 iOS/Android 模拟器证据仍只签署 `3125d989ff5a3babd1fe5c8c46878e54551975e85bb3f0abf5ac8ff1b619b114`，当前 digest 需重跑两端模拟器。
- 2026-07-25 手机俯视复核进一步确认：薄片、楔形、纸包和浅托盘若卡在侧面，会只剩矩形边缘，视觉上像“实体与缩略图不一致”。当前物理规则新增 broad-face rest：薄物体随机落下时以小角度入场，接近休眠且仍侧立时施加受限角速度回正；不直接改 quaternion，不锁定朝向，邻近碰撞可阻挡，Shake 仍能翻转。iPhone 17 Pro / iOS 26.5 Safari 三主题当前源码证据为 `/tmp/zhuada-mobile-v5-2026-07-25/03-ios-fresh-readable-rest.png`、`04-ios-farm-readable-rest.png`、`05-ios-night-readable-rest.png`；鲜集一次真实点选与同身份托盘入槽见该目录 `01-ios-fresh.png` 后的运行状态。83 项发布契约、33 项本轮材质/拾取/物理测试、TypeScript、ESLint、资源、生产包扫描、gzip 预算和宿主同步通过，digest 为 `f010b6505257a9bdc174a1541a33cf8e1cd6f240896b16c9e0418ba30871e3da`（214 files）。Android 36 冷启动出现 System UI 与 Google Play Services ANR，拒绝为当前 digest 签署；其旧 v4 证据继续仅签署 `3125d989ff5a3babd1fe5c8c46878e54551975e85bb3f0abf5ac8ff1b619b114`。
- 2026-07-25 当前农场开局复核发现圆形壶身的旧侧视把手会从俯视角坍缩成一条黑线，壶体翻到底面时又只剩白色圆底与黑点，容易被误读成水果或额外标记。本轮把水壶重构为三维提梁、弯曲壶嘴、浅色壶盖场和珐琅盖圈；提梁同时跨越 X/Z 轮廓并在 Y 轴拱起，所以正放、侧卧和滚动中都保留真实结构。水壶、碗、杯和锅在接近休眠时还会收到受限的 authored-top 角速度校正，不修改 quaternion、不锁定旋转，碰撞与 Shake 仍可推翻。浏览器证据 `/tmp/zhuada-product-audit-2026-07-25/01-kettle-silhouette-fixed.png` 显示红色壶的把手和壶嘴可读，`02-kettle-tray-match.png` 证明红壶与托盘缩略图一致，`03-rapid-three-picks.png` 证明随后两个无等待点击均被接受并形成 3/7 托盘。31 项模型/物理测试、84 项发布契约、TypeScript、ESLint、186 图像与 15 PCM 音频资源、生产包扫描、gzip 预算及 214 文件宿主同步均通过；当前 digest 为 `40d2404813c610435653c19c76cc762256a33dc774edd923108394faff415f51`。该几何变更后的 iOS/Android 模拟器仍需重新签署。

P0: 0
P1: 1（Android 真实 WebGL 需真机关闭）
P2: 0

final result: conditionally passed — Android physical-device WebGL remains open
