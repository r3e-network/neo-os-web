# PauseRegistry

Central pause control for the Neo MiniApp Platform.

## Overview

PauseRegistry provides a single point of control to pause/resume the entire MiniApp platform or individual apps with one transaction. This is critical for emergency response, maintenance, and security incident handling.

## What It Does

- **Global Pause**: Stop all MiniApp operations with one transaction
- **Per-App Pause**: Pause specific apps without affecting others
- **Operator System**: Delegate pause authority to trusted operators
- **Event Logging**: Track all pause state changes

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PauseRegistry                         │
├─────────────────────────────────────────────────────────┤
│  Global Pause State                                      │
│  ├── IsGloballyPaused() → affects ALL apps              │
│  │                                                       │
│  Per-App Pause State                                     │
│  ├── IsAppPaused("builtin-lottery") → specific app      │
│  ├── IsAppPaused("builtin-coinflip") → specific app     │
│  └── ...                                                 │
│                                                          │
│  IsPaused(appId) = IsGloballyPaused() OR IsAppPaused()  │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│              MiniApp Contracts                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Lottery   │  │  CoinFlip   │  │   DiceGame  │     │
│  │             │  │             │  │             │     │
│  │ Checks:     │  │ Checks:     │  │ Checks:     │     │
│  │ IsPaused()  │  │ IsPaused()  │  │ IsPaused()  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Key Methods

### Admin Methods

| Method                    | Access | Description              |
| ------------------------- | ------ | ------------------------ |
| `SetAdmin(newAdmin)`      | Admin  | Transfer admin ownership |
| `SetOperator(addr, isOp)` | Admin  | Add/remove operator      |
| `Update(nef, manifest)`   | Admin  | Upgrade contract         |

### Pause Control

| Method                           | Access         | Description               |
| -------------------------------- | -------------- | ------------------------- |
| `SetGlobalPause(paused)`         | Admin/Operator | Pause/resume ALL apps     |
| `SetAppPause(appId, paused)`     | Admin/Operator | Pause/resume specific app |
| `SetAppsPause(appIds[], paused)` | Admin/Operator | Batch pause/resume apps   |

### Query Methods

| Method               | Returns | Description                    |
| -------------------- | ------- | ------------------------------ |
| `Admin()`            | UInt160 | Current admin address          |
| `IsGloballyPaused()` | bool    | Global pause state             |
| `IsAppPaused(appId)` | bool    | Specific app pause state       |
| `IsOperator(addr)`   | bool    | Check if address is operator   |
| `IsPaused(appId)`    | bool    | Combined check (global OR app) |

## Events

### GlobalPauseChanged

```csharp
event GlobalPauseChanged(bool paused, UInt160 changedBy)
```

Emitted when global pause state changes.

### AppPauseChanged

```csharp
event AppPauseChanged(string appId, bool paused, UInt160 changedBy)
```

Emitted when a specific app's pause state changes.

## Usage Flow

### Initial Setup

```
1. Deploy PauseRegistry
2. Set operators (optional): SetOperator(operatorAddr, true)
3. Configure MiniApps: Each MiniApp calls SetPauseRegistry(registryAddr)
```

### Emergency Pause (Global)

```
1. Admin/Operator calls SetGlobalPause(true)
2. All MiniApps immediately stop accepting operations
3. Event: GlobalPauseChanged(true, caller)
```

### Resume Operations

```
1. Admin/Operator calls SetGlobalPause(false)
2. All MiniApps resume normal operations
3. Event: GlobalPauseChanged(false, caller)
```

### Pause Specific App

```
1. Admin/Operator calls SetAppPause("builtin-lottery", true)
2. Only Lottery app stops, others continue
3. Event: AppPauseChanged("builtin-lottery", true, caller)
```

## Integration in MiniApps

MiniApps should check pause state before critical operations:

```csharp
private static void ValidateNotPaused()
{
    // Check local pause
    ExecutionEngine.Assert(!IsPaused(), "paused");

    // Check global pause from PauseRegistry
    UInt160 registry = PauseRegistry();
    if (registry != null && registry.IsValid)
    {
        bool globalPaused = (bool)Contract.Call(
            registry, "isPaused", CallFlags.ReadOnly,
            new object[] { APP_ID }
        );
        ExecutionEngine.Assert(!globalPaused, "globally paused");
    }
}
```

## Security Considerations

1. **Admin Key Security**: Admin key controls entire platform pause
2. **Operator Trust**: Only add trusted addresses as operators
3. **Response Time**: Global pause takes effect immediately
4. **Audit Trail**: All pause changes emit events for monitoring

## Contract Information

- **Name**: PauseRegistry
- **Author**: R3E Network
- **Version**: 1.0.0
