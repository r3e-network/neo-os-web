# Council Governance

Council Governance is a Neo council chamber, not a generic transaction form.
The primary surface lets anyone inspect the current motion and its real quorum;
an eligible council wallet gets one clear action to draft or vote. Proposal
lists, policy parameters, native committee/candidate data, wallet balances,
history, lifecycle actions, and recovery stay in secondary surfaces.

## Product flow

- Browse verified contract proposals together with clearly labelled
  `neo.community` mirror entries.
- Connect a council wallet and verify eligibility before enabling any write.
- Inspect the 21-seat native Neo committee, validated compressed candidate
  public keys, integer NEO vote weight, and exact NEO/GAS wallet balances.
- Draft a text motion or a bounded Neo policy change in the proposal dossier.
- Vote for or against only after `hasVoted` is known, preventing a failed read
  from enabling a duplicate vote.
- Finalize only an expired contract proposal, execute only a passed policy
  proposal, and revoke only an active proposal owned by the connected wallet.

The deployed contracts currently interpret proposal duration as milliseconds,
even though the read-only constants retain `*Seconds` field names. Their live
range is `86,400`–`2,592,000`; the UI therefore offers 2, 15, and 30 minute
windows. The former 3/7/14-day controls exceeded the deployed maximum and were
not executable.

## Confirmation and recovery

Every write is bound to the active network, canonical contract, wallet,
operation, and expected proposal values. Creation recovery also retains the
exact type, title, description, policy value, and duration. A broadcast is
stored as pending. The app reports success only after the exact contract event
and an authoritative proposal or vote readback agree. Vote confirmation checks
both `hasVoted` and the exact `getVote` choice. A timeout or unavailable indexer
keeps the recovery action primary and blocks duplicate writes.

Proposal reads are all-or-preserve: an incomplete contract page cannot erase
or partially replace the last verified proposal list. Eligibility and
`hasVoted` failures remain unknown states rather than becoming false. Network,
account, roster, balance, and proposal reads are request-scoped so a slower old
response cannot overwrite a newer wallet or network selection.

## Networks

| Network | Contract |
| --- | --- |
| Neo N3 Mainnet | `0xc7e50e67589df63302cbea1a6b00beb649ee74d8` |
| Neo N3 Testnet | `0x4c61e5575ae9e151027f6724d07fac127d4cc25f` |

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for current read-only evidence.

## Verification

```sh
npm --prefix apps/council-governance test -- --run
npx vitest run --config apps/council-governance/vite.config.ts \
  apps/council-governance/src/composables/useGovernance.races.test.ts
npx vitest run --config apps/shared/vitest.config.ts \
  apps/shared/test/council-governance.integration.test.tsx \
  apps/shared/test/council-governance.playarea.test.tsx \
  apps/shared/test/stateful-manifest-truth.test.ts
npx tsc -p apps/council-governance/tsconfig.json --noEmit
npx eslint apps/council-governance/src
npm --prefix apps/council-governance run build
```

This verification pass does not deploy contracts, sign wallet messages, or
submit transactions. It also does not synchronize the host copy.
