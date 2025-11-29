package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/pkg/version"
)

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	defaultAddr := getenv("SERVICE_LAYER_ADDR", "http://localhost:8080")
	defaultToken := os.Getenv("SERVICE_LAYER_TOKEN")
	defaultTenant := os.Getenv("SERVICE_LAYER_TENANT")
	defaultRefreshToken := os.Getenv("SUPABASE_REFRESH_TOKEN")

	root := flag.NewFlagSet("slctl", flag.ContinueOnError)
	root.SetOutput(io.Discard)
	addrFlag := root.String("addr", defaultAddr, "Service Layer base URL (default env SERVICE_LAYER_ADDR)")
	tokenFlag := root.String("token", defaultToken, "Bearer token for authentication (env SERVICE_LAYER_TOKEN)")
	refreshFlag := root.String("refresh-token", defaultRefreshToken, "Supabase refresh token (env SUPABASE_REFRESH_TOKEN); used to obtain a new access token via /auth/refresh")
	tenantFlag := root.String("tenant", defaultTenant, "Tenant identifier for multi-tenant headers (env SERVICE_LAYER_TENANT)")
	timeoutFlag := root.Duration("timeout", 15*time.Second, "HTTP request timeout")
	showVersion := root.Bool("version", false, "Print slctl build information and exit")
	if err := root.Parse(args); err != nil {
		return usageError(err)
	}

	remaining := root.Args()
	if len(remaining) == 0 {
		return usageError(errors.New("no command specified"))
	}
	if *showVersion {
		fmt.Println(version.FullVersion())
		return nil
	}

	httpClient := &http.Client{Timeout: *timeoutFlag}
	client := &apiClient{
		baseURL:      strings.TrimRight(*addrFlag, "/"),
		token:        strings.TrimSpace(*tokenFlag),
		refreshToken: strings.TrimSpace(*refreshFlag),
		tenant:       strings.TrimSpace(*tenantFlag),
		http:         httpClient,
	}
	if err := client.ensureToken(ctx); err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	switch remaining[0] {
	case "accounts":
		return handleAccounts(ctx, client, remaining[1:])
	case "functions":
		return handleFunctions(ctx, client, remaining[1:])
	case "automation":
		return handleAutomation(ctx, client, remaining[1:])
	case "secrets":
		return handleSecrets(ctx, client, remaining[1:])
	case "gasbank":
		return handleGasBank(ctx, client, remaining[1:])
	case "oracle":
		return handleOracle(ctx, client, remaining[1:])
	case "health":
		return handleHealth(ctx, client, remaining[1:])
	case "datafeeds":
		return handleDataFeeds(ctx, client, remaining[1:])
	case "pricefeeds":
		return handlePriceFeeds(ctx, client, remaining[1:])
	case "random":
		return handleRandom(ctx, client, remaining[1:])
	case "cre":
		return handleCRE(ctx, client, remaining[1:])
	case "ccip":
		return handleCCIP(ctx, client, remaining[1:])
	case "vrf":
		return handleVRF(ctx, client, remaining[1:])
	case "datalink":
		return handleDataLink(ctx, client, remaining[1:])
	case "dta":
		return handleDTA(ctx, client, remaining[1:])
	case "datastreams":
		return handleDataStreams(ctx, client, remaining[1:])
	case "confcompute":
		return handleConfCompute(ctx, client, remaining[1:])
	case "workspace-wallets":
		return handleWorkspaceWallets(ctx, client, remaining[1:])
	case "jam":
		return handleJAM(ctx, client, remaining[1:])
	case "status":
		return handleStatus(ctx, client, remaining[1:])
	case "tenant":
		return handleTenant(ctx, client, remaining[1:])
	case "services":
		return handleServices(ctx, client, remaining[1:])
	case "audit":
		return handleAudit(ctx, client, remaining[1:])
	case "version":
		return handleVersion(ctx, client)
	case "neo":
		return handleNeo(ctx, client, remaining[1:])
	case "dashboard-link":
		return handleDashboardLink(client, remaining[1:])
	case "manifest":
		return handleManifest(ctx, client, remaining[1:])
	case "bus":
		return handleBus(ctx, client, remaining[1:])
	case "help", "-h", "--help":
		printRootUsage()
		return nil
	default:
		return usageError(fmt.Errorf("unknown command %q", remaining[0]))
	}
}

func usageError(err error) error {
	printRootUsage()
	return err
}

func printRootUsage() {
	fmt.Println(`Service Layer CLI (slctl)

Usage:
  slctl [global flags] <command> [subcommand] [flags]

Global Flags:
  --addr       Service Layer base URL (env SERVICE_LAYER_ADDR, default http://localhost:8080)
  --token      API bearer token (env SERVICE_LAYER_TOKEN)
  --tenant     Tenant identifier (sets X-Tenant-ID; env SERVICE_LAYER_TENANT)
  --timeout    HTTP timeout (default 15s)
  --version    Print CLI build information and exit

Commands:
  accounts     Manage accounts
  functions    Manage functions and executions
  automation   Manage automation jobs
  secrets      Manage account secrets
  gasbank      Manage gas bank accounts and transfers
  oracle       Manage oracle sources and requests
  datafeeds    Manage data feed definitions and submissions
  health       Show oracle/datafeed health for an account
  pricefeeds   Manage price feed definitions and snapshots
  random       Request deterministic randomness
  cre          Inspect Chainlink Reliability Engine assets
  ccip         Inspect cross-chain lanes and messages
  vrf          Inspect VRF keys and requests
  datalink     Inspect channel configurations and deliveries
  dta          Inspect digital transfer agency products and orders
  datastreams  Inspect stream configurations and frames
  confcompute  Inspect confidential-compute enclaves
  workspace-wallets Inspect linked signing wallets
  jam          Interact with JAM prototype (preimages, packages, reports)
  services     Introspect service descriptors
  bus          Publish events, push data, and invoke compute fan-out (admin only)
  audit        Fetch recent audit entries (admin JWT required)
  status       Show health/version/engine status (modules, APIs, descriptors via /system/status; supports --surface and --export; /healthz is unauthenticated)
  tenant       Echo the resolved tenant/user/role and REQUIRE_TENANT_HEADER state (uses /system/tenant)
  neo          Inspect Neo indexed data (status, checkpoint, blocks, snapshots)
               Subcommands: status|checkpoint|blocks|block|snapshots|storage|storage-diff|storage-summary|download|verify|verify-manifest|verify-all
  manifest     Fetch a snapshot manifest, verify hashes and signature, and report results
  dashboard-link Emit a ready-to-use dashboard URL with api/token/tenant query params
  version      Show CLI and server version information`)
}
