package storage

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/domain/contract"
)

// MemoryContractStore is an in-memory implementation of ContractStore.
// Use for testing and development.
type MemoryContractStore struct {
	mem            *Memory
	contracts      map[string]contract.Contract
	templates      map[string]contract.Template
	deployments    map[string]contract.Deployment
	invocations    map[string]contract.Invocation
	bindings       map[string]contract.ServiceContractBinding
	networkConfigs map[contract.Network]contract.NetworkConfig
}

// NewMemoryContractStore creates a contract store backed by the given Memory.
func NewMemoryContractStore(mem *Memory) *MemoryContractStore {
	return &MemoryContractStore{
		mem:            mem,
		contracts:      make(map[string]contract.Contract),
		templates:      make(map[string]contract.Template),
		deployments:    make(map[string]contract.Deployment),
		invocations:    make(map[string]contract.Invocation),
		bindings:       make(map[string]contract.ServiceContractBinding),
		networkConfigs: make(map[contract.Network]contract.NetworkConfig),
	}
}

// Contract CRUD

func (s *MemoryContractStore) CreateContract(_ context.Context, c contract.Contract) (contract.Contract, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	if c.ID == "" {
		c.ID = s.mem.nextIDLocked()
	} else if _, exists := s.contracts[c.ID]; exists {
		return contract.Contract{}, fmt.Errorf("contract %s already exists", c.ID)
	}

	now := time.Now().UTC()
	c.CreatedAt = now
	c.UpdatedAt = now
	c.Metadata = copyMap(c.Metadata)
	c.Tags = cloneStrings(c.Tags)
	c.Capabilities = cloneStrings(c.Capabilities)
	c.DependsOn = cloneStrings(c.DependsOn)

	s.contracts[c.ID] = c
	return cloneContract(c), nil
}

func (s *MemoryContractStore) UpdateContract(_ context.Context, c contract.Contract) (contract.Contract, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	original, ok := s.contracts[c.ID]
	if !ok {
		return contract.Contract{}, fmt.Errorf("contract %s not found", c.ID)
	}

	c.CreatedAt = original.CreatedAt
	c.UpdatedAt = time.Now().UTC()
	c.Metadata = copyMap(c.Metadata)
	c.Tags = cloneStrings(c.Tags)
	c.Capabilities = cloneStrings(c.Capabilities)
	c.DependsOn = cloneStrings(c.DependsOn)

	s.contracts[c.ID] = c
	return cloneContract(c), nil
}

func (s *MemoryContractStore) GetContract(_ context.Context, id string) (contract.Contract, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	c, ok := s.contracts[id]
	if !ok {
		return contract.Contract{}, fmt.Errorf("contract %s not found", id)
	}
	return cloneContract(c), nil
}

func (s *MemoryContractStore) GetContractByAddress(_ context.Context, network contract.Network, address string) (contract.Contract, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	addressLower := strings.ToLower(address)
	for _, c := range s.contracts {
		if c.Network == network && strings.ToLower(c.Address) == addressLower {
			return cloneContract(c), nil
		}
	}
	return contract.Contract{}, fmt.Errorf("contract at %s on %s not found", address, network)
}

func (s *MemoryContractStore) ListContracts(_ context.Context, accountID string) ([]contract.Contract, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Contract, 0)
	for _, c := range s.contracts {
		if c.AccountID == accountID {
			result = append(result, cloneContract(c))
		}
	}
	sortContractsByCreated(result)
	return result, nil
}

func (s *MemoryContractStore) ListContractsByService(_ context.Context, serviceID string) ([]contract.Contract, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Contract, 0)
	for _, c := range s.contracts {
		if c.ServiceID == serviceID {
			result = append(result, cloneContract(c))
		}
	}
	sortContractsByCreated(result)
	return result, nil
}

func (s *MemoryContractStore) ListContractsByNetwork(_ context.Context, network contract.Network) ([]contract.Contract, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Contract, 0)
	for _, c := range s.contracts {
		if c.Network == network {
			result = append(result, cloneContract(c))
		}
	}
	sortContractsByCreated(result)
	return result, nil
}

// Template CRUD

func (s *MemoryContractStore) CreateTemplate(_ context.Context, t contract.Template) (contract.Template, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	if t.ID == "" {
		t.ID = s.mem.nextIDLocked()
	} else if _, exists := s.templates[t.ID]; exists {
		return contract.Template{}, fmt.Errorf("template %s already exists", t.ID)
	}

	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now
	t.Metadata = copyMap(t.Metadata)
	t.Tags = cloneStrings(t.Tags)
	t.Capabilities = cloneStrings(t.Capabilities)
	t.DependsOn = cloneStrings(t.DependsOn)
	t.Networks = cloneNetworks(t.Networks)
	t.Params = cloneTemplateParams(t.Params)

	s.templates[t.ID] = t
	return cloneTemplate(t), nil
}

func (s *MemoryContractStore) UpdateTemplate(_ context.Context, t contract.Template) (contract.Template, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	original, ok := s.templates[t.ID]
	if !ok {
		return contract.Template{}, fmt.Errorf("template %s not found", t.ID)
	}

	t.CreatedAt = original.CreatedAt
	t.UpdatedAt = time.Now().UTC()
	t.Metadata = copyMap(t.Metadata)
	t.Tags = cloneStrings(t.Tags)
	t.Capabilities = cloneStrings(t.Capabilities)
	t.DependsOn = cloneStrings(t.DependsOn)
	t.Networks = cloneNetworks(t.Networks)
	t.Params = cloneTemplateParams(t.Params)

	s.templates[t.ID] = t
	return cloneTemplate(t), nil
}

func (s *MemoryContractStore) GetTemplate(_ context.Context, id string) (contract.Template, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	t, ok := s.templates[id]
	if !ok {
		return contract.Template{}, fmt.Errorf("template %s not found", id)
	}
	return cloneTemplate(t), nil
}

func (s *MemoryContractStore) ListTemplates(_ context.Context, category contract.TemplateCategory) ([]contract.Template, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Template, 0)
	for _, t := range s.templates {
		if category == "" || t.Category == category {
			result = append(result, cloneTemplate(t))
		}
	}
	return result, nil
}

func (s *MemoryContractStore) ListTemplatesByService(_ context.Context, serviceID string) ([]contract.Template, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Template, 0)
	for _, t := range s.templates {
		if t.ServiceID == serviceID {
			result = append(result, cloneTemplate(t))
		}
	}
	return result, nil
}

// Deployment tracking

func (s *MemoryContractStore) CreateDeployment(_ context.Context, d contract.Deployment) (contract.Deployment, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	if d.ID == "" {
		d.ID = s.mem.nextIDLocked()
	} else if _, exists := s.deployments[d.ID]; exists {
		return contract.Deployment{}, fmt.Errorf("deployment %s already exists", d.ID)
	}

	now := time.Now().UTC()
	d.CreatedAt = now
	d.UpdatedAt = now
	d.Metadata = copyMap(d.Metadata)
	d.ConstructorArgs = copyAnyMap(d.ConstructorArgs)

	s.deployments[d.ID] = d
	return cloneDeployment(d), nil
}

func (s *MemoryContractStore) UpdateDeployment(_ context.Context, d contract.Deployment) (contract.Deployment, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	original, ok := s.deployments[d.ID]
	if !ok {
		return contract.Deployment{}, fmt.Errorf("deployment %s not found", d.ID)
	}

	d.CreatedAt = original.CreatedAt
	d.UpdatedAt = time.Now().UTC()
	d.Metadata = copyMap(d.Metadata)
	d.ConstructorArgs = copyAnyMap(d.ConstructorArgs)

	s.deployments[d.ID] = d
	return cloneDeployment(d), nil
}

func (s *MemoryContractStore) GetDeployment(_ context.Context, id string) (contract.Deployment, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	d, ok := s.deployments[id]
	if !ok {
		return contract.Deployment{}, fmt.Errorf("deployment %s not found", id)
	}
	return cloneDeployment(d), nil
}

func (s *MemoryContractStore) ListDeployments(_ context.Context, contractID string, limit int) ([]contract.Deployment, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Deployment, 0)
	for _, d := range s.deployments {
		if d.ContractID == contractID {
			result = append(result, cloneDeployment(d))
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

// Invocation tracking

func (s *MemoryContractStore) CreateInvocation(_ context.Context, inv contract.Invocation) (contract.Invocation, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	if inv.ID == "" {
		inv.ID = s.mem.nextIDLocked()
	} else if _, exists := s.invocations[inv.ID]; exists {
		return contract.Invocation{}, fmt.Errorf("invocation %s already exists", inv.ID)
	}

	now := time.Now().UTC()
	inv.CreatedAt = now
	inv.UpdatedAt = now
	inv.SubmittedAt = now
	inv.Metadata = copyMap(inv.Metadata)
	inv.Args = copyAnyMap(inv.Args)

	s.invocations[inv.ID] = inv
	return cloneInvocation(inv), nil
}

func (s *MemoryContractStore) UpdateInvocation(_ context.Context, inv contract.Invocation) (contract.Invocation, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	original, ok := s.invocations[inv.ID]
	if !ok {
		return contract.Invocation{}, fmt.Errorf("invocation %s not found", inv.ID)
	}

	inv.CreatedAt = original.CreatedAt
	inv.SubmittedAt = original.SubmittedAt
	inv.UpdatedAt = time.Now().UTC()
	inv.Metadata = copyMap(inv.Metadata)
	inv.Args = copyAnyMap(inv.Args)

	s.invocations[inv.ID] = inv
	return cloneInvocation(inv), nil
}

func (s *MemoryContractStore) GetInvocation(_ context.Context, id string) (contract.Invocation, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	inv, ok := s.invocations[id]
	if !ok {
		return contract.Invocation{}, fmt.Errorf("invocation %s not found", id)
	}
	return cloneInvocation(inv), nil
}

func (s *MemoryContractStore) ListInvocations(_ context.Context, contractID string, limit int) ([]contract.Invocation, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Invocation, 0)
	for _, inv := range s.invocations {
		if inv.ContractID == contractID {
			result = append(result, cloneInvocation(inv))
		}
	}
	sortInvocationsByCreated(result)
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *MemoryContractStore) ListAccountInvocations(_ context.Context, accountID string, limit int) ([]contract.Invocation, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.Invocation, 0)
	for _, inv := range s.invocations {
		if inv.AccountID == accountID {
			result = append(result, cloneInvocation(inv))
		}
	}
	sortInvocationsByCreated(result)
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

// Service contract bindings

func (s *MemoryContractStore) CreateServiceBinding(_ context.Context, b contract.ServiceContractBinding) (contract.ServiceContractBinding, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	if b.ID == "" {
		b.ID = s.mem.nextIDLocked()
	} else if _, exists := s.bindings[b.ID]; exists {
		return contract.ServiceContractBinding{}, fmt.Errorf("binding %s already exists", b.ID)
	}

	now := time.Now().UTC()
	b.CreatedAt = now
	b.UpdatedAt = now
	b.Metadata = copyMap(b.Metadata)

	s.bindings[b.ID] = b
	return cloneBinding(b), nil
}

func (s *MemoryContractStore) GetServiceBinding(_ context.Context, id string) (contract.ServiceContractBinding, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	b, ok := s.bindings[id]
	if !ok {
		return contract.ServiceContractBinding{}, fmt.Errorf("binding %s not found", id)
	}
	return cloneBinding(b), nil
}

func (s *MemoryContractStore) ListServiceBindings(_ context.Context, serviceID string) ([]contract.ServiceContractBinding, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.ServiceContractBinding, 0)
	for _, b := range s.bindings {
		if b.ServiceID == serviceID {
			result = append(result, cloneBinding(b))
		}
	}
	return result, nil
}

func (s *MemoryContractStore) ListAccountBindings(_ context.Context, accountID string) ([]contract.ServiceContractBinding, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.ServiceContractBinding, 0)
	for _, b := range s.bindings {
		if b.AccountID == accountID {
			result = append(result, cloneBinding(b))
		}
	}
	return result, nil
}

// Network config

func (s *MemoryContractStore) GetNetworkConfig(_ context.Context, network contract.Network) (contract.NetworkConfig, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	cfg, ok := s.networkConfigs[network]
	if !ok {
		return contract.NetworkConfig{}, fmt.Errorf("network config for %s not found", network)
	}
	return cloneNetworkConfig(cfg), nil
}

func (s *MemoryContractStore) ListNetworkConfigs(_ context.Context) ([]contract.NetworkConfig, error) {
	s.mem.mu.RLock()
	defer s.mem.mu.RUnlock()

	result := make([]contract.NetworkConfig, 0, len(s.networkConfigs))
	for _, cfg := range s.networkConfigs {
		result = append(result, cloneNetworkConfig(cfg))
	}
	return result, nil
}

func (s *MemoryContractStore) SaveNetworkConfig(_ context.Context, cfg contract.NetworkConfig) (contract.NetworkConfig, error) {
	s.mem.mu.Lock()
	defer s.mem.mu.Unlock()

	cfg.Metadata = copyMap(cfg.Metadata)
	cfg.EngineContracts = copyMap(cfg.EngineContracts)
	s.networkConfigs[cfg.Network] = cfg
	return cloneNetworkConfig(cfg), nil
}

// Clone helpers

func cloneContract(c contract.Contract) contract.Contract {
	c.Metadata = copyMap(c.Metadata)
	c.Tags = cloneStrings(c.Tags)
	c.Capabilities = cloneStrings(c.Capabilities)
	c.DependsOn = cloneStrings(c.DependsOn)
	return c
}

func cloneTemplate(t contract.Template) contract.Template {
	t.Metadata = copyMap(t.Metadata)
	t.Tags = cloneStrings(t.Tags)
	t.Capabilities = cloneStrings(t.Capabilities)
	t.DependsOn = cloneStrings(t.DependsOn)
	t.Networks = cloneNetworks(t.Networks)
	t.Params = cloneTemplateParams(t.Params)
	return t
}

func cloneDeployment(d contract.Deployment) contract.Deployment {
	d.Metadata = copyMap(d.Metadata)
	d.ConstructorArgs = copyAnyMap(d.ConstructorArgs)
	return d
}

func cloneInvocation(inv contract.Invocation) contract.Invocation {
	inv.Metadata = copyMap(inv.Metadata)
	inv.Args = copyAnyMap(inv.Args)
	return inv
}

func cloneBinding(b contract.ServiceContractBinding) contract.ServiceContractBinding {
	b.Metadata = copyMap(b.Metadata)
	return b
}

func cloneNetworkConfig(cfg contract.NetworkConfig) contract.NetworkConfig {
	cfg.Metadata = copyMap(cfg.Metadata)
	cfg.EngineContracts = copyMap(cfg.EngineContracts)
	return cfg
}

func cloneNetworks(networks []contract.Network) []contract.Network {
	if len(networks) == 0 {
		return nil
	}
	result := make([]contract.Network, len(networks))
	copy(result, networks)
	return result
}

func cloneTemplateParams(params []contract.TemplateParam) []contract.TemplateParam {
	if len(params) == 0 {
		return nil
	}
	result := make([]contract.TemplateParam, len(params))
	copy(result, params)
	return result
}

func sortContractsByCreated(contracts []contract.Contract) {
	sort.Slice(contracts, func(i, j int) bool {
		return contracts[i].CreatedAt.After(contracts[j].CreatedAt)
	})
}

func sortInvocationsByCreated(invocations []contract.Invocation) {
	sort.Slice(invocations, func(i, j int) bool {
		return invocations[i].CreatedAt.After(invocations[j].CreatedAt)
	})
}
