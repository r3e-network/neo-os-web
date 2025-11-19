package app

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	core "github.com/R3E-Network/service_layer/internal/app/core/service"
	"github.com/R3E-Network/service_layer/internal/app/domain/function"
	"github.com/R3E-Network/service_layer/internal/app/metrics"
	"github.com/R3E-Network/service_layer/internal/app/services/accounts"
	automationsvc "github.com/R3E-Network/service_layer/internal/app/services/automation"
	ccipsvc "github.com/R3E-Network/service_layer/internal/app/services/ccip"
	confsvc "github.com/R3E-Network/service_layer/internal/app/services/confidential"
	cresvc "github.com/R3E-Network/service_layer/internal/app/services/cre"
	datafeedsvc "github.com/R3E-Network/service_layer/internal/app/services/datafeeds"
	datalinksvc "github.com/R3E-Network/service_layer/internal/app/services/datalink"
	datastreamsvc "github.com/R3E-Network/service_layer/internal/app/services/datastreams"
	dtasvc "github.com/R3E-Network/service_layer/internal/app/services/dta"
	"github.com/R3E-Network/service_layer/internal/app/services/functions"
	gasbanksvc "github.com/R3E-Network/service_layer/internal/app/services/gasbank"
	oraclesvc "github.com/R3E-Network/service_layer/internal/app/services/oracle"
	pricefeedsvc "github.com/R3E-Network/service_layer/internal/app/services/pricefeed"
	randomsvc "github.com/R3E-Network/service_layer/internal/app/services/random"
	"github.com/R3E-Network/service_layer/internal/app/services/secrets"
	"github.com/R3E-Network/service_layer/internal/app/services/triggers"
	vrfsvc "github.com/R3E-Network/service_layer/internal/app/services/vrf"
	"github.com/R3E-Network/service_layer/internal/app/storage"
	"github.com/R3E-Network/service_layer/internal/app/storage/memory"
	"github.com/R3E-Network/service_layer/internal/app/system"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

// Stores encapsulates persistence dependencies. Nil stores default to the
// in-memory implementation.
type Stores struct {
	Accounts         storage.AccountStore
	Functions        storage.FunctionStore
	Triggers         storage.TriggerStore
	GasBank          storage.GasBankStore
	Automation       storage.AutomationStore
	PriceFeeds       storage.PriceFeedStore
	DataFeeds        storage.DataFeedStore
	DataStreams      storage.DataStreamStore
	DataLink         storage.DataLinkStore
	DTA              storage.DTAStore
	Confidential     storage.ConfidentialStore
	Oracle           storage.OracleStore
	Secrets          storage.SecretStore
	CRE              storage.CREStore
	CCIP             storage.CCIPStore
	VRF              storage.VRFStore
	WorkspaceWallets storage.WorkspaceWalletStore
}

// Application ties domain services together and manages their lifecycle.
type Application struct {
	manager *system.Manager
	log     *logger.Logger

	Accounts         *accounts.Service
	Functions        *functions.Service
	Triggers         *triggers.Service
	GasBank          *gasbanksvc.Service
	Automation       *automationsvc.Service
	PriceFeeds       *pricefeedsvc.Service
	DataFeeds        *datafeedsvc.Service
	DataStreams      *datastreamsvc.Service
	DataLink         *datalinksvc.Service
	DTA              *dtasvc.Service
	Confidential     *confsvc.Service
	Oracle           *oraclesvc.Service
	Secrets          *secrets.Service
	Random           *randomsvc.Service
	CRE              *cresvc.Service
	CCIP             *ccipsvc.Service
	VRF              *vrfsvc.Service
	WorkspaceWallets storage.WorkspaceWalletStore

	descriptors []core.Descriptor
}

// New builds a fully initialised application with the provided stores.
func New(stores Stores, log *logger.Logger) (*Application, error) {
	if log == nil {
		log = logger.NewDefault("app")
	}

	mem := memory.New()
	if stores.Accounts == nil {
		stores.Accounts = mem
	}
	if stores.Functions == nil {
		stores.Functions = mem
	}
	if stores.Triggers == nil {
		stores.Triggers = mem
	}
	if stores.GasBank == nil {
		stores.GasBank = mem
	}
	if stores.Automation == nil {
		stores.Automation = mem
	}
	if stores.PriceFeeds == nil {
		stores.PriceFeeds = mem
	}
	if stores.DataFeeds == nil {
		stores.DataFeeds = mem
	}
	if stores.DataStreams == nil {
		stores.DataStreams = mem
	}
	if stores.DataLink == nil {
		stores.DataLink = mem
	}
	if stores.DTA == nil {
		stores.DTA = mem
	}
	if stores.Confidential == nil {
		stores.Confidential = mem
	}
	if stores.Oracle == nil {
		stores.Oracle = mem
	}
	if stores.Secrets == nil {
		stores.Secrets = mem
	}
	if stores.CRE == nil {
		stores.CRE = mem
	}
	if stores.CCIP == nil {
		stores.CCIP = mem
	}
	if stores.VRF == nil {
		stores.VRF = mem
	}
	if stores.WorkspaceWallets == nil {
		stores.WorkspaceWallets = mem
	}

	manager := system.NewManager()

	acctService := accounts.New(stores.Accounts, log)
	funcService := functions.New(stores.Accounts, stores.Functions, log)
	secretsService := secrets.New(stores.Accounts, stores.Secrets, log)
	teeMode := strings.ToLower(strings.TrimSpace(os.Getenv("TEE_MODE")))
	var executor functions.FunctionExecutor
	switch teeMode {
	case "mock", "disabled", "off":
		log.Warn("TEE_MODE set to mock; using mock TEE executor")
		executor = functions.NewMockTEEExecutor()
	default:
		executor = functions.NewTEEExecutor(secretsService)
	}
	funcService.AttachExecutor(executor)
	funcService.AttachSecretResolver(secretsService)
	trigService := triggers.New(stores.Accounts, stores.Functions, stores.Triggers, log)
	gasService := gasbanksvc.New(stores.Accounts, stores.GasBank, log)
	automationService := automationsvc.New(stores.Accounts, stores.Functions, stores.Automation, log)
	priceFeedService := pricefeedsvc.New(stores.Accounts, stores.PriceFeeds, log)
	priceFeedService.WithObservationHooks(metrics.PriceFeedSubmissionHooks())
	dataFeedService := datafeedsvc.New(stores.Accounts, stores.DataFeeds, log)
	dataFeedService.WithObservationHooks(metrics.DataFeedUpdateHooks())
	dataFeedService.WithWorkspaceWallets(stores.WorkspaceWallets)
	dataStreamService := datastreamsvc.New(stores.Accounts, stores.DataStreams, log)
	dataStreamService.WithObservationHooks(metrics.DatastreamFrameHooks())
	dataLinkService := datalinksvc.New(stores.Accounts, stores.DataLink, log)
	dataLinkService.WithWorkspaceWallets(stores.WorkspaceWallets)
	dataLinkService.WithDispatcherHooks(metrics.DataLinkDispatchHooks())
	dtaService := dtasvc.New(stores.Accounts, stores.DTA, log)
	dtaService.WithWorkspaceWallets(stores.WorkspaceWallets)
	dtaService.WithObservationHooks(metrics.DTAOrderHooks())
	confService := confsvc.New(stores.Accounts, stores.Confidential, log)
	confService.WithSealedKeyHooks(metrics.ConfidentialSealedKeyHooks())
	confService.WithAttestationHooks(metrics.ConfidentialAttestationHooks())
	oracleService := oraclesvc.New(stores.Accounts, stores.Oracle, log)
	creService := cresvc.New(stores.Accounts, stores.CRE, log)
	ccipService := ccipsvc.New(stores.Accounts, stores.CCIP, log)
	ccipService.WithWorkspaceWallets(stores.WorkspaceWallets)
	ccipService.WithDispatcherHooks(metrics.CCIPDispatchHooks())
	vrfService := vrfsvc.New(stores.Accounts, stores.VRF, log)
	vrfService.WithWorkspaceWallets(stores.WorkspaceWallets)
	vrfService.WithDispatcherHooks(metrics.VRFDispatchHooks())

	var randomOpts []randomsvc.Option
	if key := strings.TrimSpace(os.Getenv("RANDOM_SIGNING_KEY")); key != "" {
		if decoded, err := decodeSigningKey(key); err != nil {
			log.WithError(err).Warn("configure random signing key")
		} else {
			randomOpts = append(randomOpts, randomsvc.WithSigningKey(decoded))
		}
	}
	randomService := randomsvc.New(stores.Accounts, log, randomOpts...)

	httpClient := &http.Client{Timeout: 10 * time.Second}

	funcService.AttachDependencies(trigService, automationService, priceFeedService, oracleService, gasService)

	if enabled := strings.ToLower(strings.TrimSpace(os.Getenv("CRE_HTTP_RUNNER"))); enabled == "1" || enabled == "true" || enabled == "yes" {
		creService.WithRunner(cresvc.NewHTTPRunner(httpClient, log))
	}

	for _, name := range []string{"accounts", "functions", "triggers"} {
		if err := manager.Register(system.NoopService{ServiceName: name}); err != nil {
			return nil, fmt.Errorf("register %s service: %w", name, err)
		}
	}

	autoRunner := automationsvc.NewScheduler(automationService, log)
	autoRunner.WithDispatcher(automationsvc.NewFunctionDispatcher(automationsvc.FunctionRunnerFunc(func(ctx context.Context, functionID string, payload map[string]any) (function.Execution, error) {
		return funcService.Execute(ctx, functionID, payload)
	}), automationService, log))
	priceRunner := pricefeedsvc.NewRefresher(priceFeedService, log)
	priceRunner.WithObservationHooks(metrics.PriceFeedRefreshHooks())
	if endpoint := strings.TrimSpace(os.Getenv("PRICEFEED_FETCH_URL")); endpoint != "" {
		fetcher, err := pricefeedsvc.NewHTTPFetcher(httpClient, endpoint, os.Getenv("PRICEFEED_FETCH_KEY"), log)
		if err != nil {
			log.WithError(err).Warn("configure price feed fetcher")
		} else {
			priceRunner.WithFetcher(fetcher)
		}
	} else {
		log.Warn("PRICEFEED_FETCH_URL not set; price feed refresher disabled")
	}

	oracleRunner := oraclesvc.NewDispatcher(oracleService, log)
	oracleRunner.WithResolver(oraclesvc.NewHTTPResolver(oracleService, httpClient, log))

	var settlement system.Service
	if endpoint := strings.TrimSpace(os.Getenv("GASBANK_RESOLVER_URL")); endpoint != "" {
		resolver, err := gasbanksvc.NewHTTPWithdrawalResolver(httpClient, endpoint, os.Getenv("GASBANK_RESOLVER_KEY"), log)
		if err != nil {
			log.WithError(err).Warn("configure gas bank resolver")
		} else {
			poller := gasbanksvc.NewSettlementPoller(stores.GasBank, gasService, resolver, log)
			poller.WithObservationHooks(metrics.GasBankSettlementHooks())
			settlement = poller
		}
	} else {
		log.Warn("GASBANK_RESOLVER_URL not set; gas bank settlement disabled")
	}

	services := []system.Service{autoRunner, priceRunner, oracleRunner}
	if settlement != nil {
		services = append(services, settlement)
	}

	for _, svc := range services {
		if err := manager.Register(svc); err != nil {
			return nil, fmt.Errorf("register %s: %w", svc.Name(), err)
		}
	}

	descriptors := manager.Descriptors()

	return &Application{
		manager:          manager,
		log:              log,
		Accounts:         acctService,
		Functions:        funcService,
		Triggers:         trigService,
		GasBank:          gasService,
		Automation:       automationService,
		PriceFeeds:       priceFeedService,
		DataFeeds:        dataFeedService,
		DataStreams:      dataStreamService,
		DataLink:         dataLinkService,
		Oracle:           oracleService,
		Secrets:          secretsService,
		Random:           randomService,
		CRE:              creService,
		CCIP:             ccipService,
		VRF:              vrfService,
		DTA:              dtaService,
		Confidential:     confService,
		WorkspaceWallets: stores.WorkspaceWallets,
		descriptors:      descriptors,
	}, nil
}

// Attach registers an additional lifecycle-managed service. Call before Start.
func (a *Application) Attach(service system.Service) error {
	return a.manager.Register(service)
}

// Start begins all registered services.
func (a *Application) Start(ctx context.Context) error {
	return a.manager.Start(ctx)
}

// Stop stops all services.
func (a *Application) Stop(ctx context.Context) error {
	return a.manager.Stop(ctx)
}

// Descriptors returns advertised service descriptors for orchestration/CLI
// introspection. It is safe to call even if some services are nil.
func (a *Application) Descriptors() []core.Descriptor {
	out := make([]core.Descriptor, len(a.descriptors))
	copy(out, a.descriptors)
	return out
}

func decodeSigningKey(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, fmt.Errorf("signing key is empty")
	}
	if decoded, err := base64.StdEncoding.DecodeString(value); err == nil {
		if len(decoded) != ed25519.PrivateKeySize {
			return nil, fmt.Errorf("expected %d-byte key, got %d", ed25519.PrivateKeySize, len(decoded))
		}
		return decoded, nil
	}
	if decoded, err := hex.DecodeString(value); err == nil {
		if len(decoded) != ed25519.PrivateKeySize {
			return nil, fmt.Errorf("expected %d-byte key, got %d", ed25519.PrivateKeySize, len(decoded))
		}
		return decoded, nil
	}
	return nil, fmt.Errorf("invalid signing key encoding; provide base64 or hex encoded ed25519 key")
}
