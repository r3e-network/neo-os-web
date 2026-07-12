# Neo Message

Neo Message is a sealed-mail workspace for Neo X mainnet. It supports two
distinct message products without presenting either one as a generic form:

- **Recipient only** — the encrypted envelope is stored on-chain and the named
  recipient proves wallet ownership before Morpheus decrypts it locally. A
  locally opened note is labelled private and never shown as publicly revealed.
- **Timed reveal** — the envelope stays locked until the chosen time, then an
  on-chain reveal request lets the oracle publish the plaintext to the message
  contract.

The primary surface is a bright physical mail desk built around the real
`sealed-message-desk.webp` scene. The recipient, letter body, delivery route,
and one primary action stay in focus; mode, inbox, outbox, network controls,
and recovery are contained in the secondary drawer.

## Product truth

- Neo X mainnet is the only supported network in this release.
- The zero address is never accepted as a recipient, because it cannot prove
  ownership to open a private note.
- Delivery is successful only after the exact `MessageSent` event yields a
  message ID and `getMessage` confirms sender, recipient, unlock time, and a
  valid on-chain timestamp.
- A broadcast that cannot yet be confirmed becomes a durable recovery item and
  blocks duplicate sends. Recovery binds the receipt to the exact transaction,
  sender, message contract, event topic, and authoritative contract readback.
- Switching accounts clears the visible mailbox before the new account loads,
  so private-open content from the previous wallet is never shown under the
  next wallet.
- Inbox/outbox refresh preserves the last known list when any message read
  fails; an incomplete read is never rendered as an empty mailbox. Every loaded
  row is reachable in a contained scroll area, and inbox/outbox paging is
  tracked independently.
- Recipient-only plaintext is cached on the recipient's device without
  changing the contract's public `revealed` flag. The cache validates content
  and is bounded to the newest 100 private opens.
- Once the five-minute oracle-key cache expires, sealing fails closed if a
  fresh key cannot be fetched; it never silently encrypts to an indefinitely
  stale key.
- The host's `/api/morpheus/oracle/*` routes bridge the opaque MiniApp frame to
  the public Morpheus key and recipient-reveal services. No oracle credential is
  shipped to the MiniApp.

## Verification

```sh
npx tsc -p apps/neo-message/tsconfig.json --noEmit
npx eslint apps/neo-message/src apps/neo-message/vite.config.ts \
  apps/shared/test/neo-message.logic.test.ts \
  apps/shared/test/neo-message.plaintext-cache.test.ts \
  apps/shared/test/neo-message.playarea.test.tsx
npx vitest run --config apps/neo-message/vite.config.ts \
  apps/neo-message/src/message-logic.test.ts \
  apps/neo-message/src/pending-delivery.test.ts
npx vitest run --config apps/shared/vitest.config.ts \
  apps/shared/test/neo-message.playarea.test.tsx \
  apps/shared/test/neo-message.plaintext-cache.test.ts
npm --prefix platform/host-app test -- --runInBand \
  __tests__/api/morpheus.oracle.public-key.test.ts \
  __tests__/api/morpheus.oracle.message-reveal.test.ts
npm --prefix apps/neo-message run build
node scripts/verify-miniapp-dapp-support.mjs
```

No clipboard action is exposed. No wallet signature, funded transaction,
contract deployment, or account use is part of the verification pass.
