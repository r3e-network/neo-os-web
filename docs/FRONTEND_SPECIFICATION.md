# Neo MiniApp Platform - Frontend Specification

## Executive Summary

A professional, production-ready MiniApp platform for Neo N3 blockchain that enables users to discover, interact with, and develop MiniApps with confidential computing capabilities.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design System](#design-system)
3. [Page Structure](#page-structure)
4. [Core Features](#core-features)
5. [Component Library](#component-library)
6. [API Integration](#api-integration)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Architecture Overview

### Tech Stack

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Framework        | Next.js 14 (App Router)      |
| Language         | TypeScript                   |
| Styling          | Tailwind CSS + shadcn/ui     |
| State Management | Zustand                      |
| Data Fetching    | TanStack Query (React Query) |
| Forms            | React Hook Form + Zod        |
| Charts           | Recharts                     |
| Animations       | Framer Motion                |
| Icons            | Lucide React                 |
| Wallet           | @neoline/dapi, @o3-dapi      |

### Directory Structure

```
platform/host-app/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # Public marketing pages
│   │   ├── page.tsx              # Homepage
│   │   ├── about/
│   │   ├── docs/
│   │   └── pricing/
│   ├── (platform)/               # Authenticated platform
│   │   ├── dashboard/
│   │   ├── miniapps/
│   │   ├── wallet/
│   │   ├── secrets/
│   │   ├── developer/
│   │   └── settings/
│   ├── (miniapp)/                # MiniApp runtime
│   │   └── app/[appId]/
│   ├── api/                      # API routes
│   └── layout.tsx
├── components/
│   ├── ui/                       # Base UI components (shadcn)
│   ├── layout/                   # Layout components
│   ├── features/                 # Feature-specific components
│   └── miniapp/                  # MiniApp-related components
├── lib/
│   ├── api/                      # API clients
│   ├── hooks/                    # Custom hooks
│   ├── stores/                   # Zustand stores
│   ├── utils/                    # Utilities
│   └── wallet/                   # Wallet integration
├── styles/
│   └── globals.css
└── public/
    ├── images/
    └── miniapps/
```

---

## Design System

### Color Palette

```css
/* Primary - Neo Green */
--primary-50: #f0fdf4;
--primary-500: #22c55e;
--primary-600: #16a34a;
--primary-900: #14532d;

/* Secondary - Electric Blue */
--secondary-500: #3b82f6;
--secondary-600: #2563eb;

/* Accent - Purple */
--accent-500: #8b5cf6;
--accent-600: #7c3aed;

/* Neutral */
--gray-50: #f9fafb;
--gray-900: #111827;

/* Semantic */
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
--info: #06b6d4;
```

### Typography

```css
/* Font Family */
--font-sans: "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", monospace;

/* Font Sizes */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
```

### Spacing & Layout

- Container max-width: 1280px
- Grid: 12-column responsive grid
- Spacing scale: 4px base unit (4, 8, 12, 16, 24, 32, 48, 64)

### Component Variants

- **Buttons**: primary, secondary, outline, ghost, destructive
- **Cards**: default, elevated, bordered, gradient
- **Badges**: default, success, warning, error, info

---

## Page Structure

### 1. Homepage (`/`)

**Purpose**: Platform introduction and MiniApp discovery

**Sections**:

```
┌─────────────────────────────────────────────────────────────┐
│  Navigation Bar                                              │
│  [Logo] [MiniApps] [Docs] [Developer] [Stats]    [Connect]  │
├─────────────────────────────────────────────────────────────┤
│  Hero Section                                                │
│  "The Future of Decentralized Applications on Neo N3"       │
│  [Explore MiniApps] [Start Building]                        │
├─────────────────────────────────────────────────────────────┤
│  Platform Stats Bar                                          │
│  [Total Txs] [Active Users] [MiniApps] [TVL]                │
├─────────────────────────────────────────────────────────────┤
│  Featured MiniApps Carousel                                  │
│  [App1] [App2] [App3] [App4] →                              │
├─────────────────────────────────────────────────────────────┤
│  Category Tabs                                               │
│  [All] [Gaming] [DeFi] [Social] [Governance] [Utility]      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ MiniApp │ │ MiniApp │ │ MiniApp │ │ MiniApp │           │
│  │  Card   │ │  Card   │ │  Card   │ │  Card   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  Live Activity Feed                                          │
│  [Real-time transaction ticker]                             │
├─────────────────────────────────────────────────────────────┤
│  Platform Features                                           │
│  [TEE Security] [VRF Randomness] [Price Feeds] [Automation] │
├─────────────────────────────────────────────────────────────┤
│  Latest News / Announcements                                 │
│  [News Card 1] [News Card 2] [News Card 3]                  │
├─────────────────────────────────────────────────────────────┤
│  Rankings Section                                            │
│  [Top MiniApps] [Top Users] [Recent Winners]                │
├─────────────────────────────────────────────────────────────┤
│  Footer                                                      │
│  [Links] [Social] [Legal] [Newsletter]                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. MiniApp Discovery (`/miniapps`)

**Purpose**: Browse and search all MiniApps

**Features**:

- Search with filters (category, permissions, popularity)
- Sort by: trending, newest, most used, highest rated
- Grid/List view toggle
- MiniApp cards with quick stats

### 3. MiniApp Detail (`/miniapps/[appId]`)

**Purpose**: Detailed MiniApp information before launch

**Sections**:

- App header (icon, name, developer, rating)
- Screenshots/preview
- Description and features
- Permissions required
- Statistics (users, transactions, volume)
- Reviews and ratings
- Related MiniApps
- [Launch App] button

### 4. MiniApp Runtime (`/app/[appId]`)

**Purpose**: Full-screen MiniApp execution environment

**Features**:

- Sandboxed iframe for MiniApp
- Top bar with app info and controls
- Notification panel (slide-in)
- Transaction confirmation modal
- Back to platform button

### 5. Dashboard (`/dashboard`)

**Purpose**: User's personal dashboard

**Sections**:

- Wallet overview (balances, recent transactions)
- Favorite MiniApps
- Activity history
- Notifications
- Quick actions

### 6. Wallet (`/wallet`)

**Purpose**: Wallet management and transactions

**Features**:

- Connect wallet (NeoLine, O3, OneGate)
- Balance display (NEO, GAS, tokens)
- Deposit/Withdraw
- Transaction history
- Address book

### 7. Secrets Management (`/secrets`)

**Purpose**: Manage confidential computing secrets

**Features**:

- Create new secret
- List secrets with metadata
- Secret usage history
- Revoke/rotate secrets
- Access control settings

### 8. Statistics (`/stats`)

**Purpose**: Platform-wide statistics and analytics

**Sections**:

- Transaction volume charts
- Active users over time
- MiniApp usage breakdown
- Data feed values (live prices)
- Network health metrics

### 9. Developer Portal (`/developer`)

**Purpose**: Tools for MiniApp developers

**Sections**:

- Getting started guide
- SDK documentation
- API reference
- MiniApp submission
- Developer dashboard
- Analytics for published apps

### 10. Documentation (`/docs`)

**Purpose**: Platform documentation

**Sections**:

- User guides
- Developer documentation
- API reference
- FAQ
- Troubleshooting

---

## Core Features

### F1: Wallet Integration

```typescript
// lib/wallet/types.ts
interface WalletProvider {
    name: "neoline" | "o3" | "onegate";
    connect(): Promise<WalletAccount>;
    disconnect(): Promise<void>;
    getAccount(): Promise<WalletAccount>;
    getBalance(address: string): Promise<Balance>;
    signMessage(message: string): Promise<string>;
    invoke(params: InvokeParams): Promise<InvokeResult>;
}

interface WalletAccount {
    address: string;
    publicKey: string;
    label?: string;
}

interface Balance {
    neo: string;
    gas: string;
    tokens: TokenBalance[];
}
```

**Implementation**:

- Auto-detect installed wallets
- Persistent connection state
- Transaction signing flow
- Balance polling

### F2: OAuth Integration

```typescript
// lib/auth/oauth.ts
interface OAuthProvider {
    name: "google" | "twitter" | "github";
    authorize(): Promise<void>;
    callback(code: string): Promise<OAuthResult>;
    link(walletAddress: string): Promise<void>;
    unlink(): Promise<void>;
}

interface LinkedAccount {
    provider: string;
    providerId: string;
    email?: string;
    username?: string;
    linkedAt: Date;
}
```

**Flow**:

1. User connects wallet
2. User clicks "Link Account"
3. OAuth redirect to provider
4. Callback with auth code
5. Backend verifies and links to wallet address

### F3: Secret Token Management

```typescript
// lib/secrets/types.ts
interface Secret {
    id: string;
    name: string;
    type: "api_key" | "credential" | "custom";
    createdAt: Date;
    expiresAt?: Date;
    usageCount: number;
    allowedApps: string[];
    metadata: Record<string, string>;
}

interface CreateSecretParams {
    name: string;
    value: string;
    type: Secret["type"];
    expiresAt?: Date;
    allowedApps?: string[];
}
```

**Features**:

- Encrypted storage
- Access control per MiniApp
- Usage tracking
- Expiration management

### F4: Real-time Activity Feed

```typescript
// lib/activity/types.ts
interface ActivityEvent {
    id: string;
    type: "payment" | "win" | "draw" | "vote" | "trade";
    appId: string;
    appName: string;
    userAddress: string;
    amount?: string;
    txHash: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}
```

**Implementation**:

- WebSocket connection to backend
- Event aggregation and deduplication
- Animated ticker display
- Click to view transaction

### F5: Data Feed Display

```typescript
// lib/datafeed/types.ts
interface PriceFeed {
    symbol: string;
    price: number;
    change24h: number;
    changePercent24h: number;
    lastUpdated: Date;
    source: string;
}
```

**Display**:

- Live price ticker
- Sparkline charts
- Price alerts
- Historical data

---

## Component Library

### Layout Components

```
components/layout/
├── Navbar.tsx           # Main navigation
├── Footer.tsx           # Site footer
├── Sidebar.tsx          # Dashboard sidebar
├── PageHeader.tsx       # Page title and breadcrumbs
├── Container.tsx        # Max-width container
└── Grid.tsx             # Responsive grid
```

### Feature Components

```
components/features/
├── wallet/
│   ├── ConnectButton.tsx
│   ├── WalletModal.tsx
│   ├── BalanceDisplay.tsx
│   └── TransactionList.tsx
├── miniapp/
│   ├── MiniAppCard.tsx
│   ├── MiniAppGrid.tsx
│   ├── MiniAppCarousel.tsx
│   ├── MiniAppDetail.tsx
│   ├── MiniAppRuntime.tsx
│   └── MiniAppRating.tsx
├── stats/
│   ├── StatCard.tsx
│   ├── StatsBar.tsx
│   ├── ActivityTicker.tsx
│   ├── PriceFeedTicker.tsx
│   └── Charts/
├── auth/
│   ├── OAuthButtons.tsx
│   ├── LinkedAccounts.tsx
│   └── AuthGuard.tsx
├── secrets/
│   ├── SecretList.tsx
│   ├── SecretForm.tsx
│   └── SecretUsage.tsx
└── developer/
    ├── AppSubmitForm.tsx
    ├── AppAnalytics.tsx
    └── SDKDocs.tsx
```

### UI Components (shadcn/ui based)

```
components/ui/
├── button.tsx
├── card.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── input.tsx
├── label.tsx
├── select.tsx
├── tabs.tsx
├── toast.tsx
├── tooltip.tsx
├── badge.tsx
├── avatar.tsx
├── skeleton.tsx
├── table.tsx
├── pagination.tsx
└── ...
```

---

## API Integration

### Endpoints

```typescript
// lib/api/endpoints.ts
const API_ENDPOINTS = {
    // MiniApps
    miniapps: {
        list: "/api/miniapps",
        detail: (id: string) => `/api/miniapps/${id}`,
        stats: (id: string) => `/api/miniapps/${id}/stats`,
        reviews: (id: string) => `/api/miniapps/${id}/reviews`,
    },

    // User
    user: {
        profile: "/api/user/profile",
        activity: "/api/user/activity",
        notifications: "/api/user/notifications",
        favorites: "/api/user/favorites",
    },

    // Wallet
    wallet: {
        balance: "/api/wallet/balance",
        transactions: "/api/wallet/transactions",
        deposit: "/api/wallet/deposit",
    },

    // Secrets
    secrets: {
        list: "/api/secrets",
        create: "/api/secrets",
        detail: (id: string) => `/api/secrets/${id}`,
        revoke: (id: string) => `/api/secrets/${id}/revoke`,
    },

    // Stats
    stats: {
        platform: "/api/stats/platform",
        datafeeds: "/api/stats/datafeeds",
        activity: "/api/stats/activity",
    },

    // Developer
    developer: {
        apps: "/api/developer/apps",
        submit: "/api/developer/submit",
        analytics: (id: string) => `/api/developer/apps/${id}/analytics`,
    },

    // Auth
    auth: {
        oauth: (provider: string) => `/api/auth/${provider}`,
        callback: (provider: string) => `/api/auth/${provider}/callback`,
        link: "/api/auth/link",
        unlink: "/api/auth/unlink",
    },
};
```

### API Client

```typescript
// lib/api/client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 3,
        },
    },
});

export async function apiClient<T>(
    endpoint: string,
    options?: RequestInit,
): Promise<T> {
    const response = await fetch(endpoint, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

    if (!response.ok) {
        throw new ApiError(response.status, await response.text());
    }

    return response.json();
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Set up Next.js 14 with App Router
- [ ] Configure Tailwind CSS and shadcn/ui
- [ ] Implement design system tokens
- [ ] Create base layout components
- [ ] Set up Zustand stores
- [ ] Configure TanStack Query

### Phase 2: Core Pages (Week 3-4)

- [ ] Homepage with hero and features
- [ ] MiniApp discovery page
- [ ] MiniApp detail page
- [ ] Basic navigation and footer

### Phase 3: Wallet Integration (Week 5)

- [ ] Wallet connection flow
- [ ] Balance display
- [ ] Transaction history
- [ ] Deposit functionality

### Phase 4: Authentication (Week 6)

- [ ] OAuth integration (Google, Twitter, GitHub)
- [ ] Account linking flow
- [ ] User profile page

### Phase 5: MiniApp Runtime (Week 7-8)

- [ ] Sandboxed iframe environment
- [ ] SDK bridge communication
- [ ] Transaction confirmation flow
- [ ] Notification system

### Phase 6: Advanced Features (Week 9-10)

- [ ] Secrets management
- [ ] Statistics dashboard
- [ ] Data feed display
- [ ] Activity feed

### Phase 7: Developer Portal (Week 11-12)

- [ ] Developer documentation
- [ ] App submission flow
- [ ] Developer analytics
- [ ] SDK documentation

### Phase 8: Polish & Launch (Week 13-14)

- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Mobile responsiveness
- [ ] Security review
- [ ] Production deployment

---

## MiniApp Design Guidelines

Each built-in MiniApp should follow these design principles:

### Gaming MiniApps

- **Color**: Vibrant, exciting colors
- **Animation**: Engaging micro-interactions
- **Sound**: Optional sound effects
- **Layout**: Game-focused, minimal distractions

### DeFi MiniApps

- **Color**: Professional, trust-inspiring
- **Data**: Clear charts and numbers
- **Actions**: Prominent CTAs
- **Safety**: Clear risk warnings

### Social MiniApps

- **Color**: Warm, inviting
- **Interaction**: Easy sharing
- **Community**: User avatars and activity
- **Engagement**: Gamification elements

### Governance MiniApps

- **Color**: Neutral, authoritative
- **Information**: Clear proposal details
- **Voting**: Simple, accessible
- **Transparency**: Vote counts and results

---

## Quality Checklist

### Performance

- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size < 200KB (initial)

### Accessibility

- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast ratios

### Security

- [ ] CSP headers configured
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secure wallet interactions

### Mobile

- [ ] Responsive design
- [ ] Touch-friendly targets
- [ ] Mobile wallet support
- [ ] PWA capabilities
