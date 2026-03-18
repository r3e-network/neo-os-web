# MiniAppQuadraticFunding | Quadratic Funding

Quadratic Funding enables public grant rounds with matching pools. Donors contribute to projects on-chain, while
matching allocations are computed off-chain and finalized on-chain.

## Features
- Create matching rounds for NEO or GAS
- Register projects per round
- Accept contributions with donor tracking
- Finalize matching allocations off-chain and publish on-chain
- Project owners claim contributions + matching

## Core Methods

### `CreateRound`
Creates a new QF round and deposits the matching pool.

```
CreateRound(
  UInt160 creator,
  UInt160 asset,
  BigInteger matchingPool,
  BigInteger startTime,
  BigInteger endTime,
  string title,
  string description
)
```

- `asset` must be NEO or GAS native contract hash
- `matchingPool` is in raw units (NEO uses 0 decimals, GAS uses 8)
- `startTime` / `endTime` are Unix seconds

### `RegisterProject`
Registers a project for a specific round.

```
RegisterProject(UInt160 owner, BigInteger roundId, string name, string description, string link)
```

### `Contribute`
Contribute to a project during the active round window.

```
Contribute(UInt160 contributor, BigInteger roundId, BigInteger projectId, BigInteger amount, string memo)
```

### `FinalizeRound`
Finalize matching allocations (computed off-chain) after the round ends.

```
FinalizeRound(UInt160 operatorAddress, BigInteger roundId, BigInteger[] projectIds, BigInteger[] matchedAmounts)
```

### `ClaimProject`
Project owner claims total contributions plus matching allocation.

```
ClaimProject(UInt160 owner, BigInteger projectId)
```

## Read Methods
- `GetRoundDetails(roundId)`
- `GetProjectDetails(projectId)`
- `GetRounds(offset, limit)`
- `GetRoundProjects(roundId, offset, limit)`
- `GetOwnerProjects(owner, offset, limit)`
- `GetCreatorRounds(creator, offset, limit)`
- `GetContribution(contributor, roundId, projectId)`

## Events
- `RoundCreated`
- `MatchingPoolAdded`
- `RoundFinalized`
- `ProjectRegistered`
- `ContributionMade`
- `ProjectClaimed`

## Notes
- Matching is computed off-chain using per-donor contribution totals (quadratic funding formula).
- Use `MiniAppBase` update method for upgrades.
- Timestamps are Unix seconds (`Runtime.Time`).
