package config

// RuntimeConfig configures integrations that were previously only exposed via
// environment variables (TEE mode, price feed fetchers, etc.).
type RuntimeConfig struct {
	TEE       TEEConfig       `json:"tee"`
	Random    RandomConfig    `json:"random"`
	PriceFeed PriceFeedConfig `json:"pricefeed"`
	GasBank   GasBankConfig   `json:"gasbank"`
	CRE       CREConfig       `json:"cre"`
}

type TEEConfig struct {
	Mode string `json:"mode" env:"TEE_MODE"`
}

type RandomConfig struct {
	SigningKey string `json:"signing_key" env:"RANDOM_SIGNING_KEY"`
}

type PriceFeedConfig struct {
	FetchURL string `json:"fetch_url" env:"PRICEFEED_FETCH_URL"`
	FetchKey string `json:"fetch_key" env:"PRICEFEED_FETCH_KEY"`
}

type GasBankConfig struct {
	ResolverURL string `json:"resolver_url" env:"GASBANK_RESOLVER_URL"`
	ResolverKey string `json:"resolver_key" env:"GASBANK_RESOLVER_KEY"`
}

type CREConfig struct {
	HTTPRunner bool `json:"http_runner" env:"CRE_HTTP_RUNNER"`
}
