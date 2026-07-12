# Oracle NeoDID Console

Oracle NeoDID Console 是 Morpheus NeoDID 的只读证据检查器。主操作会解析受支持的 DID，读取当前启动网络的提供方目录，并将解析器声明的注册表锚点与 Neo 网络的规范部署进行核对。

它**不会**验证身份、证明声明、验证签名、分发 Oracle 任务、连接钱包或广播交易。返回的 DID 文档、提供方/声明目录匹配以及声明的 Oracle 网关都只是元数据观察。

## 产品流程

1. 在 Neo N3 主网或测试网启动。
2. 直接点击 **解析 DID**，检查默认 NeoDID 服务标识。
3. 在主证据图中查看文档、注册表部署、目录上下文与 Oracle 服务声明。
4. 只有在需要精确的服务、Vault、AA DID 或提供方上下文时，才打开 **检查详情**。
5. 复制完整 JSON 快照供下游复核。

最新结果会在十五分钟后过期，即使小程序一直保持打开也会自动清除。复制前还会再次检查过期时间，因此不会在界面刷新间隔内导出陈旧快照。只有摘要校验通过且与当前启动网络一致的证据才能恢复。中断的解析器 GET 可在五分钟内恢复；任何失败都会先清空旧快照再显示错误。

## 网络真值

- 主网通过只读 RPC 检查网络 Magic `860833102`、规范 NeoDID 合约 `0xb81f31ea81e279793b30411b82c2e82078b63105` 以及清单名称 `NeoDIDRegistry`。
- 测试网会先验证网络 Magic `894710606`，再报告规范 Morpheus 注册表没有 NeoDID 合约；若解析器在该网络声明了锚点，则明确显示为不匹配。
- 同源提供方接口可能返回运行时目录，也可能返回空的宿主降级结果。目录中列出的提供方/声明仍不等于已完成证明。
- DID 服务、验证方法、提供方标识、别名与声明列表都会按有界结构严格解码；畸形或有歧义的返回会降级为不可用，不会被过滤成看似正常的证据。
- 只有本地存储写入和删除回读都成功时，界面才会显示可恢复；存储不可用时仍可完成解析和复制 JSON。

## 本地验证

```sh
npm exec tsc -- --noEmit -p tsconfig.json
npm run build
npm exec eslint -- src
```

专项仓库测试位于 `apps/shared/test/oracle-neodid-console.*.test.*`；可在 `apps/shared` 下运行 `npx vitest run test/oracle-neodid-console.*.test.*`。
