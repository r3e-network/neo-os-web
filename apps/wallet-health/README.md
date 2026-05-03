# Wallet Health MiniApp

Wallet Health is a front-end utility that helps Neo users review wallet readiness, balances, and safety hygiene. It stores checklist state locally on the device and does not require a smart contract.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-wallet-health` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Host-native React playarea |

## Summary

Comprehensive wallet health monitoring and security assessment tool

Wallet Health provides a complete security and readiness checkup for your Neo N3 wallet. Monitor connection status, track NEO/GAS balances, complete a safety checklist, and receive personalized recommendations to improve your wallet security posture.

## Features

- **🔗 Neo N3 Connection Status**: Verify you're connected to the correct blockchain network with visual indicators
- **💰 NEO/GAS Balance Check**: Monitor your token balances in real-time with automatic refresh
- **✅ Safety Checklist**: Interactive 6-point security checklist with local persistence
- **📊 Risk Level Assessment**: Automated risk scoring (High/Medium/Low) based on your configuration
- **💡 Actionable Recommendations**: Personalized suggestions to improve wallet health
- **📈 Health Statistics**: Visual dashboard showing all key wallet metrics
- **🎨 Responsive Design**: Works seamlessly on desktop and mobile devices
- **💾 Local Storage**: Checklist progress saved locally, no server needed

## Usage

### Getting Started

1. **Open the App**: Open Wallet Health from your Neo MiniApp dashboard
2. **Connect Your Wallet**: Click "Connect Wallet" to link your Neo N3 wallet
3. **Review Health Dashboard**: See your wallet health score and recommendations

### Health Tab - Wallet Overview

1. **Connection Status Card**:
   - Shows wallet connection state (Connected/Disconnected)
   - Displays current network (Neo N3)
   - Visual indicators for healthy/unhealthy states

2. **Balance Card**:
   - Real-time NEO balance display
   - Real-time GAS balance display
   - One-click refresh button
   - Risk indicator for low GAS

3. **Risk Assessment Pill**:
   - **Low Risk** (green): 80%+ safety score
   - **Medium Risk** (yellow): 50-79% safety score
   - **High Risk** (red): Below 50% safety score
   - Based on checklist completion and GAS balance

4. **Recommendations Card**:
   - Personalized security suggestions
   - Updates based on your checklist status
   - Common recommendations include:
     - Back up your wallet
     - Maintain sufficient GAS balance
     - Review connected app permissions

### Checklist Tab - Security Assessment

1. **Safety Score Display**:
   - Percentage score (0-100%)
   - Visual progress bar
   - Updates in real-time as you complete items

2. **Six-Point Security Checklist**:

   | Checklist Item | Auto-Checked | Description |
   |----------------|--------------|-------------|
   | ✅ Wallet Backup | No | Have you backed up your wallet seed phrase? |
   | ⛽ GAS Balance | Yes | Do you have sufficient GAS for transactions? |
   | 🔐 App Permissions | No | Have you reviewed connected app permissions? |
   | 📱 Device Security | No | Is your device protected with PIN/biometrics? |
   | 🔒 Hardware Wallet | No | Are you using a hardware wallet for large holdings? |
   | 🛡️ Two-Factor Auth | No | Have you enabled 2FA where available? |

3. **Completing Checklist Items**:
   - Tap any item to toggle completion
   - Auto-checked items update automatically
   - Progress saved automatically to device storage
   - Score recalculates instantly

### Documentation Tab

1. **App Overview**: Learn about Wallet Health features
2. **Usage Steps**: Quick guide to using the app
3. **Feature Details**: Explanation of each health metric
4. **Security Best Practices**: Tips for maintaining wallet health

### Understanding Your Health Score

**Scoring System:**
- Each checklist item worth ~16.7% (6 items total)
- GAS balance checked automatically
- Manual items require your confirmation

**Score Interpretation:**

| Score | Risk Level | Meaning |
|-------|------------|---------|
| 0-49% | 🔴 High | Immediate attention needed |
| 50-79% | 🟡 Medium | Some improvements recommended |
| 80-100% | 🟢 Low | Good wallet health |

**Improving Your Score:**
1. Complete all manual checklist items
2. Maintain adequate GAS balance (≥1 GAS recommended)
3. Follow personalized recommendations
4. Regular check-ins (recommended monthly)

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Wallet Health Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                   User Interface                     │  │
│   │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│   │  │  Health Tab │  │ Checklist Tab│  │   Docs Tab  │ │  │
│   │  │  (Overview) │  │  (Security)  │  │  (Help)     │ │  │
│   │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │  │
│   │         └─────────────────┼─────────────────┘        │  │
│   └───────────────────────────┼──────────────────────────┘  │
│                               │                             │
│   ┌───────────────────────────▼──────────────────────────┐  │
│   │              Host-native React State Logic                  │  │
│   │  ┌────────────────────────────────────────────────┐  │  │
│   │  │  State Management                              │  │  │
│   │  │  - balances (neo, gas)                         │  │  │
│   │  │  - checklistState (6 items)                    │  │  │
│   │  │  - safetyScore (computed)                      │  │  │
│   │  │  - recommendations (computed)                  │  │  │
│   │  └────────────────────────────────────────────────┘  │  │
│   └───────────────────────────┬──────────────────────────┘  │
│                               │                             │
│   ┌───────────────────────────▼──────────────────────────┐  │
│   │              Data Sources                             │  │
│   │  ┌──────────────┐  ┌──────────────────────────────┐  │  │
│   │  │  @neo/       │  │  Local Storage               │  │  │
│   │  │  host wallet SDK  │  │  (localStorage)        │  │  │
│   │  │              │  │  - checklistState            │  │  │
│   │  │  - address   │  │  - Persistent across sessions│  │  │
│   │  │  - chainType │  │                              │  │  │
│   │  │  - invokeRead│  │                              │  │  │
│   │  └──────┬───────┘  └──────────────────────────────┘  │  │
│   │         │                                             │  │
│   │         └──────────────────► Neo N3 Blockchain        │  │
│   │                            (NEO/GAS balances)         │  │
│   └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Balance Checking:**
1. User connects wallet
2. App invokes `balanceOf` on NEO contract
3. App invokes `balanceOf` on GAS contract
4. Balances displayed with formatting
5. Auto-checks GAS checklist item if ≥ 0.1 GAS

**Checklist Management:**
1. User toggles checklist item
2. State updated in reactive object
3. Saved to local storage immediately
4. Safety score recalculated
5. Recommendations updated
6. UI reflects changes

**Risk Assessment:**
```typescript
// Risk calculation logic
if (safetyScore >= 80) return 'Low Risk';
if (safetyScore >= 50) return 'Medium Risk';
return 'High Risk';
```

### Privacy & Security

**Local-Only Data:**
- Checklist state stored on device only
- No server communication for checklist
- Balances fetched directly from blockchain
- No analytics or tracking

**Data Persistence:**
- Uses host runtime storage API
- Survives app restarts
- Cleared if app data deleted
- Not synced across devices

### Smart Contract Interaction

**NEO Token Contract:**
- Hash: `0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5`
- Method: `balanceOf`
- Returns: Raw NEO balance (integer)

**GAS Token Contract:**
- Hash: `0xd2a4cff31913016155e38e474a2c06d08be276cf`
- Method: `balanceOf`
- Returns: Raw GAS balance (Fixed8)

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ✅ Yes |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- No miniapp contract is deployed.
- The app reads wallet balances and derives checklist results locally; it does not use legacy receipt relays or Morpheus callback contracts.

## Network Configuration

No on-chain contract is deployed.

## Assets

- **Allowed Assets**: NEO, GAS

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for H5
npm run build
```

### Project Structure

```
apps/wallet-health/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # Main health dashboard
│   │   │   └── wallet-health-theme.scss
│   │   └── docs/
│   │       └── index.vue              # Documentation page
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### Key Components

**Health Dashboard (`index.vue`):**
- Connection status monitoring
- Balance display with refresh
- Risk level computation
- Recommendations generation

**Checklist System:**
- 6 security checkpoints
- Automatic GAS check
- Persistent local storage
- Real-time score calculation

**Theme System:**
- Health-themed color palette
- Status indicators (success/warning/danger)
- Responsive card layouts

### State Management

```typescript
// Core reactive state
const balances = reactive({
  neo: 0n,
  gas: 0n,
});

const checklistState = reactive<Record<string, boolean>>({});

// Computed values
const safetyScore = computed(() => {
  const completed = completedChecklistCount.value;
  const total = totalChecklistCount.value;
  return Math.round((completed / total) * 100);
});

const gasOk = computed(() => balances.gas >= 10000000n); // 0.1 GAS
```

## Security Checklist Details

### 1. Wallet Backup (Manual)
**Question**: Have you backed up your wallet seed phrase?

**Why it matters**: Without a backup, losing your device means losing access to funds permanently.

**How to complete**:
- Write down your 12/24 word seed phrase
- Store in multiple secure physical locations
- Never store digitally or photograph
- Verify backup by restoring wallet

### 2. GAS Balance (Auto-Checked)
**Question**: Do you have sufficient GAS for transactions?

**Why it matters**: All Neo N3 transactions require GAS fees. Without GAS, you cannot transfer tokens or interact with contracts.

**Threshold**: Currently set to 0.1 GAS minimum

### 3. App Permissions (Manual)
**Question**: Have you reviewed connected app permissions?

**Why it matters**: Over time, you may have granted permissions to apps you no longer use, creating attack surface.

**How to complete**:
- Review connected dApps in your wallet
- Disconnect unused or untrusted apps
- Understand what each permission allows

### 4. Device Security (Manual)
**Question**: Is your device protected with PIN/biometrics?

**Why it matters**: Physical access to an unlocked device can compromise your wallet.

**How to complete**:
- Enable screen lock on your device
- Use strong PIN/password (not simple patterns)
- Enable biometric authentication if available
- Set short auto-lock timeout

### 5. Hardware Wallet (Manual)
**Question**: Are you using a hardware wallet for large holdings?

**Why it matters**: Hardware wallets keep private keys offline, protecting against malware and hacks.

**How to complete**:
- Purchase reputable hardware wallet (Ledger, Trezor)
- Transfer significant holdings to hardware wallet
- Keep hardware wallet firmware updated
- Store recovery seed securely

### 6. Two-Factor Auth (Manual)
**Question**: Have you enabled 2FA where available?

**Why it matters**: 2FA adds an additional layer of security beyond passwords.

**How to complete**:
- Enable 2FA on exchange accounts
- Use authenticator apps (not SMS)
- Consider security key (YubiKey)
- Store backup codes securely

## Troubleshooting

**Wallet not connecting:**
- Ensure Neo wallet extension is installed
- Check you're on Neo N3 network
- Try refreshing the page
- Verify wallet has accounts

**Balances showing zero:**
- Check you're connected to correct network
- Verify wallet address is correct
- Click refresh button to update
- Ensure tokens are on Neo N3 (not legacy)

**Checklist not saving:**
- Local storage may be disabled
- Try in different browser
- Check browser privacy settings
- Incognito mode may block storage

**Score calculation wrong:**
- GAS item auto-checks based on balance
- Other items require manual toggle
- Refresh page to recalculate
- Check local storage permissions

**Wrong chain warning:**
- Connect to Neo N3 network
- Switch network in your wallet
- Click "Switch to Neo" button

## Recommendations Reference

| Trigger | Recommendation |
|---------|----------------|
| !checklistState.backup | "⚠️ Back up your wallet seed phrase immediately. Store it in a safe, offline location." |
| !gasOk | "⚠️ Your GAS balance is low. Purchase GAS to ensure you can pay transaction fees." |
| !checklistState.permissions | "ℹ️ Review and revoke permissions for apps you no longer use." |

## Support

For wallet security questions, consult the Neo N3 security documentation.

For app technical issues, contact the Neo MiniApp team.

---

**Remember**: This app provides recommendations only. Always do your own research and consult security professionals for significant holdings.
