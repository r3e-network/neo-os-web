# Soulbound Certificate — Testnet status / 测试网状态

Last checked / 最近检查：2026-07-12

| Item / 项目 | Status / 状态 |
|---|---|
| Networks checked / 已检查网络 | Neo N3 MainNet + TestNet |
| Contract / 合约 | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` |
| Contract state / 合约状态 | `getcontractstate` returned `MiniAppSoulboundCertificate` from both `https://api.n3index.dev/mainnet` and `/testnet` / 已从主网与测试网 RPC 读回同名合约 |
| Standard / 标准 | Deployed manifest declares `NEP-11` / 部署清单声明 `NEP-11` |
| Core ABI / 核心 ABI | `createTemplate`, `updateTemplate`, `setTemplateActive`, `issueCertificate`, `revokeCertificate`, `transfer`, `ownerOf`, `getTemplateDetails`, `getCertificateDetails` present / 均存在 |
| Events / 事件 | `TemplateCreated`, `TemplateUpdated`, `CertificateIssued`, `CertificateRevoked`, `Transfer` present on both networks / 两个网络均具备这些事件 |
| Read smoke / 只读冒烟 | `getPlatformStats` HALT on both networks (MainNet 1 template / 1 certificate; TestNet 32 / 29 at check time); `getCertificateDetails("1-1")` and `ownerOf("1-1")` HALT and agree on the owner on both networks / 两网只读调用均 HALT，且 Token `1-1` 的详情与持有人读回一致 |
| Local/deployed drift / 本地与部署差异 | The local build additionally exposes base credit-recovery methods; the current UI does not call or depend on them / 本地构建额外包含基础资产额度恢复方法，当前界面不调用也不依赖这些方法 |
| Transfer policy / 转让策略 | Source and contract tests enforce an always-failing soulbound transfer / 源码与合约测试均要求转让始终失败 |
| Fresh write proof / 本轮写入凭据 | Not executed in this UI-polish pass / 本轮前端收口未发起新的写交易 |

## Frontend trust boundary / 前端可信边界

- A filled template or issuance form remains **Preview / Draft**. It is never labelled issued or valid before a verified chain snapshot exists. / 填写完整的模板或签发稿仍然只是“预览 / 草稿”，在获得可信链上快照前不会标记为已签发或有效。
- Verification is accepted only on an explicit mainnet/testnet binding to the canonical registry contract, with the returned token ID matching the request, `ownerOf` matching the certificate owner, and the referenced template readable. / 核验只接受明确网络与规范合约绑定，并要求返回 Token ID 与请求一致、`ownerOf` 与证书持有人一致、关联模板可读。
- If the selected launch network and wallet network disagree, or the wallet is on an incompatible chain, reads and writes fail closed. / 若入口所选网络与钱包网络不一致，或钱包位于不兼容链，读写都会关闭。
- A failed balance or template read is shown as unavailable/partial, never as a trusted zero or an empty wallet. / 钱包余额或模板读取失败时，界面只显示“不可用/部分数据”，绝不会伪装为可信的零值或空票夹。
- A broadcast transaction remains pending until the exact expected event and authoritative state readback match. `verified=true` alone is not enough if the event or readback disagrees. / 广播后的交易会保持待确认，直到预期事件与权威状态读回完全匹配；若事件或读回不一致，仅有 `verified=true` 也不会记为成功。
- Pending recovery is bound to the wallet, explicit network, and canonical contract that broadcast the transaction. Every new template/issue receipt binds all user-authored metadata, and the write is disabled unless that receipt can be persisted across reloads. / 待确认恢复会绑定发起交易的钱包、明确网络与规范合约；新模板与签发凭据会绑定全部用户填写字段，且只有确认恢复凭据能够跨刷新保存后才允许写入。
- Revocation is shown only after exact event matching and a revoked state readback. The token remains in the holder wallet as an auditable revoked record. / 撤销只有在事件匹配并读回已撤销状态后才会展示；Token 仍保留在持有人钱包中作为可审计记录。

## Remaining live validation / 待完成的实网验证

A funded issuer wallet should still run a fresh end-to-end TestNet sequence before a production release: create template → update template → issue certificate → public verify → attempted transfer (must fail) → issuer revoke → public verify as revoked. Record every transaction ID and final state readback. / 正式发布前仍应使用有测试币的发行方钱包完成一次新的测试网闭环：创建模板 → 更新模板 → 签发 → 公开核验 → 尝试转让（必须失败）→ 发行方撤销 → 再次核验为已撤销，并记录每笔交易 ID 与最终状态读回。
