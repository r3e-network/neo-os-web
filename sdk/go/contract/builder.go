package contract

// SpecBuilder provides a fluent API for building contract specifications.
type SpecBuilder struct {
	spec Spec
}

// NewSpec creates a new contract specification builder.
func NewSpec(name string) *SpecBuilder {
	return &SpecBuilder{
		spec: Spec{
			Name:     name,
			Version:  "1.0.0",
			Networks: []Network{NetworkNeoN3},
		},
	}
}

// WithSymbol sets the contract symbol.
func (b *SpecBuilder) WithSymbol(symbol string) *SpecBuilder {
	b.spec.Symbol = symbol
	return b
}

// WithDescription sets the contract description.
func (b *SpecBuilder) WithDescription(desc string) *SpecBuilder {
	b.spec.Description = desc
	return b
}

// WithVersion sets the contract version.
func (b *SpecBuilder) WithVersion(version string) *SpecBuilder {
	b.spec.Version = version
	return b
}

// WithNetworks sets the supported networks.
func (b *SpecBuilder) WithNetworks(networks ...Network) *SpecBuilder {
	b.spec.Networks = networks
	return b
}

// WithCapabilities adds capabilities to the contract.
func (b *SpecBuilder) WithCapabilities(caps ...Capability) *SpecBuilder {
	b.spec.Capabilities = append(b.spec.Capabilities, caps...)
	return b
}

// WithMethod adds a method to the contract.
func (b *SpecBuilder) WithMethod(name string, inputs []Param, outputs []Param) *SpecBuilder {
	b.spec.Methods = append(b.spec.Methods, Method{
		Name:            name,
		Inputs:          inputs,
		Outputs:         outputs,
		StateMutability: "nonpayable",
	})
	return b
}

// WithViewMethod adds a view method to the contract.
func (b *SpecBuilder) WithViewMethod(name string, inputs []Param, outputs []Param) *SpecBuilder {
	b.spec.Methods = append(b.spec.Methods, Method{
		Name:            name,
		Inputs:          inputs,
		Outputs:         outputs,
		StateMutability: "view",
	})
	return b
}

// WithPayableMethod adds a payable method to the contract.
func (b *SpecBuilder) WithPayableMethod(name string, inputs []Param, outputs []Param) *SpecBuilder {
	b.spec.Methods = append(b.spec.Methods, Method{
		Name:            name,
		Inputs:          inputs,
		Outputs:         outputs,
		StateMutability: "payable",
	})
	return b
}

// WithEvent adds an event to the contract.
func (b *SpecBuilder) WithEvent(name string, params []Param) *SpecBuilder {
	b.spec.Events = append(b.spec.Events, Event{
		Name:   name,
		Params: params,
	})
	return b
}

// WithDependency adds a dependency to the contract.
func (b *SpecBuilder) WithDependency(contractID string) *SpecBuilder {
	b.spec.DependsOn = append(b.spec.DependsOn, contractID)
	return b
}

// WithMetadata adds metadata to the contract.
func (b *SpecBuilder) WithMetadata(key, value string) *SpecBuilder {
	if b.spec.Metadata == nil {
		b.spec.Metadata = make(map[string]string)
	}
	b.spec.Metadata[key] = value
	return b
}

// Build returns the completed specification.
func (b *SpecBuilder) Build() Spec {
	return b.spec
}

// Validate checks the specification for common errors.
func (b *SpecBuilder) Validate() error {
	if b.spec.Name == "" {
		return &ValidationError{Field: "name", Message: "name is required"}
	}
	if len(b.spec.Networks) == 0 {
		return &ValidationError{Field: "networks", Message: "at least one network is required"}
	}
	return nil
}

// ValidationError represents a specification validation error.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}
