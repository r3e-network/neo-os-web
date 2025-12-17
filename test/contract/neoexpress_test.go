// Package contract provides test utilities for Neo Express contract deployment and testing.
// This file is only built as part of `go test`.
package contract

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
)

const (
	neoxpPath      = "neoxp"
	defaultTimeout = 30 * time.Second
)

type NeoExpress struct {
	mu          sync.Mutex
	t           *testing.T
	prepared    bool
	nodeRunning bool
	cmd         *exec.Cmd
	rpcURL      string
	dataFile    string
}

// DeployedContract is imported from infrastructure/chain package

func NewNeoExpress(t *testing.T) *NeoExpress {
	t.Helper()
	dataFile := os.Getenv("NEOEXPRESS_FILE")
	if strings.TrimSpace(dataFile) == "" {
		// Default to an isolated instance per test run.
		dataFile = filepath.Join(t.TempDir(), "test.neo-express")
	}
	return &NeoExpress{
		t:        t,
		rpcURL:   "http://127.0.0.1:50012",
		dataFile: dataFile,
	}
}

func (n *NeoExpress) neoxpCmd() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".dotnet", "tools", neoxpPath)
}

func (n *NeoExpress) dotnetEnv() []string {
	home, _ := os.UserHomeDir()
	dotnetRoot := filepath.Join(home, ".dotnet")
	tools := filepath.Join(home, ".dotnet", "tools")

	path := os.Getenv("PATH")
	if path == "" {
		path = tools
	} else {
		path = dotnetRoot + string(os.PathListSeparator) + tools + string(os.PathListSeparator) + path
	}

	return []string{
		"DOTNET_ROOT=" + dotnetRoot,
		"PATH=" + path,
	}
}

func (n *NeoExpress) command(ctx context.Context, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, n.neoxpCmd(), args...)
	cmd.Env = append(os.Environ(), n.dotnetEnv()...)
	return cmd
}

func (n *NeoExpress) Start(ctx context.Context) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.prepared {
		return nil
	}

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}

	n.prepared = true
	return nil
}

// StartNode starts a neo-express node process for RPC-dependent tests.
// Most contract tests can run fully offline via `neoxp contract deploy/invoke`
// against the `.neo-express` file.
func (n *NeoExpress) StartNode(ctx context.Context) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.nodeRunning {
		return nil
	}

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}
	n.prepared = true

	// NOTE: Do not use --discard on first run: neo-express initializes RocksDB state
	// during `run`, and discard mode expects storage to already exist.
	n.cmd = n.command(ctx, "run", "-s", "0", "-i", n.dataFile)
	n.cmd.Stdout = os.Stdout
	n.cmd.Stderr = os.Stderr

	if err := n.cmd.Start(); err != nil {
		return fmt.Errorf("start neo-express: %w", err)
	}

	n.nodeRunning = true
	if err := n.waitForRPC(ctx, 15*time.Second); err != nil {
		// Ensure we don't leave a broken process around.
		_ = n.cmd.Process.Kill()
		n.nodeRunning = false
		return err
	}

	return nil
}

func (n *NeoExpress) ensureCreated(ctx context.Context) error {
	if n.dataFile == "" {
		return fmt.Errorf("neo-express data file not configured")
	}
	if _, err := os.Stat(n.dataFile); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(n.dataFile), 0o755); err != nil {
		return fmt.Errorf("create neo-express dir: %w", err)
	}

	out, err := n.command(ctx, "create", "-o", n.dataFile, "-f").CombinedOutput()
	if err != nil {
		return fmt.Errorf("create neo-express instance: %s: %w", string(out), err)
	}

	// Initialize node storage (RocksDB) for the freshly created instance.
	out, err = n.command(ctx, "reset", "-i", n.dataFile, "-f").CombinedOutput()
	if err != nil {
		return fmt.Errorf("reset neo-express instance: %s: %w", string(out), err)
	}
	return nil
}

func (n *NeoExpress) waitForRPC(ctx context.Context, timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	deadline := time.Now().Add(timeout)

	payload := []byte(`{"jsonrpc":"2.0","method":"getversion","params":[],"id":1}`)
	client := &http.Client{Timeout: 2 * time.Second}

	for time.Now().Before(deadline) {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.rpcURL, strings.NewReader(string(payload)))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 500 {
				return nil
			}
		}

		time.Sleep(250 * time.Millisecond)
	}

	return fmt.Errorf("neo-express RPC not ready at %s within %s", n.rpcURL, timeout)
}

func (n *NeoExpress) Stop() error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if !n.nodeRunning || n.cmd == nil || n.cmd.Process == nil {
		return nil
	}

	if err := n.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("kill neo-express: %w", err)
	}

	n.nodeRunning = false
	return nil
}

func (n *NeoExpress) RPCURL() string {
	return n.rpcURL
}

func (n *NeoExpress) CreateWallet(name string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return "", err
	}

	out, err := n.command(ctx, "wallet", "create", "-i", n.dataFile, name).CombinedOutput()
	if err != nil {
		if strings.Contains(string(out), "already exists") {
			return n.GetWalletAddress(name)
		}
		return "", fmt.Errorf("create wallet: %s: %w", string(out), err)
	}

	return n.GetWalletAddress(name)
}

func (n *NeoExpress) GetWalletAddress(name string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return "", err
	}

	out, err := n.command(ctx, "wallet", "list", "-i", n.dataFile, "-j").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("list wallets: %s: %w", string(out), err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(out, &parsed); err != nil {
		return "", fmt.Errorf("parse wallet list json: %w", err)
	}

	entry, ok := parsed[name]
	if !ok {
		return "", fmt.Errorf("wallet %s not found", name)
	}

	extract := func(m map[string]any) (string, bool) {
		addr, ok := m["address"].(string)
		addr = strings.TrimSpace(addr)
		if ok && strings.HasPrefix(addr, "N") && len(addr) == 34 {
			return addr, true
		}
		return "", false
	}

	switch v := entry.(type) {
	case map[string]any:
		if addr, ok := extract(v); ok {
			return addr, nil
		}
	case []any:
		// Prefer the default account when present.
		for _, item := range v {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if label, ok := m["account-label"].(string); ok && strings.TrimSpace(label) != "Default" {
				continue
			}
			if addr, ok := extract(m); ok {
				return addr, nil
			}
		}
		for _, item := range v {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if addr, ok := extract(m); ok {
				return addr, nil
			}
		}
	}

	return "", fmt.Errorf("wallet %s address not found in response", name)
}

func (n *NeoExpress) GetWalletScriptHash(name string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return "", err
	}

	out, err := n.command(ctx, "wallet", "list", "-i", n.dataFile, "-j").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("list wallets: %s: %w", string(out), err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(out, &parsed); err != nil {
		return "", fmt.Errorf("parse wallet list json: %w", err)
	}

	entry, ok := parsed[name]
	if !ok {
		return "", fmt.Errorf("wallet %s not found", name)
	}

	extract := func(m map[string]any) (string, bool) {
		hash, ok := m["script-hash"].(string)
		hash = strings.TrimSpace(hash)
		if ok && strings.HasPrefix(hash, "0x") && len(hash) == 42 {
			return hash, true
		}
		return "", false
	}

	switch v := entry.(type) {
	case map[string]any:
		if hash, ok := extract(v); ok {
			return hash, nil
		}
	case []any:
		// Prefer the default account when present.
		for _, item := range v {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if label, ok := m["account-label"].(string); ok && strings.TrimSpace(label) != "Default" {
				continue
			}
			if hash, ok := extract(m); ok {
				return hash, nil
			}
		}
		for _, item := range v {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if hash, ok := extract(m); ok {
				return hash, nil
			}
		}
	}

	return "", fmt.Errorf("wallet %s script-hash not found in response", name)
}

func (n *NeoExpress) TransferGAS(from, to string, amount float64) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}

	amountStr := fmt.Sprintf("%.8f", amount)
	out, err := n.command(ctx, "transfer", "-i", n.dataFile, amountStr, "GAS", from, to).CombinedOutput()
	if err != nil {
		return fmt.Errorf("transfer GAS: %s: %w", string(out), err)
	}

	return nil
}

func (n *NeoExpress) Deploy(nefPath, manifestPath, account string) (*chain.DeployedContract, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return nil, err
	}

	_ = manifestPath // deploy uses only the NEF file

	out, err := n.command(ctx, "contract", "deploy", "-j", "-i", n.dataFile, nefPath, account).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("deploy contract: %s: %w", string(out), err)
	}

	// Prefer JSON output (neo-express --json).
	type deployJSON struct {
		ContractHash string `json:"contract-hash"`
		TxHash       string `json:"tx-hash"`
		ContractName string `json:"contract-name"`
	}

	var parsed deployJSON
	if jsonErr := json.Unmarshal(out, &parsed); jsonErr == nil {
		hash := strings.TrimSpace(parsed.ContractHash)
		if strings.HasPrefix(hash, "0x") && len(hash) == 42 {
			return &chain.DeployedContract{Hash: hash}, nil
		}
	}

	// Fallback: parse human-readable output (older neo-express versions).
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, "Contract") && strings.Contains(line, "deployed") {
			parts := strings.Fields(line)
			for _, part := range parts {
				if strings.HasPrefix(part, "0x") && len(part) == 42 {
					return &chain.DeployedContract{Hash: part}, nil
				}
			}
		}
	}

	return &chain.DeployedContract{}, nil
}

func (n *NeoExpress) Invoke(contract, method string, args ...interface{}) (string, error) {
	return n.InvokeWithAccount(contract, method, "genesis", args...)
}

type neoInvokeFile struct {
	Contract  string        `json:"contract"`
	Operation string        `json:"operation"`
	Args      []interface{} `json:"args,omitempty"`
}

func (n *NeoExpress) writeInvokeFile(contract, method string, args []interface{}) (string, error) {
	payload, err := json.MarshalIndent(neoInvokeFile{
		Contract:  contract,
		Operation: method,
		Args:      args,
	}, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal invoke file: %w", err)
	}

	f, err := os.CreateTemp(n.t.TempDir(), "neo-invoke-*.json")
	if err != nil {
		return "", fmt.Errorf("create invoke file: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(payload); err != nil {
		return "", fmt.Errorf("write invoke file: %w", err)
	}
	return f.Name(), nil
}

func (n *NeoExpress) InvokeWithAccount(contract, method, account string, args ...interface{}) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return "", err
	}

	invPath, err := n.writeInvokeFile(contract, method, args)
	if err != nil {
		return "", err
	}

	// Use Global witness scope so nested contract calls (e.g., GAS/NEO NEP-17 transfers)
	// can validate witnesses during execution in neo-express.
	cmdArgs := []string{"contract", "invoke", "-j", "-w", chain.ScopeGlobal, "-i", n.dataFile, invPath, account}
	out, err := n.command(ctx, cmdArgs...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("invoke contract: %s: %w", string(out), err)
	}

	return strings.TrimSpace(string(out)), nil
}

func (n *NeoExpress) InvokeWithAccountResults(contract, method, account string, args ...interface{}) (*chain.InvokeResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return nil, err
	}

	invPath, err := n.writeInvokeFile(contract, method, args)
	if err != nil {
		return nil, err
	}

	cmdArgs := []string{"contract", "invoke", "-r", "-j", "-w", chain.ScopeGlobal, "-i", n.dataFile, invPath, account}
	out, err := n.command(ctx, cmdArgs...).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("invoke contract (results): %s: %w", string(out), err)
	}

	var result chain.InvokeResult
	if err := json.Unmarshal(out, &result); err != nil {
		return nil, fmt.Errorf("parse invoke result: %w", err)
	}

	if !strings.HasPrefix(strings.TrimSpace(result.State), "HALT") {
		msg := strings.TrimSpace(result.Exception)
		if msg == "" {
			msg = "execution failed"
		}
		return &result, fmt.Errorf("%s.%s: %s (%s)", contract, method, msg, strings.TrimSpace(result.State))
	}

	return &result, nil
}

func (n *NeoExpress) RunCheckpoint(name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}

	out, err := n.command(ctx, "checkpoint", "create", "-i", n.dataFile, name).CombinedOutput()
	if err != nil {
		return fmt.Errorf("create checkpoint: %s: %w", string(out), err)
	}

	return nil
}

func (n *NeoExpress) RestoreCheckpoint(name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}

	out, err := n.command(ctx, "checkpoint", "restore", "-i", n.dataFile, name, "-f").CombinedOutput()
	if err != nil {
		return fmt.Errorf("restore checkpoint: %s: %w", string(out), err)
	}

	return nil
}

func (n *NeoExpress) Reset() error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}

	out, err := n.command(ctx, "reset", "-i", n.dataFile, "-f").CombinedOutput()
	if err != nil {
		return fmt.Errorf("reset: %s: %w", string(out), err)
	}

	return nil
}

func (n *NeoExpress) FastForward(blocks int) error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	if err := n.ensureCreated(ctx); err != nil {
		return err
	}

	out, err := n.command(ctx, "fastfwd", "-i", n.dataFile, fmt.Sprintf("%d", blocks)).CombinedOutput()
	if err != nil {
		return fmt.Errorf("fastfwd: %s: %w", string(out), err)
	}

	return nil
}

func FindContractArtifacts(contractName string) (nefPath, manifestPath string, err error) {
	contractName = strings.TrimSpace(contractName)
	if contractName == "" {
		return "", "", fmt.Errorf("contract name is required")
	}

	basePath := filepath.Join("..", "..", "contracts", "build")

	nefPath = filepath.Join(basePath, contractName+".nef")
	manifestPath = filepath.Join(basePath, contractName+".manifest.json")

	if _, err := os.Stat(nefPath); os.IsNotExist(err) {
		return "", "", fmt.Errorf("NEF file not found: %s", nefPath)
	}
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		return "", "", fmt.Errorf("manifest not found: %s", manifestPath)
	}

	return nefPath, manifestPath, nil
}

func SkipIfNoNeoExpress(t *testing.T) {
	t.Helper()
	if !hasDotnet() {
		t.Skip("dotnet not installed, skipping neo-express contract tests")
	}
	home, _ := os.UserHomeDir()
	neoxp := filepath.Join(home, ".dotnet", "tools", neoxpPath)
	if _, err := os.Stat(neoxp); os.IsNotExist(err) {
		t.Skip("neo-express not installed, skipping contract tests")
	}

	// Ensure the tool is runnable (shim requires a compatible .NET runtime).
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, neoxp, "--version")
	cmd.Env = append(os.Environ(), dotnetToolEnv()...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Skipf("neo-express tool not runnable: %s", strings.TrimSpace(string(out)))
	}
}

func SkipIfNoCompiledContracts(t *testing.T) {
	t.Helper()
	contractDir := filepath.Join("..", "..", "contracts", "build")
	nefPath := filepath.Join(contractDir, "PaymentHub.nef")
	if _, err := os.Stat(nefPath); err == nil {
		return
	}

	// Attempt to build contracts on-demand so the contract workflow is runnable
	// from a clean checkout (when dotnet + nccs are installed). If tooling is not
	// available, skip with a clear message.
	if !hasDotnet() {
		t.Skip("dotnet not installed; install .NET SDK/runtime and re-run (required for neo-express contract tests)")
	}
	if !hasNCCS() {
		t.Skip("nccs (Neo.Compiler.CSharp) not installed; run 'dotnet tool install -g Neo.Compiler.CSharp' and re-run")
	}

	if err := runContractBuildScript(t); err != nil {
		t.Fatalf("contracts build failed: %v", err)
	}

	if _, err := os.Stat(nefPath); os.IsNotExist(err) {
		t.Fatalf("contracts build completed but %s is still missing", nefPath)
	}
}

func hasDotnet() bool {
	if _, err := exec.LookPath("dotnet"); err == nil {
		return true
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(home, ".dotnet", "dotnet")); err == nil {
		return true
	}
	return false
}

func hasNCCS() bool {
	if _, err := exec.LookPath("nccs"); err == nil {
		return true
	}
	home, _ := os.UserHomeDir()
	if home == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(home, ".dotnet", "tools", "nccs")); err == nil {
		return true
	}
	if _, err := os.Stat(filepath.Join(home, ".dotnet", "tools", "nccs.exe")); err == nil {
		return true
	}
	return false
}

func dotnetToolEnv() []string {
	home, _ := os.UserHomeDir()
	dotnetRoot := filepath.Join(home, ".dotnet")
	tools := filepath.Join(home, ".dotnet", "tools")

	path := os.Getenv("PATH")
	if path == "" {
		path = tools
	} else {
		path = dotnetRoot + string(os.PathListSeparator) + tools + string(os.PathListSeparator) + path
	}

	return []string{
		"DOTNET_ROOT=" + dotnetRoot,
		"PATH=" + path,
	}
}

func runContractBuildScript(t *testing.T) error {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	scriptPath := filepath.Join("..", "..", "contracts", "build.sh")
	cmd := exec.CommandContext(ctx, "bash", scriptPath)
	cmd.Env = append(os.Environ(), dotnetToolEnv()...)

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %w", strings.TrimSpace(string(out)), err)
	}
	return nil
}
