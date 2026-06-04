# Oracle Seal Console Frontend Validation

Date: 2026-06-01 Asia/Shanghai

Scope:
- Host detail page: `platform/host-app/pages/miniapps/[id].tsx`
- Action console: `platform/host-app/components/OperationPanel.tsx`
- Oracle play area: `platform/host-app/components/playarea/PlayAreaOracle.tsx`
- Morpheus confidential store proxy: `platform/host-app/pages/api/morpheus/confidential/store.ts`
- Private transfer store handling: `platform/host-app/components/playarea/PlayAreaPrivateTransfer.tsx`

## Findings Fixed

1. Local Oracle actions were presented like wallet-required transactions.
   - Before: Oracle Seal Console showed `Wallet Required` and asked users to connect a wallet, even though `sealOracleRequest` is a frontend-local Morpheus sealing preview.
   - After: active frontend-local operations show `Local Preview`, suppress the network safety transaction badge, and explain that no wallet is required.

2. Mobile Action Console was less informative than desktop.
   - Before: the mobile action sheet had the no-wallet text, but lacked the same status badge as the desktop console.
   - After: the mobile sheet header shows the same `Local Preview`, `Wallet Ready`, or `Wallet Required` badge.

3. Morpheus confidential store unavailability appeared as a browser/API failure.
   - Before: upstream storage rejection surfaced as a 401 response in the browser console, even though inline encrypted fallback is acceptable for this preview flow.
   - After: the host API returns a 200 `inline_fallback` envelope when upstream store rejects the request, avoiding noisy failed-resource errors while preserving `store_available: false` and the upstream status.

4. Oracle privacy copy implied a hard requirement instead of a resolved network-key flow.
   - Before: `Morpheus public key required`.
   - After: `Morpheus public key is fetched from the selected network`.

## Browser Validation

Desktop, `1440x1100`:
- URL: `http://127.0.0.1:3000/miniapps/oracle-seal-console?network=testnet`
- Operated the frontend controls: filled payload `{"subject":"neo-price","secret":"sample"}` and clicked `Seal Payload`.
- Result URL included `operation=sealOracleRequest`.
- Result contained:
  - `status: sealed_inline`
  - `encryption: X25519-HKDF-SHA256-AES-256-GCM`
  - `store_status: Morpheus store unavailable; encrypted payload kept inline.`
  - `public_key_contract: 0x4b882e94ed766807c4fd728768f972e13008ad52`
- UI checks:
  - `Local Preview`: present
  - No-wallet service-context text: present
  - Old wallet-required prompt: absent
  - Old privacy text: absent
  - Horizontal overflow: `0`
  - Browser console issues: none
  - Failed responses: none
- Screenshot: `docs/reports/oracle-seal-console-local-preview-final.png`

Mobile Action Sheet, `390x844`:
- Opened the mobile Action Console from the bottom dock.
- UI checks:
  - `Local Preview`: present
  - No-wallet service-context text: present
  - `Wallet Required`: absent
  - Connect-wallet prompt: absent
  - Privacy key text: present
  - Horizontal overflow: `0`
  - Browser console issues: none
  - Failed responses: none
- Screenshot: `docs/reports/oracle-seal-console-mobile-drawer-final.png`

Mobile submit flow, `390x844`:
- Opened the mobile Action Console, filled the same payload, clicked `Seal Payload`, and waited for `sealed_inline`.
- Result URL included `operation=sealOracleRequest`.
- Result contained the same inline encrypted fallback and Morpheus testnet public-key contract.
- UI checks:
  - Old wallet-required prompt: absent
  - Old privacy text: absent
  - Horizontal overflow: `0`
  - Browser console issues: none
  - Failed responses: none
- Screenshot: `docs/reports/oracle-seal-console-mobile-final.png`

## Automated Validation

Command:
```bash
npm test -- --runInBand __tests__/api/morpheus.confidential.store.test.ts __tests__/pages/miniapps.shared-invoke.test.tsx __tests__/components/OperationPanel.test.tsx __tests__/components/PlayAreaRegistry.test.tsx
```

Result:
- 4 test suites passed
- 90 tests passed
- Non-failing existing React `act(...)` warning remains around the OneGate QR effect.

Command:
```bash
npm run typecheck
```

Result:
- Passed.

## Transaction Note

`sealOracleRequest` is intentionally a frontend-local confidential sealing preview, not an on-chain transaction. This validation operated the real frontend controls and real Morpheus-facing host APIs on Neo N3 Testnet service context. It fetched the testnet Morpheus public key and handled storage unavailability with an explicit inline encrypted fallback. No wallet signature or testnet transaction was required for this specific operation.
