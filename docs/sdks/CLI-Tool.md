# CLI Tool

> Command-line interface for the Neo Service Layer

## Overview

The CLI tool provides a powerful command-line interface for interacting with all Neo Service Layer APIs.

| Feature            | Description                    |
| ------------------ | ------------------------------ |
| **Cross-platform** | Works on macOS, Linux, Windows |
| **Shell Complete** | Tab completion for all shells  |
| **Scriptable**     | JSON output for automation     |
| **Interactive**    | Watch mode for real-time data  |

## Requirements

- macOS 10.15+, Linux (glibc 2.17+), or Windows 10+
- API key from Neo Service Layer

## Installation

```bash
# npm
npm install -g @neo/service-layer-cli

# Homebrew
brew install neo-service-layer

# Binary download
curl -sSL https://get.neo.org/cli | sh
```

## Shell Completion

Enable tab completion for your shell:

```bash
# Bash
neo completion bash >> ~/.bashrc

# Zsh
neo completion zsh >> ~/.zshrc

# Fish
neo completion fish > ~/.config/fish/completions/neo.fish
```

## Configuration

```bash
# Set API key
neo config set api-key YOUR_API_KEY

# Set network
neo config set network testnet

# View config
neo config list
```

## Global Options

| Option      | Short | Description               |
| ----------- | ----- | ------------------------- |
| `--json`    | `-j`  | Output as JSON            |
| `--quiet`   | `-q`  | Suppress non-error output |
| `--verbose` | `-v`  | Show detailed output      |
| `--network` | `-n`  | Override network setting  |
| `--help`    | `-h`  | Show help for command     |

## Commands

### Price Feeds

```bash
# Get price
neo price GAS-USD

# List all feeds
neo price list

# Watch price updates
neo price watch GAS-USD
```

### Randomness (VRF)

```bash
# Generate random number
neo random --min 1 --max 100

# Get result by ID
neo random get abc123
```

### Payments

```bash
# Send GAS
neo pay NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq 1.5

# Check transaction
neo pay status tx123
```

### Account

```bash
# View quota
neo account quota

# View API keys
neo account keys
```

## Output Formats

```bash
# JSON output
neo price GAS-USD --json

# Table output (default)
neo price list --table

# Quiet mode
neo pay ... --quiet
```

## Environment Variables

| Variable      | Description               |
| ------------- | ------------------------- |
| `NEO_API_KEY` | API key                   |
| `NEO_NETWORK` | Network (mainnet/testnet) |
| `NEO_OUTPUT`  | Output format             |

## Next Steps

- [JavaScript SDK](./JavaScript-SDK.md)
- [Go SDK](./Go-SDK.md)
- [Python SDK](./Python-SDK.md)

## Scripting Examples

### Bash Script

```bash
#!/bin/bash
# Monitor GAS price and alert if above threshold

THRESHOLD=10.0
while true; do
    PRICE=$(neo price GAS-USD --json | jq -r '.value')
    if (( $(echo "$PRICE > $THRESHOLD" | bc -l) )); then
        echo "Alert: GAS price is $PRICE"
    fi
    sleep 60
done
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Deploy with Neo CLI
  run: |
      neo config set api-key ${{ secrets.NEO_API_KEY }}
      neo pay $RECIPIENT $AMOUNT --quiet
```

## Exit Codes

| Code | Meaning              |
| ---- | -------------------- |
| 0    | Success              |
| 1    | General error        |
| 2    | Invalid arguments    |
| 3    | Authentication error |
| 4    | Network error        |
| 5    | Rate limit exceeded  |
