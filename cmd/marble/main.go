// Package main provides the generic Marble entry point for all Neo services.
// The service type is determined by the MARBLE_TYPE environment variable.
// Each service is a separate Marble in MarbleRun, running in its own TEE enclave.
package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/config"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/runtime"
	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"

	// Neo service imports
	neoaccounts "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/marble"
	neoaccountssupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/supabase"
	globalsigner "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/marble"
	globalsignersupabase "github.com/R3E-Network/neo-miniapps-platform/infrastructure/globalsigner/supabase"
	neoflow "github.com/R3E-Network/neo-miniapps-platform/services/automation/marble"
	neoflowsupabase "github.com/R3E-Network/neo-miniapps-platform/services/automation/supabase"
	neocompute "github.com/R3E-Network/neo-miniapps-platform/services/confcompute/marble"
	neooracle "github.com/R3E-Network/neo-miniapps-platform/services/conforacle/marble"
	neofeeds "github.com/R3E-Network/neo-miniapps-platform/services/datafeed/marble"
	neogasbank "github.com/R3E-Network/neo-miniapps-platform/services/gasbank/marble"
	neorequests "github.com/R3E-Network/neo-miniapps-platform/services/requests/marble"
	neorequestsupabase "github.com/R3E-Network/neo-miniapps-platform/services/requests/supabase"
	neosimulation "github.com/R3E-Network/neo-miniapps-platform/services/simulation/marble"
	txproxy "github.com/R3E-Network/neo-miniapps-platform/services/txproxy/marble"
	neovrf "github.com/R3E-Network/neo-miniapps-platform/services/vrf/marble"
)

func main() {
	// Build the neorequests repository early so the event-listener cursor
	// callback can use it. The repo is lightweight (no connections opened).
	var neorequestsRepo *neorequestsupabase.Repository

	factories := map[string]commonservice.Factory{
		"globalsigner": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return globalsigner.New(globalsigner.Config{
				Marble:     deps.Marble,
				DB:         deps.DB,
				Repository: globalsignersupabase.NewRepository(deps.DB),
			})
		},
		"neoaccounts": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return neoaccounts.New(neoaccounts.Config{
				Marble:          deps.Marble,
				DB:              deps.DB,
				NeoAccountsRepo: neoaccountssupabase.NewRepository(deps.DB),
				ChainClient:     deps.ChainClient,
			})
		},
		"neocompute": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return neocompute.New(neocompute.Config{
				Marble:         deps.Marble,
				DB:             deps.DB,
				SecretProvider: commonservice.NewServiceSecretsProvider(deps.Marble, deps.DB, neocompute.ServiceID),
			})
		},
		"neofeeds": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return neofeeds.New(neofeeds.Config{
				Marble:           deps.Marble,
				DB:               deps.DB,
				ArbitrumRPC:      deps.ArbitrumRPC,
				ChainClient:      deps.ChainClient,
				PriceFeedAddress: deps.PriceFeedAddress,
				TxProxy:          deps.TxProxy,
				EnableChainPush:  deps.EnableChainPush,
				GasBank:          deps.GasBank,
			})
		},
		"neoflow": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return neoflow.New(neoflow.Config{
				Marble:                  deps.Marble,
				DB:                      deps.DB,
				NeoFlowRepo:             neoflowsupabase.NewRepository(deps.DB),
				ChainClient:             deps.ChainClient,
				PriceFeedAddress:        deps.PriceFeedAddress,
				AutomationAnchorAddress: deps.AutomationAnchorAddr,
				TxProxy:                 deps.TxProxy,
				EventListener:           deps.EventListener,
				EnableChainExec:         deps.EnableChainExec,
				GasBank:                 deps.GasBank,
			})
		},
		"neooracle": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			oracleAllowlistRaw := strings.TrimSpace(os.Getenv("ORACLE_HTTP_ALLOWLIST"))
			oracleAllowlist := neooracle.URLAllowlist{Prefixes: config.SplitAndTrimCSV(oracleAllowlistRaw)}
			if len(oracleAllowlist.Prefixes) == 0 {
				if runtime.StrictIdentityMode() || deps.Marble.IsEnclave() {
					log.Fatalf("CRITICAL: ORACLE_HTTP_ALLOWLIST is required for NeoOracle in strict identity/SGX mode")
				}
				log.Printf("Warning: ORACLE_HTTP_ALLOWLIST not set; allowing all outbound URLs (development/testing only)")
			}

			oracleTimeout := time.Duration(0)
			if raw := strings.TrimSpace(os.Getenv("ORACLE_TIMEOUT")); raw != "" {
				if parsed, parseErr := time.ParseDuration(raw); parseErr != nil || parsed <= 0 {
					log.Printf("Warning: invalid ORACLE_TIMEOUT %q: %v", raw, parseErr)
				} else {
					oracleTimeout = parsed
				}
			}

			oracleMaxBodyBytes := int64(0)
			if raw := strings.TrimSpace(os.Getenv("ORACLE_MAX_SIZE")); raw != "" {
				if parsed, parseErr := config.ParseByteSize(raw); parseErr != nil || parsed <= 0 {
					log.Printf("Warning: invalid ORACLE_MAX_SIZE %q: %v", raw, parseErr)
				} else {
					oracleMaxBodyBytes = parsed
				}
			}

			return neooracle.New(neooracle.Config{
				Marble:         deps.Marble,
				SecretProvider: commonservice.NewServiceSecretsProvider(deps.Marble, deps.DB, neooracle.ServiceID),
				Timeout:        oracleTimeout,
				MaxBodyBytes:   oracleMaxBodyBytes,
				URLAllowlist:   oracleAllowlist,
			})
		},
		"neorequests": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			if neorequestsRepo == nil {
				neorequestsRepo = neorequestsupabase.NewRepository(deps.DB)
			}
			chains := []neorequests.ChainServiceConfig{}
			if deps.EventListener != nil || deps.TxProxy != nil || deps.ChainClient != nil {
				chains = append(chains, neorequests.ChainServiceConfig{
					ChainID:               deps.ChainID,
					EventListener:         deps.EventListener,
					TxProxy:               deps.TxProxy,
					ChainClient:           deps.ChainClient,
					ServiceGatewayAddress: deps.ServiceGatewayAddr,
					AppRegistryAddress:    deps.AppRegistryAddress,
					PaymentHubAddress:     deps.PaymentHubAddress,
				})
			}
			return neorequests.New(neorequests.Config{
				Marble:        deps.Marble,
				DB:            deps.DB,
				RequestsRepo:  neorequestsRepo,
				Chains:        chains,
				NeoVRFURL:     deps.NeoVRFURL,
				NeoOracleURL:  deps.NeoOracleURL,
				NeoComputeURL: deps.NeoComputeURL,
				HTTPClient:    deps.Marble.HTTPClient(),
			})
		},
		"neovrf": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return neovrf.New(neovrf.Config{
				Marble: deps.Marble,
				DB:     deps.DB,
			})
		},
		"neogasbank": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return neogasbank.New(neogasbank.Config{
				Marble:      deps.Marble,
				DB:          deps.DB,
				ChainClient: deps.ChainClient,
			})
		},
		"neosimulation": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			accountPoolURL := strings.TrimSpace(os.Getenv("NEOACCOUNTS_SERVICE_URL"))
			if accountPoolURL == "" {
				accountPoolURL = "https://neoaccounts:8085"
			}
			return neosimulation.New(neosimulation.Config{
				Marble:         deps.Marble,
				DB:             deps.DB,
				ChainClient:    deps.ChainClient,
				AccountPoolURL: accountPoolURL,
				AutoStart:      strings.ToLower(os.Getenv("SIMULATION_ENABLED")) == "true",
			})
		},
		"txproxy": func(deps *commonservice.SharedDeps) (commonservice.Runner, error) {
			return txproxy.New(txproxy.Config{
				Marble:      deps.Marble,
				DB:          deps.DB,
				ChainClient: deps.ChainClient,
				Signer:      deps.TEESigner,
			})
		},
	}

	// Provide the neorequests event-cursor callback so the runner can
	// resume the event listener from the last processed block.
	startBlockFn := func(ctx context.Context, db *database.Repository, chainID string) (uint64, bool) {
		serviceType := os.Getenv("MARBLE_TYPE")
		if serviceType == "" {
			serviceType = os.Getenv("SERVICE_TYPE")
		}
		if serviceType != "neorequests" {
			return 0, false
		}
		// Lazily create the repo so the neorequests factory can reuse it.
		if neorequestsRepo == nil {
			neorequestsRepo = neorequestsupabase.NewRepository(db)
		}
		latest, ok, err := neorequestsRepo.LatestProcessedBlock(ctx, chainID)
		if err != nil {
			log.Printf("Warning: failed to read processed event cursor: %v", err)
			return 0, false
		}
		if !ok {
			return 0, false
		}
		return latest, true
	}

	commonservice.Run(factories, commonservice.WithEventStartBlock(startBlockFn))
}
