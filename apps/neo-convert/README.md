# Neo Convert

Neo Convert is a browser-side Neo N3 key and script workbench.

## What it does

- Generates a new Neo N3 account in the current browser session.
- Converts a WIF, private key, compressed public key, or Neo N3 address into the formats that can be derived from it.
- Converts a Neo N3 address to script-hash display and VM byte order.
- Disassembles Neo N3 VM script hex with operand-aware framing.
- Exports an explicitly revealed generated account as a paper-wallet PDF.

Private source material and derived private values are masked by default and are not persisted by the app. Copy and PDF export remain explicit user actions. Generation, conversion, disassembly, and PDF creation do not send key material to a server.

The optional connected-wallet balance integration performs read-only Neo RPC requests. Neo Convert does not place key fields or generated secrets in its analytics calls or storage APIs.

## Product flow

1. Paste one supported value into the compact source field. It stays masked unless **Show source material** is explicitly selected.
2. Run **Convert** or press Enter. A new edit immediately invalidates the previous result, so old output is never presented as belonging to new input.
3. Open **Inspect** for the complete derived output. Public values can be copied directly; WIF/private-key output requires an explicit reveal.
4. Use **Generate New Account** for a separate local generation flow. The address appears immediately while private values stay hidden.
5. Reveal is required before paper-wallet export. **Clear sensitive session data** removes the source, derived values, generated account, reveal state, and inline copy feedback.

## Runtime truth

- No miniapp contract is deployed and no transaction is submitted.
- Wallet connection is optional and is used only for the separate read-only balance integration.
- Generated accounts live in memory for the current app session; refreshing discards them unless the user exported or copied them.
- Explicitly copied values remain in the operating-system clipboard, and an exported PDF remains in the chosen download location; clearing the workbench cannot remove either external copy.
- Address decoding accepts the Neo N3 address version only.
- Private scalars and compressed public keys are curve-validated before derivation.
- Script disassembly follows Neo N3 opcodes, including PUSHDATA, PUSHINT, jumps, and SYSCALL operands; truncated operands are rejected rather than displayed as valid instructions.
- Scripts are capped at 65,536 bytes to keep the browser workbench responsive.
- The complete source field is bounded before format detection, including non-hex pastes, so an invalid payload cannot monopolize the local workbench.
- Connected-wallet NEO/GAS balances are read from raw base units and formatted at protocol decimals. A wallet switch clears the old snapshot immediately, and any late response from the replaced address is discarded.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for the no-contract/network boundary and [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md) for runtime media provenance.

## Development

```bash
npm run build --prefix apps/neo-convert
npx tsc --noEmit -p apps/neo-convert/tsconfig.json
cd apps/shared
npx vitest run test/neo-convert.playarea.test.tsx test/neo-convert.integration.test.tsx test/neo-convert.address.test.ts test/neo-convert.disassemble.test.ts test/neo-convert.production.test.ts
```

## Version

Current frontend and manifest version: `1.1.0`.
