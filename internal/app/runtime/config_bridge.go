package runtime

import (
	app "github.com/R3E-Network/service_layer/internal/app"
	"github.com/R3E-Network/service_layer/internal/config"
)

// AppRuntimeConfig converts a config file runtime section into the
// application-level runtime configuration structure.
func AppRuntimeConfig(cfg *config.Config) app.RuntimeConfig {
	if cfg == nil {
		return app.RuntimeConfig{}
	}
	return app.RuntimeConfig{
		TEEMode:            cfg.Runtime.TEE.Mode,
		RandomSigningKey:   cfg.Runtime.Random.SigningKey,
		PriceFeedFetchURL:  cfg.Runtime.PriceFeed.FetchURL,
		PriceFeedFetchKey:  cfg.Runtime.PriceFeed.FetchKey,
		GasBankResolverURL: cfg.Runtime.GasBank.ResolverURL,
		GasBankResolverKey: cfg.Runtime.GasBank.ResolverKey,
		CREHTTPRunner:      cfg.Runtime.CRE.HTTPRunner,
	}
}
