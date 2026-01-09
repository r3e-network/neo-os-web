//go:build scripts

// Batch register builtin MiniApps to AppRegistry contract
// Usage: go run -tags=scripts scripts/register_builtin_miniapps.go
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

// BuiltinApp defines a builtin MiniApp for registration
type BuiltinApp struct {
	AppID       string
	Name        string
	EntryURL    string
	Permissions []string
}

var builtinApps = []BuiltinApp{
	// Gaming apps - using miniapp- prefix as standard
	{"miniapp-lottery", "Lottery", "miniapps-uniapp/apps/lottery", []string{"wallet", "payments", "rng"}},
	{"miniapp-coin-flip", "Coin Flip", "miniapps-uniapp/apps/coin-flip", []string{"wallet", "payments", "rng"}},
	{"miniapp-dice-game", "Dice Game", "miniapps-uniapp/apps/dice-game", []string{"wallet", "payments", "rng"}},
	{"miniapp-secret-poker", "Secret Poker", "miniapps-uniapp/apps/secret-poker", []string{"wallet", "payments", "rng", "compute"}},
	{"miniapp-red-envelope", "Red Envelope", "miniapps-uniapp/apps/red-envelope", []string{"wallet", "payments", "rng"}},
	{"miniapp-gas-circle", "GAS Circle", "miniapps-uniapp/apps/gas-circle", []string{"wallet", "payments", "rng", "automation"}},
	{"miniapp-scratch-card", "Scratch Card", "miniapps-uniapp/apps/scratch-card", []string{"wallet", "payments", "rng"}},
	{"miniapp-neo-crash", "Neo Crash", "miniapps-uniapp/apps/neo-crash", []string{"wallet", "payments", "rng"}},
	// DeFi apps
	{"miniapp-flashloan", "Flash Loan", "miniapps-uniapp/apps/flashloan", []string{"wallet", "payments"}},
	// Governance apps
	{"miniapp-gov-booster", "Gov Booster", "miniapps-uniapp/apps/gov-booster", []string{"wallet", "payments", "governance", "automation", "datafeed"}},
	{"miniapp-gov-merc", "Gov Merc", "miniapps-uniapp/apps/gov-merc", []string{"wallet", "payments", "governance"}},
	// Utility apps
	{"miniapp-guardian-policy", "Guardian Policy", "miniapps-uniapp/apps/guardian-policy", []string{"wallet", "payments", "compute"}},
	{"miniapp-heritage-trust", "Heritage Trust", "miniapps-uniapp/apps/heritage-trust", []string{"wallet", "payments", "automation"}},
	{"miniapp-time-capsule", "Time Capsule", "miniapps-uniapp/apps/time-capsule", []string{"wallet", "payments"}},
	{"miniapp-dev-tipping", "EcoBoost", "miniapps-uniapp/apps/dev-tipping", []string{"wallet", "payments"}},
}

func main() {
	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║   Batch Register Builtin MiniApps to AppRegistry               ║")
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")

	ctx := context.Background()

	wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
	if wif == "" {
		fmt.Println("❌ NEO_TESTNET_WIF required")
		os.Exit(1)
	}

	privKey, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("❌ Invalid WIF: %v\n", err)
		os.Exit(1)
	}
	pubKeyHex := strings.ToLower(privKey.PublicKey().StringCompressed())

	rpcURL := os.Getenv("NEO_RPC_URL")
	if rpcURL == "" {
		rpcURL = "https://testnet1.neo.coz.io:443"
	}

	contractHash, err := util.Uint160DecodeStringLE(strings.TrimPrefix(os.Getenv("CONTRACT_APPREGISTRY_HASH"), "0x"))
	if err != nil || contractHash.Equals(util.Uint160{}) {
		fmt.Println("❌ CONTRACT_APPREGISTRY_HASH required")
		os.Exit(1)
	}

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{})
	if err != nil {
		fmt.Printf("❌ RPC connect failed: %v\n", err)
		os.Exit(1)
	}

	acc := wallet.NewAccountFromPrivateKey(privKey)
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("❌ Actor creation failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("📍 RPC: %s\n", rpcURL)
	fmt.Printf("📍 Developer: %s\n", acc.Address)
	fmt.Printf("📍 AppRegistry: 0x%s\n", contractHash.StringLE())
	fmt.Printf("📦 Apps to register: %d\n\n", len(builtinApps))

	registered := 0
	skipped := 0
	failed := 0

	for _, app := range builtinApps {
		fmt.Printf("━━━ %s ━━━\n", app.AppID)

		manifest := buildManifest(app, pubKeyHex)
		manifestHash, err := computeHash(manifest)
		if err != nil {
			fmt.Printf("   ❌ Hash failed: %v\n", err)
			failed++
			continue
		}

		// Check if already registered
		existing, _ := checkApp(act, contractHash, app.AppID)
		if existing {
			fmt.Printf("   ✅ Already registered\n")
			skipped++
			continue
		}

		// Register
		developerKey, _ := hex.DecodeString(pubKeyHex)
		txHash, _, err := act.SendCall(contractHash, "register",
			app.AppID, manifestHash, app.EntryURL, developerKey)
		if err != nil {
			fmt.Printf("   ❌ Register failed: %v\n", err)
			failed++
			continue
		}
		fmt.Printf("   📤 Register TX: %s\n", txHash.StringLE()[:16])

		// Wait and approve
		time.Sleep(5 * time.Second)
		txHash2, _, err := act.SendCall(contractHash, "setStatus", app.AppID, 1)
		if err != nil {
			fmt.Printf("   ⚠️  Approve failed: %v\n", err)
		} else {
			fmt.Printf("   📤 Approve TX: %s\n", txHash2.StringLE()[:16])
		}

		registered++
		time.Sleep(3 * time.Second)
	}

	fmt.Println("\n╔════════════════════════════════════════════════════════════════╗")
	fmt.Printf("║   Results: %d registered, %d skipped, %d failed               \n", registered, skipped, failed)
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
}

func buildManifest(app BuiltinApp, pubKeyHex string) map[string]any {
	perms := make(map[string]any)
	for _, p := range app.Permissions {
		if p == "wallet" {
			perms[p] = []string{"read-address"}
		} else {
			perms[p] = true
		}
	}

	return map[string]any{
		"app_id":                    app.AppID,
		"name":                      app.Name,
		"entry_url":                 app.EntryURL,
		"developer_pubkey":          pubKeyHex,
		"assets_allowed":            []string{"GAS"},
		"governance_assets_allowed": []string{"NEO"},
		"permissions":               perms,
		"sandbox_flags":             []string{"no-eval", "strict-csp"},
	}
}

func computeHash(manifest map[string]any) ([]byte, error) {
	payload, err := stableJSON(manifest)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256([]byte(payload))
	return sum[:], nil
}

func stableJSON(v any) (string, error) {
	var b strings.Builder
	if err := writeJSON(&b, v); err != nil {
		return "", err
	}
	return b.String(), nil
}

func writeJSON(b *strings.Builder, v any) error {
	switch val := v.(type) {
	case nil:
		b.WriteString("null")
	case map[string]any:
		keys := make([]string, 0, len(val))
		for k := range val {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteByte(',')
			}
			kj, _ := json.Marshal(k)
			b.Write(kj)
			b.WriteByte(':')
			writeJSON(b, val[k])
		}
		b.WriteByte('}')
	case []string:
		b.WriteByte('[')
		for i, s := range val {
			if i > 0 {
				b.WriteByte(',')
			}
			sj, _ := json.Marshal(s)
			b.Write(sj)
		}
		b.WriteByte(']')
	case []any:
		b.WriteByte('[')
		for i, item := range val {
			if i > 0 {
				b.WriteByte(',')
			}
			writeJSON(b, item)
		}
		b.WriteByte(']')
	default:
		enc, _ := json.Marshal(val)
		b.Write(enc)
	}
	return nil
}

func checkApp(act *actor.Actor, contract util.Uint160, appID string) (bool, error) {
	result, err := act.Call(contract, "getApp", appID)
	if err != nil {
		return false, err
	}
	if result.State != "HALT" || len(result.Stack) == 0 {
		return false, nil
	}
	return true, nil
}
