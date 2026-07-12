# Graveyard design and flow audit

Audit date: 2026-07-11

## Findings from the previous production surface

| Priority | Finding | User impact | Resolution |
|---|---|---|---|
| P1 | Mobile CSS hid the fee/review region | A paid action could be reached without seeing its cost | Fee, wallet, digest, and permanence now remain in the main mobile path |
| P1 | The UI bypassed the existing confirmation state and called `executeDestroy` directly | No deliberate review boundary before the GAS deposit | Primary action now opens a confirmation sheet; only its final button dispatches the paid call |
| P1 | Only text and pasted values were supported | Users could not commit a local file without an external tool | Added bounded, on-device binary SHA-256 with no upload |
| P1 | “Ready” was derived from raw draft presence rather than a completed digest | False-ready state while SHA-256 had not completed | Readiness now requires an actual 64-character digest and exposes hashing progress |
| P1 | Standalone wallet prompting could look permanently busy | Weak recovery clarity and risk of duplicate attempts | Pending state explains the wallet/event wait; source data is retained unless `MemoryBuried` confirms |
| P1 | A relayed transaction with an event timeout returned `success: true` and could be presented as a completed burial/forget/epitaph | Private source could be cleared and local history could claim a state the indexer had not verified | All three mutations now require `verified === true` plus the matching event; unverified broadcasts preserve source/state and direct paid dispatch is blocked without the review snapshot |
| P1 | Seeded default fees remained spendable when `getPlatformStats` failed | A stale deposit could move GAS before the contract rejected the business call | Bury/forget stay fail-closed until both live fees verify; the review rail shows one compact retry state instead of enabling fallback payment |
| P1 | Fee readiness ignored the deployed `isPaused` state | A deposit could be sent immediately before a paused target call | Fee and pause reads now form one write-readiness gate; paused/unreadable states block before GAS moves |
| P1 | A matching event name was accepted without checking its full identity | Another owner/target/type payload could be mistaken for this action | Burial, forgetting, and epitaph verify every relevant event slot against the reviewed owner and payload |
| P1 | A prepaid transfer followed by a failed consuming call had no app-owned retry lane | Retrying could add a second deposit or lose recovery context after refresh | A device-local wallet/operation journal records deposit and target broadcast phases; recovery invokes directly with existing credit and reconciles against records |
| P1 | `forgetMemory` could arm confirmation and return normally | The action wrapper could emit a success toast even though nothing was forgotten | The mutation now rejects unless `requestForget` already confirmed the exact row; stale/forgotten rows also reject instead of resolving as success |
| P1 | Wallet replacement reads could retain the previous wallet's rows on failure | Another owner's history could remain visible | Owner changes clear counts and records before the new read begins |
| P2 | Five tiny equal text pills and multiple same-weight actions made the app feel like a form | Weak hierarchy and little tactile identity | Replaced with a central memorial scene, generated letter artifact, material memory tokens, and one dominant ritual action |
| P2 | The public manifest still advertised a second generic parameter form | The platform could duplicate the ritual as a survey-like operation panel | Generic operations are explicitly empty; all mutations remain inside the designed Memory Garden workspace |
| P1 | Copy claimed TEE destruction, erased hashes, public memorials, and MainNet deployment | Product and security behavior were misrepresented | README and bilingual UI now state the exact contract, privacy, fee, and audit-trail boundaries |
| P2 | Epitaph was labelled “free” | A signed Neo invocation can still carry a network fee | Copy now distinguishes “no Graveyard deposit” from a normal wallet-quoted network fee |

## Design system extracted from the selected concept

- Palette: warm limestone/ivory surfaces, forest-moss primary action, bronze/amber details, dark green text; no dark-mode canvas.
- Typography: Georgia for memorial/editorial moments; system sans for controls; monospace only for hashes and addresses.
- Container model: one garden stage, one open ritual surface, one compact review rail, and a progressively disclosed records section.
- Asset roles: generated garden environment is the primary scene; generated paper/wax seal is the editable memory artifact; Lucide icons are limited to controls and state cues.
- Motion: short lift/selection feedback, SHA-256/chain progress rotation, and reduced-motion overrides.
- Accessibility: opaque high-contrast title plaque, visible focus rings, 44 px-class targets, explicit dialog semantics, Escape dismissal, and persistent mobile fee visibility.
- Confirmation safety: keyboard focus is trapped in the review dialog and returned to the invoking control on close; target/type/fee changes require a second explicit confirmation.
