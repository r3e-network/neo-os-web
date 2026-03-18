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

type selectedTarget struct {
	Name         string
	AppManifest  string
	ContractHash string
	BuildNEF     string
	BuildMan     string
	AdminMethod  string
}

type selectedAppManifest struct {
	ID        string            `json:"id"`
	Contracts map[string]string `json:"contracts"`
}

var selectedTargets = []selectedTarget{
	{
		Name:        "MiniAppDiceGame",
		ContractHash: "0x1e448bf07a742da74084d4c64a61052980beb496",
		BuildNEF:    "contracts/build/MiniAppDiceGame.nef",
		BuildMan:    "contracts/build/MiniAppDiceGame.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppGasCircle",
		ContractHash: "0x4630b40a4e67882cfab3d3f5041c1da597b0c7b6",
		BuildNEF:    "contracts/build/MiniAppGasCircle.nef",
		BuildMan:    "contracts/build/MiniAppGasCircle.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppFlashLoan",
		AppManifest: "apps/flashloan/neo-manifest.json",
		BuildNEF:    "contracts/build/MiniAppFlashLoan.nef",
		BuildMan:    "contracts/build/MiniAppFlashLoan.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppExFiles",
		ContractHash: "0xb55358f282a519762ad8c7db57dff2f01bb8cd2a",
		BuildNEF:    "contracts/build/MiniAppExFiles.nef",
		BuildMan:    "contracts/build/MiniAppExFiles.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppMasqueradeDAO",
		ContractHash: "0xa79f897c8f1d6b1450b7204668b82cffd1bad4a0",
		BuildNEF:    "contracts/build/MiniAppMasqueradeDAO.nef",
		BuildMan:    "contracts/build/MiniAppMasqueradeDAO.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppMillionPieceMap",
		ContractHash: "0x4cac0ac79bac3b94c388fe0f27a9ed1a8e476cbf",
		BuildNEF:    "contracts/build/MiniAppMillionPieceMap.nef",
		BuildMan:    "contracts/build/MiniAppMillionPieceMap.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppGraveyard",
		AppManifest: "apps/graveyard/neo-manifest.json",
		BuildNEF:    "contracts/build/MiniAppGraveyard.nef",
		BuildMan:    "contracts/build/MiniAppGraveyard.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:        "MiniAppHeritageTrust",
		ContractHash: "0x42e14d04c17dad0b1d76ee7509e537791230431b",
		BuildNEF:    "contracts/build/MiniAppHeritageTrust.nef",
		BuildMan:    "contracts/build/MiniAppHeritageTrust.manifest.json",
		AdminMethod: "admin",
	},
	{
		Name:         "MiniAppHallOfFame",
		ContractHash: "0x00d44aefa345f72c0eb15036129a32a56c765474",
		BuildNEF:     "contracts/build/MiniAppHallOfFame.nef",
		BuildMan:     "contracts/build/MiniAppHallOfFame.manifest.json",
		AdminMethod:  "admin",
	},
	{
		Name:         "MiniAppTurtleMatch",
		ContractHash: "0x4750b2d55de0282579e66c2b1b6c07d9138380ad",
		BuildNEF:     "contracts/build/MiniAppTurtleMatch.nef",
		BuildMan:     "contracts/build/MiniAppTurtleMatch.manifest.json",
		AdminMethod:  "admin",
	},
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

func resolveSignerWIF(targetNetwork string) string {
	if explicit := strings.TrimSpace(os.Getenv("MINIAPP_UPDATE_WIF")); explicit != "" {
		return explicit
	}
	if targetNetwork == "neo-n3-mainnet" {
		return strings.TrimSpace(os.Getenv("NEO_MAINNET_WIF"))
	}
	return strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF"))
}

func resolveTargetFilter() map[string]struct{} {
	filterRaw := strings.TrimSpace(os.Getenv("MINIAPP_UPDATE_TARGETS"))
	result := map[string]struct{}{}
	if filterRaw == "" {
		return result
	}

	for _, part := range strings.Split(filterRaw, ",") {
		token := strings.ToLower(strings.TrimSpace(part))
		if token != "" {
			result[token] = struct{}{}
		}
	}

	return result
}

func matchesSelectedTarget(target selectedTarget, filter map[string]struct{}) bool {
	if len(filter) == 0 {
		return true
	}

	candidates := []string{
		strings.ToLower(target.Name),
		strings.ToLower(strings.TrimPrefix(target.Name, "MiniApp")),
		strings.ToLower(pathBase(pathDir(target.AppManifest))),
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, ok := filter[candidate]; ok {
			return true
		}
	}

	return false
}

func main() {
	ctx := context.Background()
	targetNetwork := resolveTargetNetwork()
	rpcURL := strings.TrimSpace(os.Getenv("NEO_RPC_URL"))
	if rpcURL == "" {
		rpcURL = resolveDefaultRPC(targetNetwork)
	}

	wif := resolveSignerWIF(targetNetwork)
	if wif == "" {
		fmt.Println("MINIAPP_UPDATE_WIF or network-scoped WIF is required")
		os.Exit(1)
	}

	apply := strings.EqualFold(strings.TrimSpace(os.Getenv("APPLY_UPDATES")), "true")
	filter := resolveTargetFilter()

	client, err := rpcclient.New(ctx, rpcURL, rpcclient.Options{
		DialTimeout:    20 * time.Second,
		RequestTimeout: 20 * time.Second,
	})
	if err != nil {
		fmt.Printf("RPC connect failed: %v\n", err)
		os.Exit(1)
	}

	priv, err := keys.NewPrivateKeyFromWIF(wif)
	if err != nil {
		fmt.Printf("invalid WIF: %v\n", err)
		os.Exit(1)
	}

	acc := wallet.NewAccountFromPrivateKey(priv)
	act, err := actor.NewSimple(client, acc)
	if err != nil {
		fmt.Printf("actor creation failed: %v\n", err)
		os.Exit(1)
	}

	signerAddress := acc.Address
	fmt.Printf("Target network: %s\n", targetNetwork)
	fmt.Printf("Signer: %s\n", signerAddress)
	fmt.Printf("Mode: %s\n\n", map[bool]string{true: "apply", false: "dry-run"}[apply])

	type resultRow struct {
		Name          string `json:"name"`
		TargetNetwork string `json:"target_network"`
		ContractHash  string `json:"contract_hash,omitempty"`
		AdminMethod   string `json:"admin_method"`
		AdminAddress  string `json:"admin_address,omitempty"`
		SignerAddress string `json:"signer_address"`
		AppID         string `json:"app_id,omitempty"`
		Action        string `json:"action"`
		TxHash        string `json:"tx_hash,omitempty"`
		Error         string `json:"error,omitempty"`
	}

	rows := make([]resultRow, 0, len(selectedTargets))
	var failed bool

	for _, target := range selectedTargets {
		if !matchesSelectedTarget(target, filter) {
			continue
		}

		row := resultRow{
			Name:          target.Name,
			TargetNetwork: targetNetwork,
			AdminMethod:   target.AdminMethod,
			SignerAddress: signerAddress,
			Action:        "skip",
		}

		contractHashLE, appID, err := resolveSelectedContractHash(target, targetNetwork)
		if err != nil {
			row.Error = err.Error()
			rows = append(rows, row)
			failed = true
			continue
		}
		row.ContractHash = contractHashLE
		row.AppID = appID

		contractHash, err := util.Uint160DecodeStringLE(strings.TrimPrefix(contractHashLE, "0x"))
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
			if row.AdminAddress == "" {
				row.Error = "unable to decode on-chain admin/owner"
			} else {
				row.Error = "signer does not match on-chain admin/owner"
			}
			rows = append(rows, row)
			failed = true
			continue
		}

		nefBytes, err := os.ReadFile(target.BuildNEF)
		if err != nil {
			row.Error = fmt.Sprintf("read nef failed: %v", err)
			rows = append(rows, row)
			failed = true
			continue
		}
		manifestText, err := os.ReadFile(target.BuildMan)
		if err != nil {
			row.Error = fmt.Sprintf("read build manifest failed: %v", err)
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

func resolveSelectedContractHash(target selectedTarget, targetNetwork string) (contractHash string, appID string, err error) {
	if target.AppManifest != "" {
		manifestBytes, readErr := os.ReadFile(target.AppManifest)
		if readErr != nil {
			return "", "", fmt.Errorf("read app manifest failed: %v", readErr)
		}

		var app selectedAppManifest
		if parseErr := json.Unmarshal(manifestBytes, &app); parseErr != nil {
			return "", "", fmt.Errorf("parse app manifest failed: %v", parseErr)
		}

		hash := strings.TrimSpace(app.Contracts[targetNetwork])
		if hash == "" {
			return "", app.ID, fmt.Errorf("missing %s hash in app manifest", targetNetwork)
		}

		return hash, app.ID, nil
	}

	if strings.TrimSpace(target.ContractHash) == "" {
		return "", "", fmt.Errorf("missing explicit contract hash")
	}

	return strings.TrimSpace(target.ContractHash), "", nil
}

func resolveUpdateArity(ctx context.Context, client *rpcclient.Client, contractHash util.Uint160) (int, error) {
	state, err := client.GetContractStateByHash(contractHash)
	if err != nil {
		return 0, err
	}
	for _, method := range state.Manifest.ABI.Methods {
		if strings.EqualFold(method.Name, "update") {
			return len(method.Parameters), nil
		}
	}
	return 0, fmt.Errorf("update method not found")
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

	hash, err := util.Uint160DecodeBytesBE(raw)
	if err != nil {
		hash, err = util.Uint160DecodeBytesLE(raw)
		if err != nil {
			return "", err
		}
	}

	addr := address.Uint160ToString(hash)
	if preferredAddress != "" && strings.EqualFold(addr, preferredAddress) {
		return preferredAddress, nil
	}
	return addr, nil
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
