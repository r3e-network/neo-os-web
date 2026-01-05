# Architecture Overview

The Neo MiniApp Platform is a three-layer architecture providing secure, decentralized application hosting.

## System Layers

```
┌─────────────────────────────────────────┐
│           MiniApp Layer                 │
│  (Vue/React apps in sandboxed iframes)  │
├─────────────────────────────────────────┤
│           Host App Layer                │
│  (Next.js, wallet integration, SDK)     │
├─────────────────────────────────────────┤
│           Services Layer                │
│  (Edge Functions, Supabase, Neo N3)     │
└─────────────────────────────────────────┘
```

## Components

### Host App (Next.js)

- **Pages**: Landing, MiniApp viewer, Account
- **Components**: Wallet connection, MiniApp frame
- **Lib**: SDK bridge, i18n, authentication

### MiniApps (UniApp/Vue)

- Sandboxed iframe execution
- PostMessage communication with host
- Access to platform services via SDK

### Edge Functions (Supabase)

- VRF randomness generation
- Data feed oracles
- Transaction automation

## Data Flow

1. User connects wallet to Host App
2. Host App loads MiniApp in iframe
3. MiniApp calls SDK methods
4. SDK bridges to Edge Functions
5. Edge Functions interact with Neo N3

## Security

- **Iframe Sandbox**: MiniApps isolated
- **CSP Headers**: Strict content policy
- **Wallet Signing**: User approval required
