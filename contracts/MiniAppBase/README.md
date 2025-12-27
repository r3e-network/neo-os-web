# MiniAppBase Partial Class Library

This directory contains reusable event definitions for MiniApp contracts as partial classes.

## Files

### MetricEvent.cs

Platform_Metric event for emitting custom business metrics that the platform indexer can capture.

### MetricEventCompact.cs

Compact Platform_Metric event signature without `appId` (use only with `manifest.contract_hash`).

**Event Signature:**

```csharp
[DisplayName("Platform_Metric")]
public static event MetricHandler OnMetric;
// Parameters: appId (string), metricName (string), value (BigInteger)
```

The platform also accepts the compact signature
`Platform_Metric(metricName, value)` if `manifest.contract_hash` is set so the indexer
can map the emitting contract back to `app_id`.

To emit the compact signature from C# without an `appId` parameter, include
`MetricEventCompact.cs` instead of `MetricEvent.cs` (do not include both files).

**Helper Method:**

```csharp
protected static void EmitMetric(string appId, string metricName, BigInteger value)
```

**Standard Metric Names:**

- `UserJoined` - New user joined the app (value = 1)
- `VolumeTraded` - Trading volume in smallest unit (value = amount)
- `ItemMinted` - NFT or token minted (value = count)
- `GamePlayed` - Game round completed (value = 1)
- `VoteCast` - Governance vote submitted (value = 1)

Custom metric names are allowed but should follow CamelCase convention.

### NotificationEvent.cs

Platform_Notification event for emitting user-facing notifications.

### NotificationEventCompact.cs

Compact Platform_Notification event signature without `appId` (use only with `manifest.contract_hash`).

**Event Signature:**

```csharp
[DisplayName("Platform_Notification")]
public static event NotificationHandler OnNotification;
// Parameters: appId, title, content, notificationType, priority
```

The platform also accepts the compact signature
`Platform_Notification(notificationType, title, content)` if `manifest.contract_hash`
is set so the indexer can map the emitting contract back to `app_id`.

To emit the compact signature from C# without an `appId` parameter, include
`NotificationEventCompact.cs` instead of `NotificationEvent.cs` (do not include both files).

Recommended `notificationType` values:

- `Announcement`
- `Alert`
- `Milestone`
- `Promo`

## Usage in MiniApp Contracts

To use these events, include the corresponding .cs files when compiling your MiniApp contract:

```bash
nccs MiniAppBase/MetricEvent.cs MiniAppBase/NotificationEvent.cs YourMiniApp/YourContract.cs -o build/
```

For compact events (no appId), use:

```bash
nccs MiniAppBase/MetricEventCompact.cs MiniAppBase/NotificationEventCompact.cs YourMiniApp/YourContract.cs -o build/
```

Then in your contract code:

```csharp
namespace NeoMiniAppPlatform.Contracts
{
    public delegate void MetricHandler(string appId, string metricName, BigInteger value);

    [DisplayName("MyMiniApp")]
    public partial class MiniAppBase : SmartContract
    {
        [DisplayName("Platform_Metric")]
        public static event MetricHandler OnMetric;

        protected static void EmitMetric(string appId, string metricName, BigInteger value)
        {
            OnMetric(appId, metricName, value);
        }

        public static void MyBusinessLogic()
        {
            // ... your logic ...

            EmitMetric("my-app-id", "UserJoined", 1);
        }
    }
}
```

## Note

These are partial class definitions only. They cannot be compiled independently and must be included with a main contract implementation that has proper manifest attributes. The platform continues to accept legacy `Notification`/`Metric` event names, but new apps should emit `Platform_Notification` and `Platform_Metric`.
