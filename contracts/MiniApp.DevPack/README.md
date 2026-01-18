# MiniApp DevPack

Neo N3 MiniApp 开发框架 v3.0.0，提供标准化的抽象基类体系。

## Overview

MiniApp DevPack provides a comprehensive inheritance-based framework for building MiniApps on Neo N3. It replaces the previous partial class approach with proper object-oriented design, offering specialized base classes for different contract types.

### Key Features

- **TimeLock Security**: 24-hour delay on admin changes (P0 security fix)
- **Badge System**: Built-in achievement tracking
- **Bet Limits**: Anti-Martingale protection for gaming contracts
- **Service Integration**: RNG, Price Feed, Encryption services
- **Automation Support**: Periodic task execution via AutomationAnchor
- **Payment Validation**: Double-spend prevention via PaymentHub receipts

## Architecture

### Inheritance Hierarchy

```
SmartContract (Neo Framework)
       ↓
  MiniAppBase (abstract)
       ├─→ MiniAppGameBase (abstract)     → Gaming/betting contracts
       ├─→ MiniAppServiceBase (abstract)  → Service callback contracts
       └─→ MiniAppTimeLockBase (abstract) → Time-locked operations

Examples:
  MiniAppCoinFlip    : MiniAppGameBase
  MiniAppLottery     : MiniAppGameBase
  MiniAppDailyCheckin: MiniAppBase (direct)
  MiniAppOnChainTarot: MiniAppServiceBase
```

### Storage Layout

| Range | Owner | Purpose |
|-------|-------|---------|
| 0x01-0x09 | MiniAppBase | Core (Admin, Gateway, PaymentHub, Pause, TimeLock) |
| 0x0A-0x0E | MiniAppBase | Optional (Automation, Badges, TotalUsers) |
| 0x10-0x17 | MiniAppGameBase | Gaming (BetLimits, PlayerTracking, RequestData) |
| 0x18-0x1B | MiniAppServiceBase | Service (RequestData) |
| 0x1C-0x1F | MiniAppTimeLockBase | TimeLock (Unlock state) |
| 0x20+ | App-specific | Available for contract-specific storage |

## Base Classes

### MiniAppBase

Core abstract base class providing essential functionality for ALL MiniApps.

#### Core Features

| Feature | Description |
|---------|-------------|
| Admin Management | TimeLock-protected admin changes |
| Gateway Validation | TEE-attested service layer integration |
| Pause Mechanism | Local + global pause support |
| Payment Receipts | Double-spend prevention |
| Badge System | Built-in achievement tracking |
| Contract Lifecycle | Update/Destroy with admin validation |

#### Storage Prefixes (0x01-0x0E)

| Prefix | Constant | Purpose |
|--------|----------|---------|
| 0x01 | PREFIX_ADMIN | Admin address |
| 0x02 | PREFIX_GATEWAY | Gateway address |
| 0x03 | PREFIX_PAYMENTHUB | PaymentHub address |
| 0x04 | PREFIX_PAUSED | Local pause flag |
| 0x05 | PREFIX_PAUSE_REGISTRY | Global pause registry |
| 0x06 | PREFIX_RECEIPT_USED | Used receipt tracking |
| 0x07 | PREFIX_PENDING_ADMIN | Pending admin (TimeLock) |
| 0x08 | PREFIX_ADMIN_CHANGE_TIME | Admin change execute time |
| 0x09 | PREFIX_TIMELOCK_DELAY | TimeLock delay (default 24h) |
| 0x0A | PREFIX_AUTOMATION_ANCHOR | Automation anchor address |
| 0x0B | PREFIX_AUTOMATION_TASK | Automation task ID |
| 0x0C | PREFIX_USER_BADGES | User badge storage |
| 0x0D | PREFIX_USER_BADGE_COUNT | User badge count |
| 0x0E | PREFIX_TOTAL_USERS | Total users counter |

#### Key Methods

**Admin Management (TimeLock Protected)**
```csharp
ProposeAdmin(UInt160 newAdmin)      // Propose new admin
ExecuteAdminChange()                 // Execute after 24h delay
CancelAdminChange()                  // Cancel pending change
SetTimeLockDelay(BigInteger delaySeconds) // Set delay (min 1 hour)
```

**Configuration**
```csharp
SetGateway(UInt160 gw)              // Set gateway address
SetPaymentHub(UInt160 hub)          // Set payment hub
SetPauseRegistry(UInt160 registry)  // Set global pause registry
SetAutomationAnchor(UInt160 anchor) // Set automation anchor
SetPaused(bool paused, string appId) // Toggle local pause
```

**Validation Helpers**
```csharp
ValidateAdmin()                      // Check admin witness
ValidateGateway()                    // Check gateway caller
ValidateAddress(UInt160 addr)        // Validate address
ValidateNotPaused()                  // Check local pause
ValidateNotGloballyPaused(string appId) // Check global pause
ValidatePaymentReceipt(...)          // Validate payment receipt
```

**Badge System**
```csharp
HasBadge(UInt160 user, BigInteger badgeType) // Check badge
GetUserBadgeCount(UInt160 user)              // Get badge count
AwardBadge(UInt160 user, BigInteger type, string name) // Award badge
TotalUsers()                                  // Get total users
```

#### Events

```csharp
AdminChangeProposed(UInt160 currentAdmin, UInt160 proposedAdmin, BigInteger executeAfter)
AdminChanged(UInt160 oldAdmin, UInt160 newAdmin)
AdminChangeCancelled(UInt160 cancelledAdmin)
Paused(string appId, bool paused)
BadgeEarned(UInt160 user, BigInteger badgeType, string badgeName)
```

---

### MiniAppGameBase

Extends MiniAppBase with gaming/betting specific functionality.

#### Features

| Feature | Description |
|---------|-------------|
| Bet Limits | Max bet, daily limit, cooldown, consecutive limits |
| Player Tracking | Daily bets, last bet time, bet count |
| RNG Integration | Built-in RequestRng() method |
| Anti-Martingale | Consecutive bet limits with session reset |

#### Storage Prefixes (0x10-0x17)

| Prefix | Constant | Purpose |
|--------|----------|---------|
| 0x10 | PREFIX_PLAYER_DAILY_BET | Player daily bet total |
| 0x11 | PREFIX_PLAYER_LAST_BET | Player last bet timestamp |
| 0x12 | PREFIX_PLAYER_BET_COUNT | Player consecutive bet count |
| 0x13 | PREFIX_BET_LIMITS_CONFIG | Bet limits configuration |
| 0x14 | PREFIX_REQUEST_TO_DATA | RNG request data mapping |

#### Default Bet Limits

```csharp
DEFAULT_MAX_BET = 100 GAS          // Max single bet
DEFAULT_DAILY_LIMIT = 1000 GAS     // Daily spending limit
DEFAULT_COOLDOWN_SECONDS = 30        // 30 seconds between bets
DEFAULT_MAX_CONSECUTIVE = 20       // Max bets per session
```

#### Key Methods

**Bet Limits Management**
```csharp
GetBetLimits() → BetLimitsConfig
SetBetLimits(BigInteger maxBet, BigInteger dailyLimit,
             BigInteger cooldownSeconds, BigInteger maxConsecutive)
```

**Player Tracking**
```csharp
GetPlayerDailyBet(UInt160 player) → BigInteger
GetPlayerLastBetTime(UInt160 player) → BigInteger
GetPlayerBetCount(UInt160 player) → BigInteger
```

**Validation & Recording**
```csharp
ValidateBetLimits(UInt160 player, BigInteger amount) // Validate bet
RecordBet(UInt160 player, BigInteger amount)         // Record bet
```

**RNG Service**
```csharp
RequestRng(string appId, ByteString payload) → BigInteger // Request RNG
StoreRequestData(BigInteger requestId, ByteString data)   // Store request
GetRequestData(BigInteger requestId) → ByteString         // Get request
DeleteRequestData(BigInteger requestId)                   // Cleanup
```

#### Data Structures

```csharp
public struct BetLimitsConfig
{
    public BigInteger MaxBet;
    public BigInteger DailyLimit;
    public BigInteger CooldownSeconds;
    public BigInteger MaxConsecutive;
}
```

---

### MiniAppServiceBase

Extends MiniAppBase with service callback and automation functionality.

#### Features

| Feature | Description |
|---------|-------------|
| Service Requests | RNG, PriceFeed, Encryption, Decryption |
| Automation | Periodic task registration and execution |
| Callback Pattern | Chainlink-style request/callback flow |

#### Storage Prefixes (0x18-0x1B)

| Prefix | Constant | Purpose |
|--------|----------|---------|
| 0x1A | PREFIX_SERVICE_REQUEST_DATA | Service request data mapping |

#### Key Methods

**Service Requests**
```csharp
RequestService(string appId, string serviceType, ByteString payload) → BigInteger
RequestRng(string appId, ByteString payload) → BigInteger
RequestPriceFeed(string appId, ByteString payload) → BigInteger
RequestEncryption(string appId, ByteString payload) → BigInteger
RequestDecryption(string appId, ByteString payload) → BigInteger
```

**Automation**
```csharp
RegisterAutomationTask(string triggerType, string schedule, BigInteger gasLimit) → BigInteger
CancelAutomationTask()
ValidateAutomationAnchor()
```

**Callback Helpers**
```csharp
ValidateCallback(BigInteger requestId) → ByteString  // Entry validation
FinalizeCallback(BigInteger requestId)               // Cleanup
StoreRequestData(BigInteger requestId, ByteString data)
GetRequestData(BigInteger requestId) → ByteString
DeleteRequestData(BigInteger requestId)
```

#### Events

```csharp
ServiceRequested(BigInteger requestId, string serviceType)
AutomationRegistered(BigInteger taskId, string triggerType)
AutomationCancelled(BigInteger taskId)
```

---

### MiniAppTimeLockBase

Extends MiniAppBase with time-locked item primitives.

#### Features

| Feature | Description |
|---------|-------------|
| Time Lock | Store unlock timestamps per item |
| Reveal State | Track whether an item has been revealed |
| Item Counter | Monotonic ID generation for locked items |

#### Storage Prefixes (0x1C-0x1F)

| Prefix | Constant | Purpose |
|--------|----------|---------|
| 0x1C | PREFIX_ITEM_UNLOCK_TIME | Unlock timestamp per item |
| 0x1D | PREFIX_ITEM_REVEALED | Reveal flag per item |
| 0x1E | PREFIX_ITEM_COUNTER | Item counter |

#### Key Methods

```csharp
NextItemId() → BigInteger
TotalItems() → BigInteger
GetUnlockTime(BigInteger itemId) → BigInteger
IsRevealed(BigInteger itemId) → bool
IsUnlockable(BigInteger itemId) → bool
TimeRemaining(BigInteger itemId) → BigInteger
SetUnlockTime(BigInteger itemId, BigInteger unlockTime)
ValidateUnlockable(BigInteger itemId)
MarkRevealed(BigInteger itemId, UInt160 revealer)
```

#### Events

```csharp
ItemLocked(BigInteger itemId, BigInteger unlockTime)
ItemUnlocked(BigInteger itemId, UInt160 unlocker)
```

---

### ServiceTypes

Service type constants and payload structures.

#### Service Types

| Constant | Value | Description |
|----------|-------|-------------|
| RNG | "rng" | Random Number Generation |
| PRICE_FEED | "pricefeed" | Price Feed oracle |
| ENCRYPTION | "encryption" | TEE Encryption |
| DECRYPTION | "decryption" | TEE Decryption |
| API_CALL | "apicall" | External API call |
| AUTOMATION | "automation" | Scheduled tasks |

#### Data Structures

```csharp
public struct ServiceCallbackResult
{
    public BigInteger RequestId;
    public string AppId;
    public string ServiceType;
    public bool Success;
    public ByteString Result;
    public string Error;
}

public struct RngRequestPayload
{
    public ByteString Context;
    public int ByteCount;
}

public struct PriceFeedRequestPayload
{
    public string Symbol;
    public string QuoteCurrency;
}
```

## Usage Examples

### Basic MiniApp

```csharp
using NeoMiniAppPlatform.Contracts;

[DisplayName("MyMiniApp")]
[ContractPermission("*", "*")]
public class MiniAppMyApp : MiniAppBase
{
    private const string APP_ID = "miniapp-myapp";
    private static readonly byte[] PREFIX_MY_DATA = new byte[] { 0x20 };

    public static void _deploy(object data, bool update)
    {
        if (update) return;
        Storage.Put(Storage.CurrentContext, PREFIX_ADMIN,
            Runtime.Transaction.Sender);
    }

    public static void MyMethod(UInt160 user, BigInteger receiptId)
    {
        UInt160 gateway = Gateway();
        bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
        ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(user), "unauthorized");

        ValidateNotGloballyPaused(APP_ID);
        ValidatePaymentReceipt(APP_ID, user, 100000000, receiptId);
        // Business logic
    }
}
```

### Gaming MiniApp

```csharp
public class MiniAppMyGame : MiniAppGameBase
{
    private const string APP_ID = "miniapp-mygame";

    public static BigInteger PlaceBet(UInt160 player, BigInteger amount,
                                       bool choice, BigInteger receiptId)
    {
        UInt160 gateway = Gateway();
        bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
        ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(player), "unauthorized");

        ValidateNotGloballyPaused(APP_ID);
        ValidatePaymentReceipt(APP_ID, player, amount, receiptId);
        ValidateBetLimits(player, amount);

        // Store bet and request RNG
        BigInteger betId = GetNextBetId();
        StoreBet(betId, player, amount, choice);
        RecordBet(player, amount);

        ByteString payload = StdLib.Serialize(betId);
        BigInteger requestId = RequestRng(APP_ID, payload);
        StoreRequestData(requestId, (ByteString)betId.ToByteArray());

        return betId;
    }

    public static void OnServiceCallback(BigInteger requestId, string appId,
        string serviceType, bool success, ByteString result, string error)
    {
        ExecutionEngine.Assert(appId == APP_ID, "app mismatch");
        ExecutionEngine.Assert(serviceType == ServiceTypes.RNG, "service mismatch");

        ByteString data = ValidateCallback(requestId);
        BigInteger betId = (BigInteger)data;
        // Process result...
        FinalizeCallback(requestId);
    }
}
```

### Service MiniApp with Automation

```csharp
public class MiniAppMyService : MiniAppServiceBase
{
    private const string APP_ID = "miniapp-myservice";

    public static void SetupAutomation()
    {
        ValidateAdmin();
        RegisterAutomationTask("interval", "3600", 1000000000); // Hourly
    }

    public static void OnPeriodicExecution(BigInteger taskId, ByteString payload)
    {
        ValidateAutomationAnchor();
        // Periodic task logic
    }

    public static void OnServiceCallback(BigInteger requestId, string appId,
        string serviceType, bool success, ByteString result, string error)
    {
        ByteString data = ValidateCallback(requestId);
        // Process callback...
        FinalizeCallback(requestId);
    }
}
```

## Security Model

### Roles

| Role | Description | Access |
|------|-------------|--------|
| Admin | Human operator | TimeLock-protected control |
| Gateway | TEE-attested service | Required for service callbacks; optional for user flows |
| Users | End users | Pay via PaymentHub; may call directly when CheckWitness is allowed |

### Security Features

1. **TimeLock Admin Changes**: 24-hour delay prevents immediate takeover
2. **Gateway-Validated Callbacks**: Service callbacks require gateway authorization
3. **Payment Receipt Validation**: Prevents double-spending
4. **Bet Limits**: Anti-Martingale protection for gaming
5. **Global Pause**: Emergency stop via PauseRegistry

## Building

```bash
cd contracts
./build.sh
```

## Migration from v2.x

### Breaking Changes

1. **Inheritance Required**: Contracts must inherit from appropriate base class
2. **Storage Prefix Changes**: Core prefixes moved to 0x01-0x0E range
3. **Admin Management**: Direct `SetAdmin()` replaced with TimeLock pattern
4. **Gaming Features**: Moved to `MiniAppGameBase`

### Migration Steps

1. Change base class from partial to inheritance
2. Update storage prefixes (app-specific should start at 0x20+)
3. Replace `SetAdmin()` with `ProposeAdmin()` + `ExecuteAdminChange()`
4. For gaming contracts, inherit from `MiniAppGameBase`

## 中文说明

### 概述

MiniApp DevPack v3.0.0 是 Neo N3 MiniApp 开发框架，提供基于继承的标准化抽象基类体系。

### 主要特性

- **TimeLock 安全**: 管理员变更需要 24 小时延迟
- **徽章系统**: 内置成就追踪
- **下注限制**: 游戏合约的反马丁格尔保护
- **服务集成**: RNG、价格预言机、加密服务
- **自动化支持**: 通过 AutomationAnchor 执行周期性任务
- **支付验证**: 通过 PaymentHub 收据防止双花

### 继承层次

```
SmartContract (Neo Framework)
       ↓
  MiniAppBase (抽象基类)
       ├─→ MiniAppGameBase (游戏基类)     → 博彩/游戏合约
       ├─→ MiniAppServiceBase (服务基类)  → 服务回调合约
       └─→ MiniAppTimeLockBase (时锁基类) → 时间锁定操作
```

### 存储布局

| 范围 | 所有者 | 用途 |
|------|--------|------|
| 0x01-0x09 | MiniAppBase | 核心功能 |
| 0x0A-0x0E | MiniAppBase | 可选功能 |
| 0x10-0x17 | MiniAppGameBase | 游戏功能 |
| 0x18-0x1B | MiniAppServiceBase | 服务功能 |
| 0x1C-0x1F | MiniAppTimeLockBase | 时锁功能 |
| 0x20+ | 应用专用 | 合约特定存储 |
