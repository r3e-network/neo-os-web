# NeoDID Passport

Identity passport launcher for Web2 login, NeoDID binding, zklogin payloads, and AA-ready verifier material.

## Scope

This miniapp is a product shell. It does not reimplement Morpheus NeoDID or AA verifier logic locally.

It provides:

- a unified identity-facing entry point
- direct launch paths into the AA identity workspace
- direct launch paths into the Morpheus NeoDID live studio
- verifier and documentation shortcuts

## Official Endpoints

- AA identity workspace: `https://neo-abstract-account.vercel.app/identity`
- Runtime source of truth: `apps/shared/constants/rpc.ts`
- NeoDID live studio: `https://oracle.meshmini.app/launchpad/neodid-live`
- Verifier: `https://oracle.meshmini.app/verifier`
- NeoDID docs: `https://oracle.meshmini.app/docs/neodid`
