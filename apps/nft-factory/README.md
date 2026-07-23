# NFT Collection Studio / NFT 藏品工作室

## English

NFT Factory is a production-facing NEP-11 collection-package studio built on
the platform's governed Factory runtime. The collection artwork and live card
are the primary surface; name, edition size, royalty, and transfer policy
update that object directly. Network, metadata origin, and owner controls
remain in a progressive provenance drawer.

The current v1 template does not define trait fields or a primary mint price.
Those fields stay out of the visible workflow and out of the release package.
Creators can choose a real PNG, JPEG, WebP, or AVIF file for the live card, but
that browser-local preview is not uploaded, pinned, or included in the package.

### Current creator flow

1. Shape the collection and collector preview.
2. Open **Provenance & ownership** to review the network, HTTPS metadata base
   URI, and owner.
3. **Verify & lock package** validates the inputs, reads token #1 JSON from the
   supplied metadata origin, reads the testnet Factory template, and creates a
   deterministic digest. The metadata read proves current availability and
   basic shape only; it does not make remote content immutable.
4. The matching owner wallet may sign one exact creator commitment containing
   the testnet, Factory contract, template, package id, digest, and canonical
   collection payload. A completed package is not signed twice, concurrent
   clicks open only one wallet request, and a wallet/network/package change
   while signing invalidates the returned signature.
5. **Deployment locked** remains disabled in this release. The deployed testnet
   Factory ABI does not expose `deployArtifactFromTemplate`, while the NEP-11
   template is metadata-only (`HasArtifact = false`). Calling the legacy route
   cannot create a usable collection contract.
6. The creator-specific NEF/manifest package and exact six-argument call are
   generated locally. A complete deployment lane still requires an upgraded
   Factory, registration of the exact governed artifact, transaction
   persistence, event confirmation, and non-zero deployment-record readback.
   This release sends no deployment or mint transaction and never fabricates a
   contract hash.

When the RPC cannot verify the template, the user can regenerate to retry the
read. Whether the registry reports metadata-only or a stored artifact, the app
still exposes only the deterministic export/sign path until the live ABI,
governed artifact, and matching readback/recovery flow are certified.

Visual provenance is recorded in
[ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md), and dated network facts are
recorded in [NETWORK_STATUS.md](./NETWORK_STATUS.md).

### Production checks

```bash
npm run build
npx tsc --noEmit -p tsconfig.json
cd ../shared
npx vitest run test/nft-factory.production.test.ts test/factory-playarea.test.tsx test/factory-runtime.test.ts test/factory-plans.test.ts
```

## 中文

NFT Factory 是基于平台受治理 Factory runtime 的生产级 NEP-11 藏品发行包工作室。
藏品图像和实时卡片是主界面；名称、发行规模、版税与转让策略会直接更新这件
藏品。网络、元数据来源与 Owner 等高级参数收进渐进式“来源与所有权”抽屉。

当前 v1 模板并未定义属性字段或一级铸造价格，因此界面与发行包都不会展示
看似可用、实际却不生效的装饰性控件。

本地 PNG、JPEG、WebP 或 AVIF 作品可用于实时卡片预览，但不会上传、固定或写入
发行包。

### 当前创作流程

1. 先塑造藏品并检查收藏者预览。
2. 打开**来源与所有权**，复核网络、HTTPS 元数据基础 URI 和 Owner。
3. 点击**核验并锁定发行包**，校验参数、读取元数据来源中的 Token #1 JSON、
   读取测试网 Factory 模板，并生成确定性摘要。元数据读取仅证明当前可用性与
   基础结构，不会使远程内容不可变。
4. 匹配的 Owner 钱包可以签署一份精确的创作者承诺，内容包含测试网、Factory
   合约、模板、发行包 ID、摘要与规范化藏品载荷；已完成的发行包不会重复签名。
5. 本版本的**部署已锁定**始终保持禁用。已部署的测试网 Factory ABI 并不包含
   `deployArtifactFromTemplate`，同时 NEP-11 模板仅有元数据
   (`HasArtifact = false`)；旧调用无法创建可用的藏品合约。
6. 本地已经生成创作者独立 NEF/manifest 发行包与精确六参数调用。完整部署流程
   仍需升级 Factory、注册精确受治理工件、实现交易持久化、事件确认与非零部署
   记录回读。本版本不会发送部署或铸造交易，也不会伪造合约地址。

如果 RPC 无法验证模板，用户可以重新生成计划重试读取。无论注册表当前显示
仅元数据还是已有工件，在链上 ABI、受治理工件及其回读/恢复流程完成认证前，
应用都只提供确定性的导出/签名路径。

视觉资源的生成来源与使用边界记录在
[ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)。当前链上工件状态记录在
[NETWORK_STATUS.md](./NETWORK_STATUS.md)。旧的 `ATTRIBUTION.md` 与
`TESTNET-STATUS.md` 文件名继续保留，方便已有复核记录引用。
