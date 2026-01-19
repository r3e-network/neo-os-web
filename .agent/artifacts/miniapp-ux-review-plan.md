# MiniApp UX Review & Refactoring Plan

## Objective
Review and refactor all 39 MiniApps to:
1. **Highlight core functionality** - Make the primary action clearly visible
2. **Improve user-friendliness** - Clear CTAs, intuitive navigation, helpful onboarding
3. **Consistent design** - Follow E-Robo/Glassmorphism design language

## Global Refactoring Progress
- [x] **Global UI Standardization**:
  - [x] Standardize Left Panel (Header layout, Banner/Logo/Status alignment, Description placement).
  - [x] Standardize Assets (PNG only, remove SVGs).
- [ ] **Functional Review**:
  - [ ] Verify Launching State for all apps.

## MiniApp Categories & Core Actions

### GAMING (7 apps)
| App | Core Action | Status |
|-----|-------------|--------|
| burn-league | Burn GAS tokens | ⚠️ IMPROVED (UI loads, data error) |
| coin-flip | Flip coin to gamble | ⏳ |
| lottery | Buy lottery tickets | ✅ FIXED |
| million-piece-map | Claim map pieces | ⏳ |
| neo-gacha | Open gacha boxes | ✅ FIXED (Contract Address Added) |
| turtle-match | Match turtles game | ⏳ |
| on-chain-tarot | Draw tarot cards | ⏳ |

### DEFI (9 apps)
| App | Core Action | Status |
|-----|-------------|--------|
| self-loan | Take a self-loan (borrow against collateral) | ⏳ |
| flashloan | Execute flash loan | ✅ FIXED |
| neo-swap | Swap tokens | ⏳ |
| neoburger | Stake NEO for bNEO | ⏳ |
| piggy-bank | Deposit savings | ✅ FIXED (Chain ID Updated) |
| compound-capsule | Compound rewards | ⏳ |
| neo-convert | Convert tokens | ⏳ |
| neo-treasury | Treasury management | ⏳ |
| gas-sponsor | Sponsor GAS fees | ⏳ |

### SOCIAL (9 apps)
| App | Core Action | Status |
|-----|-------------|--------|
| breakup-contract | Create/sign breakup contract | ✅ FIXED |
| daily-checkin | Check in daily | ⏳ |
| dev-tipping | Tip developers | ⏳ |
| red-envelope | Send/claim red envelopes | ⏳ |
| hall-of-fame | View/nominate hall of fame | ⏳ |
| memorial-shrine | Create memorials | ⏳ |
| heritage-trust | Manage inheritance | ⏳ |
| time-capsule | Create/open time capsules | ✅ FIXED |
| grant-share | Share grants | ⏳ |

### NFT (2 apps)
| App | Core Action | Status |
|-----|-------------|--------|
| garden-of-neo | Plant/grow NFT garden | ⏳ |
| neo-ns | Register/manage domains | ⏳ |

### GOVERNANCE (5 apps)
| App | Core Action | Status |
|-----|-------------|--------|
| candidate-vote | Vote for candidates | ✅ FIXED (CSP updated) |
| council-governance | Council voting | ⏳ |
| gov-merc | Governance marketplace | ⏳ |
| masquerade-dao | Anonymous DAO voting | ⏳ |
| guardian-policy | Set guardian policies | ⏳ |

### UTILITY (7 apps)
| App | Core Action | Status |
|-----|-------------|--------|
| explorer | Browse blockchain | ⏳ |
| neo-news-today | Read news | ⏳ |
| neo-multisig | Multi-sig transactions | ⏳ |
| unbreakable-vault | Secure storage | ⏳ |
| doomsday-clock | View countdown | ⏳ |
| ex-files | File storage | ⏳ |
| graveyard | View burned assets | ⏳ |

## UX Principles to Apply

### 1. Hero Section
- Large, prominent CTA button for core action
- Clear value proposition in 1 sentence
- Visual representation of what the app does

### 2. Onboarding
- First-time user hints/tooltips
- Simple 3-step explanation if needed
- Demo mode where applicable

### 3. Navigation
- Core action accessible within 1 click from landing
- Clear tab structure (max 4-5 tabs)
- Docs tab for detailed information

### 4. Feedback
- Loading states with meaningful messages
- Success animations for completed actions
- Error messages with recovery suggestions

## Review Process

For each app:
1. Open the app and screenshot current state
2. Identify the core action
3. Check if core action is immediately visible
4. List improvements needed
5. Implement changes
6. Verify and mark complete

---

## Progress Tracker

- [ ] Phase 1: Gaming apps (7)
- [ ] Phase 2: DeFi apps (9)
- [ ] Phase 3: Social apps (9)
- [ ] Phase 4: NFT apps (2)
- [ ] Phase 5: Governance apps (5)
- [ ] Phase 6: Utility apps (7)
