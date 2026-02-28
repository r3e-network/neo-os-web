# MiniAppHallOfFame

## Overview

MiniAppHallOfFame is a voting and recognition platform where users nominate and vote for notable contributors in the Neo ecosystem. The platform operates in seasonal cycles, with winners inducted into the Hall of Fame at the end of each season.

### Key Features

- **Seasonal Voting**: Time-limited voting seasons
- **Multiple Categories**: legends, communities, developers, projects
- **Nominee System**: Users can add nominees with descriptions
- **Vote Weighting**: Votes weighted by GAS amount
- **Voter Rewards**: Rewards for participating voters
- **Badge System**: Badges for voting achievements
- **Induction**: Winners inducted into Hall of Fame

## How It Works

### Core Mechanism

1. **Season Start**: Admin starts a new voting season
2. **Add Nominees**: Users add nominees to categories
3. **Vote**: Users vote for nominees with GAS
4. **Season End**: Admin ends season, winners determined
5. **Induction**: Top nominees inducted into Hall of Fame
6. **Rewards**: Voters claim participation rewards

### File Structure

```
MiniAppHallOfFame/
├── MiniAppHallOfFame.cs        # Main: delegates, constants, prefixes, events, structs
├── MiniAppHallOfFame.Read.cs   # Read methods
├── MiniAppHallOfFame.Admin.cs  # AddCategory, StartSeason
├── MiniAppHallOfFame.Nominee.cs # AddNominee
├── MiniAppHallOfFame.Vote.cs   # Vote method
├── MiniAppHallOfFame.EndSeason.cs # EndSeason
├── MiniAppHallOfFame.Query.cs  # GetNomineeDetails
├── MiniAppHallOfFame.SeasonQuery.cs # GetSeasonDetails
├── MiniAppHallOfFame.UserQuery.cs # GetUserStatsDetails
├── MiniAppHallOfFame.Platform.cs # GetPlatformStats
├── MiniAppHallOfFame.Internal.cs # Storage helpers
├── MiniAppHallOfFame.Stats.cs  # UpdateUserStats
├── MiniAppHallOfFame.Badge.cs  # CheckVoterBadges
├── MiniAppHallOfFame.Award.cs  # AwardVoterBadge
├── MiniAppHallOfFame.Payment.cs # OnNEP17Payment
└── MiniAppHallOfFame.Automation.cs # Automation hook
```

## Key Methods

### Admin Methods

#### `AddCategory(string category)`

Add a new voting category. Admin only.

#### `StartSeason()`

Start a new voting season. Admin only.

#### `EndSeason(string category)`

End current season and determine winner for category. Admin only.

### User Methods

#### `AddNominee(string category, string nominee, string description)`

Add a nominee to a category.

**Parameters:**
- `category`: Category name (max 50 chars)
- `nominee`: Nominee name (max 100 chars)
- `description`: Description (max 500 chars)

#### `Vote(UInt160 voter, string category, string nominee, BigInteger amount)`

Vote for a nominee with GAS.

**Parameters:**
- `voter`: Voter address
- `category`: Category name
- `nominee`: Nominee name
- `amount`: Vote amount in GAS (min 0.1 GAS)

### Query Methods

#### `GetNomineeDetails(string category, string nominee) → Map<string, object>`

Returns nominee information.

#### `GetSeasonDetails(BigInteger seasonId) → Map<string, object>`

Returns season information.

#### `GetUserStatsDetails(UInt160 user) → Map<string, object>`

Returns user voting statistics.

#### `GetPlatformStats() → Map<string, object>`

Returns platform-wide statistics.

## Events

### `VoteRecorded(UInt160 voter, string category, string nominee, BigInteger amount, BigInteger seasonId)`

Emitted when a vote is recorded.

### `NomineeAdded(string category, string nominee, UInt160 addedBy, string description)`

Emitted when a nominee is added.

### `SeasonStarted(BigInteger seasonId, BigInteger startTime, BigInteger endTime)`

Emitted when a new season starts.

### `SeasonEnded(BigInteger seasonId, string category, string winner, BigInteger totalVotes)`

Emitted when a season ends.

### `Induction(string category, string nominee, BigInteger totalVotes, BigInteger seasonId)`

Emitted when a nominee is inducted into Hall of Fame.

### `VoterBadgeEarned(UInt160 voter, BigInteger badgeType, string badgeName)`

Emitted when a voter earns a badge.

## Data Structures

### Nominee

```csharp
public struct Nominee
{
    public string Name;
    public string Category;
    public string Description;
    public UInt160 AddedBy;
    public BigInteger AddedTime;
    public BigInteger TotalVotes;
    public BigInteger VoteCount;
    public bool Inducted;
}
```

### Season

```csharp
public struct Season
{
    public BigInteger Id;
    public BigInteger StartTime;
    public BigInteger EndTime;
    public BigInteger TotalVotes;
    public BigInteger VoterCount;
    public bool Active;
    public bool Settled;
}
```

### UserStats

```csharp
public struct UserStats
{
    public BigInteger TotalVoted;
    public BigInteger VoteCount;
    public BigInteger SeasonsParticipated;
    public BigInteger RewardsClaimed;
    public BigInteger NomineesAdded;
    public BigInteger HighestSingleVote;
    public BigInteger BadgeCount;
    public BigInteger JoinTime;
    public BigInteger LastActivityTime;
}
```

## Constants

```csharp
private const string APP_ID = "miniapp-hall-of-fame";
private const int MAX_CATEGORY_LENGTH = 50;
private const int MAX_NOMINEE_LENGTH = 100;
private const int MAX_DESCRIPTION_LENGTH = 500;
private const long MIN_VOTE = 10000000;           // 0.1 GAS
private const int SEASON_DURATION_SECONDS = 2592000; // 30 days
private const int PLATFORM_FEE_BPS = 500;         // 5%
private const int VOTER_REWARD_BPS = 1000;        // 10%
```

## Default Categories

- `legends` - Notable individuals
- `communities` - Community groups
- `developers` - Developer contributors
- `projects` - Notable projects

## 中文说明

### 概述

MiniAppHallOfFame 是一个投票和表彰平台，用户可以提名和投票给 Neo 生态系统中的杰出贡献者。平台以季节周期运行，每个季节结束时获胜者将被纳入名人堂。

### 主要特性

- **季节投票**: 限时投票季节
- **多个类别**: 传奇人物、社区、开发者、项目
- **提名系统**: 用户可以添加带描述的提名
- **投票权重**: 投票按 GAS 金额加权
- **投票者奖励**: 参与投票者获得奖励
- **徽章系统**: 投票成就徽章
- **入选**: 获胜者入选名人堂

### 默认类别

- `legends` - 杰出人物
- `communities` - 社区团体
- `developers` - 开发者贡献者
- `projects` - 杰出项目
