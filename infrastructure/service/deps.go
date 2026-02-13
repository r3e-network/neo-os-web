package service

import (
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	chaincfg "github.com/R3E-Network/neo-miniapps-platform/infrastructure/chains"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/config"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	gasbankclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/gasbank/client"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/marble"
	txproxytypes "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/types"
)

// SharedDeps holds all shared dependencies initialized by Run.
// Every service receives this struct from its factory function.
type SharedDeps struct {
	ServiceType   string
	Marble        *marble.Marble
	DB            *database.Repository
	ChainClient   *chain.Client
	ChainID       string
	ChainMeta     *chaincfg.ChainConfig
	Contracts     chain.ContractAddresses
	TEESigner     chain.TEESigner
	EventListener *chain.EventListener
	TxProxy       txproxytypes.Invoker
	GasBank       *gasbankclient.Client
	ServicesCfg   *config.ServicesConfig
	Logger        *logging.Logger

	// Resolved contract addresses (hex-trimmed, ready to use).
	PaymentHubAddress    string
	PriceFeedAddress     string
	AutomationAnchorAddr string
	AppRegistryAddress   string
	ServiceGatewayAddr   string

	// Derived flags for convenience.
	EnableChainPush bool
	EnableChainExec bool

	// Service endpoint URLs read from env/secrets.
	NeoVRFURL     string
	NeoOracleURL  string
	NeoComputeURL string
	ArbitrumRPC   string
}
