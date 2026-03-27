# Recovery Guardian

AA recovery launcher for guardian policy, NeoDID recovery tickets, timelock review, and final recovery execution.

## Scope

This miniapp is a recovery-facing shell. It keeps recovery policy explicit and routes users to the real AA and Morpheus recovery surfaces.

It provides:

- guardian setup launch path
- recovery workspace launch path
- NeoDID recovery ticket context
- documentation shortcuts for recovery operators

## Official Endpoints

- AA identity workspace: `https://neo-abstract-account.vercel.app/identity`
- AA app workspace: `https://neo-abstract-account.vercel.app/app`
- AA docs: `https://neo-abstract-account.vercel.app/docs`
- Runtime source of truth: `apps/shared/constants/rpc.ts`
- Morpheus NeoDID docs: `https://oracle.meshmini.app/docs/neodid`
