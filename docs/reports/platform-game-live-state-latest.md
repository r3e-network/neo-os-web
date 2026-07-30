# PlatformGame Live State Audit

- Generated: 2026-07-30T10:51:28.676Z
- Network: neo-n3-testnet (magic 894710606)
- Engine: 0xc75b181b4561462903bb27d8d9e0b32b637bec12
- Mode: read-only; chain writes performed: false

## Summary

- Apps checked: 11
- Live-state ready: 9
- Apps with blockers: 2
- Descriptor mismatches: 2
- Mismatched apps with HALT update preflight: 2
- Contract state ready: true
- Overall live-state ready: false

## Apps

| App | Game type | Active | Paused | Pool | Reserved | Free | Held | Descriptors | Ready | Blockers |
| --- | ---: | :---: | :---: | ---: | ---: | ---: | ---: | ---: | :---: | --- |
| miniapp-aim-master | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-color-clash | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-curve-arrow | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-flappy-dash | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-game-2048 | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-jump-rush | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 0/9 | false | descriptor_values_match_manifest |
| miniapp-merge-kingdom | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-pet-potion | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-sheep-solitaire | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 3/9 | false | descriptor_values_match_manifest |
| miniapp-snake-bounty | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |
| miniapp-sudoku | 5 | true | false | 42000000 | 0 | 42000000 | 42000000 | 9/9 | true | — |

## Boundary

This read-only audit proves current ABI reads, app registration/activation, pause state, admin identity, pool counters, and Registry descriptor values. It does not prove funded start/finalize/settle/withdraw lifecycle completion.

