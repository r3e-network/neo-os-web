# Neo Convert

Neo Convert 是在浏览器本地运行的 Neo N3 密钥与脚本工作台。

## 实际能力

- 在当前浏览器会话中生成新的 Neo N3 账户。
- 将 WIF、私钥、压缩公钥或 Neo N3 地址转换为可推导的相关格式。
- 将 Neo N3 地址转换为展示顺序与 VM 字节顺序的脚本哈希。
- 按 Neo N3 VM 的操作数规则反汇编脚本 Hex。
- 对明确显示过密钥的生成账户导出纸钱包 PDF。

私密源材料和派生私密值默认隐藏，应用不会持久化保存密钥。复制与 PDF 导出都必须由用户明确触发。生成、转换、反汇编与 PDF 创建不会把密钥材料发送到服务器。

可选的钱包余额功能会发起只读 Neo RPC 请求。Neo Convert 不会把密钥输入或生成的私密值写入其分析调用或存储 API。

## 使用流程

1. 在主界面的紧凑源输入中粘贴一个受支持的值；除非主动选择“显示源材料”，否则内容保持遮罩。
2. 点击“转换”或按 Enter。只要源内容发生修改，旧结果会立即失效，避免把旧输出误认为新输入的结果。
3. 打开“检查”查看完整派生结果。公开值可以直接复制，WIF/私钥结果必须先主动显示。
4. 点击“生成新账户”进入独立的本地生成流程；地址立即显示，私密值仍保持隐藏。
5. 导出纸钱包前必须先显示密钥。“清除本次会话敏感数据”会清空源内容、派生值、生成账户、显示状态与页面内复制提示。

## 运行事实

- 没有部署 miniapp 合约，也不会提交交易。
- 钱包连接是可选项，只用于独立的只读余额能力。
- 生成账户只存在于当前应用会话内；刷新后会丢失，除非用户已自行导出或复制。
- 主动复制的内容仍会留在操作系统剪贴板，导出的 PDF 也会留在所选下载位置；清空工作台无法删除这些外部副本。
- 地址解码只接受 Neo N3 地址版本。
- 私钥标量与压缩公钥会先完成曲线有效性校验再派生。
- 脚本反汇编遵循 Neo N3 操作码，包括 PUSHDATA、PUSHINT、跳转和 SYSCALL 操作数；截断操作数会被拒绝，不会显示为有效指令。
- 脚本大小上限为 65,536 字节，避免浏览器工作台被超大输入拖慢。
- 整个源输入会在格式识别前限制长度，包括非 Hex 的超大粘贴内容，避免无效输入拖慢本地工作台。
- 钱包 NEO/GAS 余额从原始基础单位读取并按协议精度格式化；切换钱包会立即清空旧快照，并丢弃替换前地址的延迟响应。

无合约与网络边界见 [NETWORK_STATUS.md](./NETWORK_STATUS.md)，运行资源来源见 [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)。

## 开发验证

```bash
npm run build --prefix apps/neo-convert
npx tsc --noEmit -p apps/neo-convert/tsconfig.json
cd apps/shared
npx vitest run test/neo-convert.playarea.test.tsx test/neo-convert.integration.test.tsx test/neo-convert.address.test.ts test/neo-convert.disassemble.test.ts test/neo-convert.production.test.ts
```

当前前端与 manifest 版本：`1.1.0`。
