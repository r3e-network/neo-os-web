//go:build scripts

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/nspcc-dev/neo-go/pkg/encoding/address"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient"
	"github.com/nspcc-dev/neo-go/pkg/rpcclient/actor"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/manifest"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/nef"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/stackitem"
	"github.com/nspcc-dev/neo-go/pkg/wallet"
)

type flagshipTarget struct {
	Brand       string
	AppManifest string
	BuildNEF    string
	BuildMan    string
	AdminMethod string
}

type appManifest struct {
	ID        string            `json:"id"`
	Contracts map[string]string `json:"contracts"`
}

func resolveTargetNetwork() string {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv("NEO_TARGET_NETWORK")))
	switch raw {
	case "", "testnet", "neo-n3-testnet":
		return "neo-n3-testnet"
	case "mainnet", "neo-n3-mainnet":
		return "neo-n3-mainnet"
	default:
		return raw
	}
}

func resolveDefaultRPC(targetNetwork string) string {
	if targetNetwork == "neo-n3-mainnet" {
		return "https://mainnet1.neo.coz.io:443"
	}
	return "https://testnet1.neo.coz.io:443"
}

func resolveRPCTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("NEO_RPC_TIMEOUT"))
	if raw == "" {
		return 20 * time.Second
	}
	if d, err := time.ParseDuration(raw); err == nil {
		return d
	}
	return 20 * time.Second
}

func resolveSignerWIF(targetNetwork string) string {
	if explicit := strings.TrimSpace(os.Getenv("FLAGSHIP_WIF")); explicit != "" {
		return explicit
	}
	if targetNetwork == "neo-n3-mainnet" {
		if explicit := strings.TrimSpace(os.Getenv("FLAGSHIP_MAINNET_WIF")); explicit != "" {
			return explicit
		}
		return strings.TrimSpace(os.Getenv("NEO_MAINNET_WIF"))
	}
	if explicit := strings.TrimSpace(os.Getenv("FLAGSHIP_TESTNET_WIF")); explicit != "" {
		return explicit
	}
	return strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
}

var targets = []flagshipTarget{
	{"LastSurvivor", "apps/last-survivor/neo-manifest.json", "contracts/build/MiniAppLastSurvivor.nef", "contracts/build/MiniAppLastSurvivor.manifest.json", "admin"},
	{"GASBOX", "apps/gasbox/neo-manifest.json", "contracts/build/MiniAppGASBox.nef", "contracts/build/MiniAppGASBox.manifest.json", "admin"},
	{"Red Envelope", "apps/red-envelope/neo-manifest.json", "contracts/build/MiniAppRedEnvelope.nef", "contracts/build/MiniAppRedEnvelope.manifest.json", "admin"},
	{"Daily Check-in", "apps/daily-checkin/neo-manifest.json", "contracts/build/MiniAppDailyCheckin.nef", "contracts/build/MiniAppDailyCheckin.manifest.json", "admin"},
	{"FogPlay", "apps/fogplay/neo-manifest.json", "contracts/build/MiniAppFogPlay.nef", "contracts/build/MiniAppFogPlay.manifest.json", "admin"},
	{"SelfLoan", "apps/self-loan/neo-manifest.json", "contracts/build/MiniAppSelfLoan.nef", "contracts/build/MiniAppSelfLoan.manifest.json", "admin"},
	{"NeoPay", "apps/neo-pay/neo-manifest.json", "contracts/build/MiniAppNeoPay.nef", "contracts/build/MiniAppNeoPay.manifest.json", "admin"},
}

func main() {
	ctx := context.Background()
	targetNetwork := resolveTargetNetwork()
	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = resolveDefaultRPC(targetNetwork)
	}
	rpcTimeout := resolveRPCTimeout()

	wif := resolveSignerWIF(targetNetwork)
	if wif == "" {
		fmt.Println("FLAGSHIP_WIF or network-scoped flagship/mainnet/testnet WIF is required")
		os.Exit(1)
	}

	apply := strings.EqualFold(strings.TrimSpace(os.Getenv("APPLY_UPDATES")), "true")
	filterRaw := strings.TrimSpace(os.Getenv("FLAGSHIP_TARGETS"))
	targetFilter := map[string]struct{}{}
	if filterRaw != "" {
		for _, part := range strings.Split(filterRaw, ",") {
			token := strings.ToLower(strings.TrimSpace(part))
			if token != "" {
				targetFilter[token] = struct{}{}
			}
		}
	}

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{
		DialTimeout:    rpcTimeout,
		RequestTimeout: rpcTimeout,
	})
	if err != nil {
		fmt.Printf("RPC connect failed: %v\n", err)
		os.Exit(1)
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("Invalid WIF: %v\n", err)
		os.Exit(1)
	}
	acc := wallet.NewAccountFromPrivateKey(priv)
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("Actor creation failed: %v\n", err)
		os.Exit(1)
	}

	signerAddress := acc.Address
	fmt.Printf("Target network: %s\n", targetNetwork)
	fmt.Printf("Signer: %s\n", signerAddress)
	fmt.Printf("Mode: %s\n\n", map[bool]string{true: "apply", false: "dry-run"}[apply])

	type resultRow struct {
		Brand         string `json:"brand"`
		AppID         string `json:"app_id"`
		TargetNetwork string `json:"target_network"`
		ContractHash  string `json:"contract_hash"`
		AdminMethod   string `json:"admin_method"`
		AdminAddress  string `json:"admin_address,omitempty"`
		SignerAddress string `json:"signer_address"`
		Action        string `json:"action"`
		TxHash        string `json:"tx_hash,omitempty"`
		Error         string `json:"error,omitempty"`
	}

	rows := make([]resultRow, 0, len(targets))
	var failed bool

	for _, target := range targets {
		if len(targetFilter) > 0 && !matchesTargetFilter(target, targetFilter) {
			continue
		}

		row := resultRow{
			Brand:         target.Brand,
			SignerAddress: signerAddress,
			AdminMethod:   target.AdminMethod,
			TargetNetwork: targetNetwork,
			Action:        "skip",
		}

		manifestBytes, err := os.ReadFile(target.AppManifest)
		if err != nil {
			row.Error = fmt.Sprintf("read manifest: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		var app appManifest
		if err := json.Unmarshal(manifestBytes, &app); err != nil {
			row.Error = fmt.Sprintf("parse manifest: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		row.AppID = app.ID
		row.ContractHash = app.Contracts[targetNetwork]
		if row.ContractHash == "" {
			row.Error = fmt.Sprintf("missing %s hash in app manifest", targetNetwork)
			rows = append(rows, row)
			failed = true
			continue
		}

		contractHash, err := util.Uint160DecodeStringLE(strings.TrimPrefix(row.ContractHash, "0x"))
		if err != nil {
			row.Error = fmt.Sprintf("invalid contract hash: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}

		adminRes, err := act.Call(contractHash, target.AdminMethod)
		if err != nil {
			row.Error = fmt.Sprintf("call %s failed: %v", target.AdminMethod, err)
			rows = append(rows, row)
			failed = true
			continue
		}
		adminAddr, err := parseHash160ToAddress(adminRes.Stack, signerAddress)
		if err == nil {
			row.AdminAddress = adminAddr
		}

		if row.AdminAddress == "" || row.AdminAddress != signerAddress {
			row.Action = "blocked-admin-mismatch"
			if row.Error == "" {
				if row.AdminAddress == "" {
					row.Error = "unable to decode on-chain admin/owner"
				} else {
					row.Error = "signer does not match on-chain admin/owner"
				}
			}
			rows = append(rows, row)
			failed = true
			continue
		}

		nefBytes, err := os.ReadFile(target.BuildNEF)
		if err != nil {
			row.Error = fmt.Sprintf("read nef: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		manifestText, err := os.ReadFile(target.BuildMan)
		if err != nil {
			row.Error = fmt.Sprintf("read build manifest: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		if _, err := nef.FileFromBytes(nefBytes); err != nil {
			row.Error = fmt.Sprintf("invalid nef: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		m := new(manifest.Manifest)
		if err := json.Unmarshal(manifestText, m); err != nil {
			row.Error = fmt.Sprintf("invalid build manifest: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}

		if !apply {
			row.Action = "ready"
			rows = append(rows, row)
			continue
		}

		updateArity, err := resolveUpdateArity(ctx, client, contractHash)
		if err != nil {
			row.Action = "apply-failed"
			row.Error = fmt.Sprintf("resolve update arity failed: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}

		var txHash util.Uint256
		var vub uint32
		switch updateArity {
		case 2:
			txHash, vub, err = act.SendCall(contractHash, "update", nefBytes, string(manifestText))
		case 3:
			txHash, vub, err = act.SendCall(contractHash, "update", nefBytes, string(manifestText), nil)
		default:
			err = fmt.Errorf("unsupported update arity %d", updateArity)
		}
		if err != nil {
			row.Action = "apply-failed"
			row.Error = fmt.Sprintf("send update failed: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		row.Action = fmt.Sprintf("submitted(vub=%d)", vub)
		row.TxHash = txHash.StringLE()
		rows = append(rows, row)

		time.Sleep(3 * time.Second)
	}

	out, _ := json.MarshalIndent(rows, "", "  ")
	fmt.Println(string(out))

	if failed {
		os.Exit(1)
	}
}

func matchesTargetFilter(target flagshipTarget, filter map[string]struct{}) bool {
	candidates := []string{
		strings.ToLower(target.Brand),
		strings.ToLower(strings.TrimSuffix(pathBase(target.AppManifest), pathExt(target.AppManifest))),
		strings.ToLower(pathBase(pathDir(target.AppManifest))),
	}
	for _, candidate := range candidates {
		if _, ok := filter[candidate]; ok {
			return true
		}
	}
	return false
}

func pathBase(v string) string {
	parts := strings.Split(strings.ReplaceAll(v, "\\", "/"), "/")
	if len(parts) == 0 {
		return v
	}
	return parts[len(parts)-1]
}

func pathDir(v string) string {
	normalized := strings.ReplaceAll(v, "\\", "/")
	idx := strings.LastIndex(normalized, "/")
	if idx < 0 {
		return ""
	}
	return normalized[:idx]
}

func pathExt(v string) string {
	idx := strings.LastIndex(v, ".")
	if idx < 0 {
		return ""
	}
	return v[idx:]
}

func parseHash160ToAddress(stack []stackitem.Item, preferredAddress string) (string, error) {
	if len(stack) == 0 {
		return "", fmt.Errorf("empty stack")
	}
	raw, err := stack[0].TryBytes()
	if err != nil {
		return "", err
	}
	if len(raw) != util.Uint160Size {
		return "", fmt.Errorf("unexpected hash160 length %d", len(raw))
	}
	var candidates []string
	if hash, err := util.Uint160DecodeBytesBE(raw); err == nil {
		candidates = append(candidates, address.Uint160ToString(hash))
	}
	if hash, err := util.Uint160DecodeBytesLE(raw); err == nil {
		addr := address.Uint160ToString(hash)
		alreadySeen := false
		for _, existing := range candidates {
			if existing == addr {
				alreadySeen = true
				break
			}
		}
		if !alreadySeen {
			candidates = append(candidates, addr)
		}
	}
	if len(candidates) == 0 {
		return "", fmt.Errorf("unable to decode hash160")
	}
	for _, candidate := range candidates {
		if preferredAddress != "" && candidate == preferredAddress {
			return candidate, nil
		}
	}
	return candidates[0], nil
}

func resolveUpdateArity(ctx context.Context, client *rpcclient.Client, contractHash util.Uint160) (int, error) {
	state, err := client.GetContractStateByHash(contractHash)
	if err != nil {
		return 0, err
	}
	for _, method := range state.Manifest.ABI.Methods {
		if method.Name == "update" {
			return len(method.Parameters), nil
		}
	}
	return 0, fmt.Errorf("update method not found in remote manifest")
}
