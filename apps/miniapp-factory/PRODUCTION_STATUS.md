# MiniApp Studio production status

Version: `1.1.0`  
Status date: 2026-07-12

## Product boundary

MiniApp Studio is production-complete for deterministic starter-package
creation and explicit testnet registry handoff. It is not an application or
contract deployment service.

| Capability | Status | Product behavior |
| --- | --- | --- |
| Product-shaped template selection | Ready | Reward vault, event pass, certificate and Oracle console are presented as visual experiences rather than a type dropdown. |
| Live starter preview | Ready | Name, identity, theme, category and requested services update the primary preview. |
| Deterministic package | Ready | Generates catalog patch, starter manifest, Factory binding, exact registration plan and one exportable JSON bundle. |
| Draft recovery | Ready | A schema-versioned local draft is normalized and restored; old network values are forced to the configured testnet. |
| Template verification | Ready | A live `getTemplate` read gates registration. Unknown and unregistered templates never enable the write. |
| Testnet registry write | Ready in code | The one primary write calls `createMiniAppFromTemplate` only after a fresh template read and exact testnet/network checks. |
| Submission recovery | Ready | Intent is stored before wallet approval; a returned transaction ID is persisted and the Factory record is read back without converting RPC failure into success. |
| Developer signature | Optional | A secondary drawer can sign the exact package commitment; it is not presented as deployment proof. |
| Finished PlayArea implementation | Operator step | The generated manifest is only a starter. Each app still needs its real product surface and setup implementation. |
| Catalog publication | Operator step | The generated patch must be reviewed and synced separately. |
| Contract deployment | Not performed | MiniApp Factory writes a registry record. It does not deploy an app or contract and never reports that outcome. |

Only `neo-n3-testnet` is declared because it is the sole configured MiniApp
Factory registry in this release. The manifest is stateful and online-only to
match draft/recovery storage plus live template and record reads.
Current read-only chain evidence is recorded in [TESTNET_STATUS.md](./TESTNET_STATUS.md).

## Visual and interaction result

- The repository `miniapp-launch-studio.webp` artwork is the main stage, with
  high-contrast content kept on separate clean white surfaces.
- The primary journey is choose experience → name app → generate package →
  register testnet record → operator handoff.
- Admin, network facts, optional capabilities, generated files, signature,
  history and validation live in secondary disclosures.
- There is one bounded primary action. Long full-width action bars and the old
  generic Factory form/dashboard are not used.
- Layout stacks at tablet/mobile widths and honors reduced-motion preference.

## Verification evidence

- Focused artifact, PlayArea, setup, production and MiniApp-specific locale
  suite: 17/17 tests passed.
- Existing shared Factory runtime suite: 8/8 tests passed with a 15-second
  runner timeout; its first dynamic transform exceeds the repository's default
  5-second test timeout in this concurrent worktree.
- App TypeScript, scoped ESLint and `git diff --check` passed.
- Production build: 1,842 modules transformed in 12.48 seconds; app entry
  233.25 kB (71.75 kB gzip) and CSS 111.31 kB (20.36 kB gzip). Compared with
  the pre-refactor baseline, that is 39 fewer modules, 17.30 kB less app
  JavaScript (2.02 kB gzip) and 42.47 kB less CSS (4.27 kB gzip).
- Non-browser HTTP smoke: all 15 emitted files returned HTTP 200. The active
  studio artwork and manifest are byte-identical between source and `dist/`.
- The scoped standalone structure check passed. The repository-wide scanner
  did not flag `miniapp-factory`, but still exits non-zero for seven unrelated
  apps currently being changed in the shared worktree.
- Read-only testnet checks confirmed all four template records and the
  MiniApp registry enumeration ABI; details are in `TESTNET_STATUS.md`.

No browser/Playwright visual run, wallet signature, transaction, deployment,
catalog sync, dist-to-host copy, staging or commit was performed in this lane.
