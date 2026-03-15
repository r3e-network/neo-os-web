# Neo News Today Neo新闻今日

Neo News Today - Neo MiniApp

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-neo-news-today` |
| **Category** | Utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |

## Summary

Your source for Neo ecosystem updates

Neo News Today (NNT) delivers the latest news, interviews, and events from the Neo blockchain ecosystem. Stay informed about developments, dApps, and community initiatives directly within your wallet.

## Features

- **📰 Latest News**: Real-time updates from the Neo News Today RSS feed
- **🌐 Ecosystem Coverage**: Comprehensive news on Neo N3 and legacy
- **👥 Community Focus**: Highlighting developers, projects, and community initiatives
- **📱 Article Reader**: In-app browser for seamless reading experience
- **🖼️ Rich Media**: Article images and formatted excerpts
- **📅 Date Sorting**: News sorted by publication date
- **📰 Newsroom Theme**: Professional newspaper-inspired design

## Usage

### Getting Started

1. **Launch the App**: Open Neo News Today from your Neo MiniApp dashboard
2. **Browse News**: View the latest articles on the News tab
3. **Read Articles**: Tap any article to read the full content

### Navigating the News Feed

**News Tab:**
1. **Loading State**: App fetches latest articles automatically
2. **Article Cards**: Each card displays:
   - Featured image (if available)
   - Article headline
   - Publication date
   - Brief excerpt/summary
   - "Read More" link
3. **Scroll**: Browse through up to 20 recent articles
4. **Tap to Read**: Click any article card to open the full article

**Article Detail View:**
1. Opens in-app browser for seamless reading
2. Original formatting preserved
3. All links functional within the reader
4. Swipe back to return to news list

**Documentation Tab:**
1. Learn about Neo News Today
2. Discover how to stay updated with the ecosystem
3. Find links to official resources

### Article Categories

Typical coverage includes:
- **Development Updates**: Neo core protocol improvements
- **Ecosystem Projects**: New dApps and tools launching
- **Community Events**: Hackathons, meetups, conferences
- **Interviews**: Conversations with Neo leaders and builders
- **Technical Deep Dives**: Detailed protocol explanations
- **Market Analysis**: Industry trends affecting Neo

### Staying Updated

**In-App:**
- Check the app regularly for new articles
- Pull down to refresh the feed
- Browse through historical articles

**External:**
- Visit neotoday.io for the full website
- Follow Neo News Today on social media
- Subscribe to email newsletters if available

## How It Works

### Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Neo News Today Data Flow                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────────┐         ┌──────────────────┐        │
│   │  Neo News Today  │         │   MiniApp API    │        │
│   │      RSS Feed    │◄────────│   (/api/nnt-news)│        │
│   └──────────────────┘         └────────┬─────────┘        │
│                                         │                   │
│                              ┌──────────▼──────────┐       │
│                              │  Data Processing    │       │
│                              │  - Parse RSS        │       │
│                              │  - Extract images   │       │
│                              │  - Format dates     │       │
│                              └──────────┬──────────┘       │
│                                         │                   │
│                              ┌──────────▼──────────┐       │
│                              │   Vue 3 Frontend    │       │
│                              │   - Article list    │       │
│                              │   - Detail viewer   │       │
│                              └─────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation

**Data Fetching:**
1. App calls `/api/nnt-news` endpoint
2. Backend fetches and parses RSS feed
3. Articles processed and formatted as JSON
4. Response cached for 15 minutes

**Article Display:**
1. JSON data rendered as cards
2. Images loaded asynchronously
3. Dates formatted to locale
4. Excerpts truncated for preview

**Detail View:**
1. Article URL passed to webview
2. In-app browser loads original content
3. Navigation controls provided

### Content Sources

Neo News Today aggregates from:
- Official Neo announcements
- Community project updates
- Developer blogs
- Event coverage
- Partner ecosystem news

## Permissions

| Permission | Required |
|------------|----------|
| Wallet | ❌ No |
| Payments | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |
| Governance | ❌ No |
| Automation | ❌ No |

## On-chain behavior

- No on-chain contract is deployed; the app relies on off-chain APIs and wallet signing flows.

## Network Configuration

No on-chain contract is deployed.

## Platform Contracts

### Testnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0x0bb8f09e6d3611bc5c8adbd79ff8af1e34f73193` |
| Governance | `0xc8f3bbe1c205c932aab00b28f7df99f9bc788a05` |
| PriceFeed | `0xc5d9117d255054489d1cf59b2c1d188c01bc9954` |
| RandomnessLog | `0x76dfee17f2f4b9fa8f32bd3f4da6406319ab7b39` |
| AppRegistry | `0x79d16bee03122e992bb80c478ad4ed405f33bc7f` |
| AutomationAnchor | `0x1c888d699ce76b0824028af310d90c3c18adeab5` |
| ServiceLayerGateway | `0x27b79cf631eff4b520dd9d95cd1425ec33025a53` |

### Mainnet

| Contract | Address |
| --- | --- |
| PaymentHub | `0xc700fa6001a654efcd63e15a3833fbea7baaa3a3` |
| Governance | `0x705615e903d92abf8f6f459086b83f51096aa413` |
| PriceFeed | `0x9e889922d2f64fa0c06a28d179c60fe1af915d27` |
| RandomnessLog | `0x66493b8a2dee9f9b74a16cf01e443c3fe7452c25` |
| AppRegistry | `0x583cabba8beff13e036230de844c2fb4118ee38c` |
| AutomationAnchor | `0x0fd51557facee54178a5d48181dcfa1b61956144` |
| ServiceLayerGateway | `0x7f73ae3036c1ca57cad0d4e4291788653b0fa7d7` |

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
apps/neo-news-today/
├── src/
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.vue              # News feed list
│   │   │   └── neo-news-today-theme.scss
│   │   └── detail/
│   │       └── index.vue              # Article webview
│   ├── composables/
│   │   └── useI18n.ts
│   └── static/
├── package.json
└── README.md
```

### API Response Format

```typescript
interface Article {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  image?: string;
  url: string;
}
```

### Styling

The app uses a newsroom-inspired design:
- Merriweather and Oswald fonts from Google Fonts
- Newspaper-style card layout
- Accent-colored date badges
- Professional serif typography for readability

## Troubleshooting

**Articles not loading:**
- Check internet connection
- Verify API endpoint availability
- Try refreshing the page

**Images not displaying:**
- Some articles may not have featured images
- Check browser image loading permissions
- Slow connections may delay image loading

**Article viewer blank:**
- Some websites may block iframe embedding
- Try opening in external browser
- Check for JavaScript errors

**Outdated articles:**
- Content updates when RSS feed refreshes
- Pull down to refresh manually
- Cache cleared on app restart

## Support

For content-related questions, contact Neo News Today directly at neotoday.io.

For app technical issues, contact the Neo MiniApp team.
