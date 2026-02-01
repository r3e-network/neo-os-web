# Terminology Consistency Guide

## Standard Terminology

### MiniApp

- **Correct**: "MiniApp" (PascalCase, one word)
- **Usage**:
    - In code: `MiniApp` (type names, component names)
    - In UI text: "MiniApp" or "MiniApps"
    - In URLs: `/miniapps/`
- **Avoid**: "Mini App", "mini app", "miniapp", "mini-app"

### GAS (Neo Network Token)

- **Correct**: "GAS" (all uppercase)
- **Usage**:
    - In UI: "GAS" when referring to the token
    - In technical contexts: "GAS fee", "GAS cost"
- **Avoid**: "Gas", "gas" (except in variable names following camelCase)

### Neo (Blockchain)

- **Correct**: "Neo" (capitalized)
- **Usage**: "Neo blockchain", "Neo network", "Neo wallet"
- **Avoid**: "neo", "NEO" (except in constants)

### Wallet vs Account

- **Wallet**: External wallet connection (NeoLine, O3, OneGate)
- **Account**: User account (can be wallet-based or OAuth-based)
- **Usage**:
    - "Connect Wallet" - for wallet connection
    - "Account Settings" - for user profile/settings

### OAuth vs Social

- **OAuth**: Technical term in code
- **Social Connections**: User-facing term in UI
- **Usage**:
    - Code: `OAuthProvider`, `oauthAccounts`
    - UI: "Social Connections", "Link Google Account"

## UI Text Standards

### Buttons

- Use title case: "Connect Wallet", "Create Token", "Change Password"
- Be action-oriented: "Export Private Key" not "Private Key Export"

### Headings

- Use title case for main headings
- Use sentence case for descriptions

### Error Messages

- Be specific and actionable
- Example: "Invalid password. Please try again." not "Error"

### Success Messages

- Be clear and confirmatory
- Example: "Password changed successfully" not "Success"

## Code Conventions

### File Naming

- Components: PascalCase (e.g., `SecretManagement.tsx`)
- Utilities: kebab-case (e.g., `neo-account.ts`)
- API routes: kebab-case (e.g., `change-password.ts`)

### Variable Naming

- camelCase for variables and functions
- PascalCase for types and interfaces
- UPPER_SNAKE_CASE for constants

### Type Names

- Use descriptive names: `OAuthProvider` not `Provider`
- Suffix interfaces with Props: `SecretManagementProps`
- Avoid generic names: `UserSecret` not `Secret`
