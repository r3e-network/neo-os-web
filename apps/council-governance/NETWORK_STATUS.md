# Council Governance Network Status

Read-only verification date: **2026-07-12**

| Network | Canonical contract | Contract | Paused | Proposal count | Platform evidence |
| --- | --- | --- | --- | ---: | --- |
| Neo N3 Mainnet | `0xc7e50e67589df63302cbea1a6b00beb649ee74d8` | `MiniAppCouncilGovernance` | `false` | 0 | Committee 21, quorum 30%, threshold 50%; native `getCandidates` and `getCommittee` returned `HALT`. |
| Neo N3 Testnet | `0x4c61e5575ae9e151027f6724d07fac127d4cc25f` | `MiniAppCouncilGovernance` | `false` | 13 | 12 votes, 3 members; proposal details, native candidates, and the 21-key committee returned `HALT`. |

Both deployments expose the release business ABI, including
`getProposalCount`, `getProposalDetails`, `isCandidate`, `hasVoted`, `getVote`,
`createProposal`, `vote`, `revokeProposal`, `finalizeProposal`, and
`executeProposal`, with the corresponding proposal lifecycle events.

`getGovernanceConstants` returns committee `21`, quorum `30`, threshold `50`,
minimum duration `86,400`, and maximum duration `2,592,000` on both networks.
Despite the historical `minDurationSeconds` / `maxDurationSeconds` map keys,
the deployed proposal timestamps and the maintained live harness prove that
the write argument is consumed as milliseconds: every current testnet proposal
has `expiryTime - createTime = 90,000`, and the harness finalizes after about
95 seconds. The frontend therefore treats these values as milliseconds and
never submits the former multi-day values that exceed the deployed maximum.

Candidate rows are accepted only when the native NEO contract returns a valid
compressed secp256r1 public key (`02`/`03`, 33 bytes) and a non-negative safe
integer vote weight. Malformed rows cannot become visible committee identity.

Mainnet currently has no contract-native proposals; the UI may enrich that
confirmed empty contract set with read-only `neo.community` mirror proposals.
Mirror rows remain visibly read-only and can never be sent to the governance
contract as synthetic IDs.

No deployment, wallet signature, funded account use, or transaction was
performed in this verification pass. Real operational validation still needs
an eligible council wallet on each selected network to exercise create, vote,
revoke, finalize, signature collection, and policy execution. The frontend's
transaction path is covered locally through exact event and authoritative
readback harnesses; this document does not claim a new live write.
