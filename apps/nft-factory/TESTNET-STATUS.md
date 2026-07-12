# Neo N3 testnet status / Neo N3 测试网状态

Checked on 2026-07-11 against the app-configured Factory contract:

- Network: Neo N3 testnet
- RPC: `https://api.n3index.dev/testnet`
- Factory: `0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49`
- Contract name: `MiniAppFactory`
- Deployed ABI: legacy Factory methods are present, but
  `deployArtifactFromTemplate` is **absent**
- Template: `tpl.nep11.collection.v1`
- `getTemplate`: `HALT`
- Template registered: yes
- `HasArtifact`: **false**
- `deploymentCount`: `1`
- Existing record: an NEP-17 test record with a zero deployed hash; it is not
  evidence of an NFT contract deployment.
- Legacy shared sample metadata:
  `https://assets.neomini.app/nft/neo-builder-pass/` and token `.../1` both
  return HTTP 404. v1.2.0 removes that seed and starts with an empty metadata
  origin unless the launch context supplies one.

## Product consequence

The NFT collection studio, token #1 metadata read, deterministic digest,
export, and owner-wallet signature path can be exercised, but real collection
deployment must remain disabled. Calling `deployFromTemplate` while
`HasArtifact` is false would create at most a registry record and no usable
NEP-11 contract. The deployed ABI also lacks the creator-artifact method needed
for a package-bound artifact lane.

The complete testnet path therefore needs more than admin registration: the
Factory contract must first be upgraded with a reviewed creator-artifact ABI.
NFT Factory must then generate a creator-unique NEF + manifest, bind those
exact bytes and init params to the package, persist the broadcast transaction,
and accept success only after the expected event and
`getDeployment(packageId)` return a non-zero deployed hash. None of those write
operations are exposed by v1.2.0.

## 产品结论

当前可以验证 NFT 藏品编辑、Token #1 元数据读取、确定性摘要、导出与钱包签名
流程，但必须继续阻止真实集合部署。`HasArtifact` 为 false 时调用
`deployFromTemplate`，最多只会留下注册记录，不会得到可用的 NEP-11 合约；
已部署 ABI 同时也缺少发行包绑定工件所需的创作者工件方法。

因此，完整测试网流程不仅需要管理员注册。Factory 合约需要先升级并提供经过
复核的创作者工件 ABI；NFT Factory 再生成创作者独立 NEF + manifest，将精确
字节与初始化参数绑定进发行包，持久化广播交易，并且只有预期事件与
`getDeployment(packageId)` 都回读出非零合约地址后才接受成功。v1.2.0 不会
暴露这些写操作。
