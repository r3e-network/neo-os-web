# OneGate / NEP-21 全量验证

验证时间：2026-07-24（Asia/Shanghai）

## 结论

- 77/77 个 source miniapp manifest 均具备 standalone dApp 入口、唯一 OneGate ID，并接入共享的 NEP-21/OneGate runtime；需要钱包能力的页面通过该路径请求钱包。
- 77/77 个 app/game 构建成功并同步到 `platform/host-app/public/miniapps`。
- 77/77 个 standalone 页面在 OneGate-compatible NEP-21 Browser Mock 中加载通过；最新运行记录 138 次 dAPI 调用，其中 21 个页面实际触发钱包交互。
- OneGate 官方 Browser Mock 也成功启动 `unbreakable-vault`，确认 provider 注入、NEP-21 兼容声明、页面内容和 offline 交易边界。
- OneGate Vault 参考链路、host adapter、NEP-21 adapter、Vault API 和共享 wallet SDK 定向回归全部通过。

### 当前工作树复核补充

- 规则去重后的最新独立 miniapp 套件为 **24/24**；`zhuada-e` 的 16 个测试文件、185 个测试，以及完整资源/发布门禁均通过。模型模板现在按材质特征合并并限制每个模板最多两个 shadow casters；夜市粽子模型复用叶片材质以满足移动 draw-call 预算。

### 当前运行复核（2026-07-24）

- 本地 Host 静态产物复核为 **77/77** OneGate Mock 页面通过，记录 **138** 次 dAPI 调用、**21** 个钱包交互；这覆盖了当前工作树生成的全部入口。
- 同时对 `https://neomini.app` 做了只读在线复核，结果为 **60/77**；16 个入口返回远端静态资源 404，`asset-factory` 返回 host shell 泄漏。对应本地入口均通过，因此这是部署/同步状态阻塞，不是当前源码的 OneGate/NEP-21 加载失败；远端发布完成前不能宣称线上 77/77。

## 自动化证据

| Gate | Result |
| --- | ---: |
| `verify:miniapp-dapps` | 77/77, 0 failures |
| `audit-onegate-nep21-coverage.mjs` | 943 checks, 0 failures, 1 manual-review warning |
| per-miniapp test suites (current validation) | 24/24 suites passed |
| `build:miniapp-dapps` | 77/77 builds passed |
| standalone OneGate page load | 77/77 passed |
| current local Host OneGate Mock reload | 77/77 passed, 138 dAPI calls, 21 wallet flows |
| current `https://neomini.app` online reload | 60/77 passed; 16 remote 404s and 1 host-shell leak |
| `@neo-miniapp/sdk` tests | 70/70 passed |
| host OneGate/Vault tests | 42/42 passed |
| shared OneGate/NEP-21 tests | 45/45 passed |
| zhuada-e production/staged gates | passed |

## 修复项

- `scripts/verify-onegate-miniapp-loads.mjs` 不再把 app 自己的 `nav` 误判为 host shell，并补充 NeoDID provider API mock。
- `apps/zhuada-e/src/logic/public-asset-url.ts` 统一按 standalone 文档基址解析生产资源；修复 OneGate standalone 下主题图片从 `assets/art/*` 错误解析导致的 404。
- zhuada-e 的主题、托盘、鹅像、Three.js 容器纹理和音频资源均走同一生产资源解析规则。
- `apps/zhuada-e/scripts/generate-art.mjs` 现在按基础物体的 HSL 明暗与色彩细节生成全身色变体；162 个 runtime item icon 的可见性、唯一性和全身色差门禁均通过。
- zhuada-e 发布审计已同步当前 full-body colorway 测试契约，独立发布/资源门禁与根目录 24/24 miniapp 套件均通过。
- `PlatformRegistry` 现在要求所有 engine-bound 注册/attach 具备 reciprocal AA core，并在 engine 外部调用前物化唯一共享账户；lite directory row 仍可兼容无 core 启动。`MiniAppCreditLedger.cs` 统一 PlatformRegistry、EngineBase、PlatformSocial、PlatformDeFi、PlatformAnchor、PlatformVesting、PlatformEscrow 的 credit/liability 增减，并统一 `:credit`/`:fund` memo 路由；保留现有 appId、资产、memo 和存储前缀，合约回归 **633/633** 通过。
- `MiniAppHouseGameBase.ValidateDeposit` 现在复用 DevPack 的 NEP-17 memo 解码，不再把 ByteArray 回调强制转换为 String；CoinFlipV2 与 DiceV2 的当前 NEF 行为回归覆盖 **16/16**，保留原有 fund/bet/stake memo 语义。

### 2026-07-25 增量

- `MiniAppMoneyBase.CreditGasDeposit` 现在与 Compact/HouseGame 共享 String/ByteString memo 解码；`MiniAppMoneyBaseFixture` NEF 重建成功，TestEngine `MiniAppMoneyBaseTests` **5/5** 通过，确认 OneGate 常见 ByteArray NEP-17 callback 能进入同一 GAS credit ledger。
- `PlatformEscrow` 增加保留单创建者路径不变的 bounded M-of-N milestone approval；多方审批、重复审批拒绝、阈值前不可领取、阈值达成后领取的 TestEngine 回归 **7/7** 通过，框架多方参数编码回归 **6/6** 通过，接口审计更新为 **18/18**。
- 增量复核仍为 OneGate coverage **77/77**、DApp support **77/77**、platform engine conformance `complete`、contract acceptance 命令成功；`git diff --check` 通过。
- 源码盘点仍发现 **30** 个 legacy contract 文件直接使用 `(string)data`。这些独立部署合约尚未逐一完成 ByteArray 迁移、NEF 重建、部署记录和 live read-back，因此不能把本次共享 DevPack 修复扩大宣称为 77/77 链上 NEP-17 完整闭环。

## 边界

本次验证没有读取或使用 WIF，没有签名或广播链上交易。Browser Mock 的交易模式是 offline；因此本报告证明的是 OneGate/NEP-21 注入、页面加载、调用编码、资源完整性和错误边界，不等同于已完成真实钱包批准、已资助 testnet 生命周期或生产链上业务闭环。真实 OneGate app 的平台 WebView/钱包批准仍需配对设备后按请求逐项人工批准验证。

当前唯一静态审计 warning 是 `aa-relay-console`：它是只生成/核验 relay review package 的 review-only 控制台，manifest 明确关闭交易提交，因此没有 standalone wallet write path；这不是加载失败，但真实 OneGate host workflow 仍需验证其后续 operator receipt 边界。
