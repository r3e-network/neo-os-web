// Package chain provides contract registry for managing deployed contracts.
package chain

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ContractInfo holds information about a deployed contract.
type ContractInfo struct {
	Name        string `json:"name"`
	Address     string `json:"address"`
	Version     string `json:"version,omitempty"`
	DeployedAt  string `json:"deployed_at,omitempty"`
	DeployTxHash string `json:"deploy_tx_hash,omitempty"`
	UpdatedAt   string `json:"updated_at,omitempty"`
	UpdateTxHash string `json:"update_tx_hash,omitempty"`
	Network     string `json:"network,omitempty"`
	Deployer    string `json:"deployer,omitempty"`
	Status      string `json:"status,omitempty"` // deployed, updated, deprecated
}

// ContractRegistry manages deployed contract addresses and versions.
type ContractRegistry struct {
	mu        sync.RWMutex
	contracts map[string]*ContractInfo
	network   string
	configDir string
}

// PlatformContracts defines the MiniApp platform contract names.
var PlatformContracts = []string{
	"PaymentHub",
	"Governance",
	"PriceFeed",
	"RandomnessLog",
	"AppRegistry",
	"AutomationAnchor",
	"ServiceLayerGateway",
}

// LegacyContractMapping maps legacy contract names to new platform contracts.
var LegacyContractMapping = map[string]string{
	"Gateway":    "PaymentHub",
	"DataFeeds":  "PriceFeed",
	"VRF":        "RandomnessLog",
	"Automation": "AutomationAnchor",
	// Mixer has no direct equivalent in the new platform
}

// EnvVarMapping maps contract names to environment variable names.
var EnvVarMapping = map[string][]string{
	"PaymentHub":          {"CONTRACT_PAYMENT_HUB_ADDRESS"},
	"Governance":          {"CONTRACT_GOVERNANCE_ADDRESS"},
	"PriceFeed":           {"CONTRACT_PRICE_FEED_ADDRESS"},
	"RandomnessLog":       {"CONTRACT_RANDOMNESS_LOG_ADDRESS"},
	"AppRegistry":         {"CONTRACT_APP_REGISTRY_ADDRESS"},
	"AutomationAnchor":    {"CONTRACT_AUTOMATION_ANCHOR_ADDRESS"},
	"ServiceLayerGateway": {"CONTRACT_SERVICE_GATEWAY_ADDRESS"},
}

// NewContractRegistry creates a new contract registry.
func NewContractRegistry(network, configDir string) *ContractRegistry {
	return &ContractRegistry{
		contracts: make(map[string]*ContractInfo),
		network:   network,
		configDir: configDir,
	}
}

// LoadFromEnv loads contract addresses from environment variables.
func (r *ContractRegistry) LoadFromEnv() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for name, envVars := range EnvVarMapping {
		for _, envVar := range envVars {
			if address := strings.TrimSpace(os.Getenv(envVar)); address != "" {
				r.contracts[name] = &ContractInfo{
					Name:    name,
					Address: address,
					Network: r.network,
					Status:  "deployed",
				}
				break
			}
		}
	}
}

// LoadFromFile loads contract addresses from a JSON file.
func (r *ContractRegistry) LoadFromFile(filename string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	data, err := os.ReadFile(filename)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // File doesn't exist, not an error
		}
		return fmt.Errorf("read file: %w", err)
	}

	var registry struct {
		Network   string                   `json:"network"`
		Contracts map[string]*ContractInfo `json:"contracts"`
	}
	if err := json.Unmarshal(data, &registry); err != nil {
		return fmt.Errorf("unmarshal: %w", err)
	}

	if registry.Network != "" {
		r.network = registry.Network
	}
	for name, info := range registry.Contracts {
		if info != nil && info.Address != "" {
			info.Name = name
			r.contracts[name] = info
		}
	}

	return nil
}

// SaveToFile saves contract addresses to a JSON file.
func (r *ContractRegistry) SaveToFile(filename string) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	registry := struct {
		Network   string                   `json:"network"`
		UpdatedAt string                   `json:"updated_at"`
		Contracts map[string]*ContractInfo `json:"contracts"`
	}{
		Network:   r.network,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		Contracts: r.contracts,
	}

	data, err := json.MarshalIndent(registry, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(filename), 0o755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}

	if err := os.WriteFile(filename, data, 0o644); err != nil {
		return fmt.Errorf("write file: %w", err)
	}

	return nil
}

// Get returns the contract info for a given name.
func (r *ContractRegistry) Get(name string) *ContractInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.contracts[name]
}

// GetAddress returns the contract address for a given name.
func (r *ContractRegistry) GetAddress(name string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if info := r.contracts[name]; info != nil {
		return info.Address
	}
	return ""
}

// Set sets the contract info for a given name.
func (r *ContractRegistry) Set(name string, info *ContractInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	info.Name = name
	r.contracts[name] = info
}

// SetAddress sets the contract address for a given name.
func (r *ContractRegistry) SetAddress(name, address string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.contracts[name] == nil {
		r.contracts[name] = &ContractInfo{Name: name}
	}
	r.contracts[name].Address = address
	r.contracts[name].Network = r.network
}

// RegisterDeployment records a new contract deployment.
func (r *ContractRegistry) RegisterDeployment(name, address, version, txHash, deployer string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.contracts[name] = &ContractInfo{
		Name:         name,
		Address:      address,
		Version:      version,
		DeployedAt:   time.Now().UTC().Format(time.RFC3339),
		DeployTxHash: txHash,
		Network:      r.network,
		Deployer:     deployer,
		Status:       "deployed",
	}
}

// RegisterUpdate records a contract update.
func (r *ContractRegistry) RegisterUpdate(name, newAddress, newVersion, txHash string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	info := r.contracts[name]
	if info == nil {
		return fmt.Errorf("contract %s not found", name)
	}

	info.Address = newAddress
	info.Version = newVersion
	info.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	info.UpdateTxHash = txHash
	info.Status = "updated"

	return nil
}

// List returns all registered contracts.
func (r *ContractRegistry) List() []*ContractInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*ContractInfo, 0, len(r.contracts))
	for _, info := range r.contracts {
		result = append(result, info)
	}
	return result
}

// GetAddresses returns ContractAddresses populated from the registry.
func (r *ContractRegistry) GetAddresses() ContractAddresses {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return ContractAddresses{
		PaymentHub:          r.getAddressUnsafe("PaymentHub"),
		Governance:          r.getAddressUnsafe("Governance"),
		PriceFeed:           r.getAddressUnsafe("PriceFeed"),
		RandomnessLog:       r.getAddressUnsafe("RandomnessLog"),
		AppRegistry:         r.getAddressUnsafe("AppRegistry"),
		AutomationAnchor:    r.getAddressUnsafe("AutomationAnchor"),
		ServiceLayerGateway: r.getAddressUnsafe("ServiceLayerGateway"),
	}
}

func (r *ContractRegistry) getAddressUnsafe(name string) string {
	if info := r.contracts[name]; info != nil {
		return info.Address
	}
	return ""
}

// Validate checks if all required contracts are registered.
func (r *ContractRegistry) Validate() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var missing []string
	for _, name := range PlatformContracts {
		if r.contracts[name] == nil || r.contracts[name].Address == "" {
			missing = append(missing, name)
		}
	}
	return missing
}

// GenerateEnvExports generates shell export commands for contract addresses.
func (r *ContractRegistry) GenerateEnvExports() string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var lines []string
	for name, info := range r.contracts {
		if info == nil || info.Address == "" {
			continue
		}
		envVars := EnvVarMapping[name]
		if len(envVars) > 0 {
			lines = append(lines, fmt.Sprintf("export %s=%s", envVars[0], info.Address))
		}
	}
	return strings.Join(lines, "\n")
}

// DefaultRegistry returns a registry loaded from environment and default config.
func DefaultRegistry(network string) *ContractRegistry {
	configDir := "deploy/config"
	r := NewContractRegistry(network, configDir)
	r.LoadFromEnv()

	// Try to load from config file
	configFile := filepath.Join(configDir, network+"_contracts.json")
	_ = r.LoadFromFile(configFile)

	return r
}
