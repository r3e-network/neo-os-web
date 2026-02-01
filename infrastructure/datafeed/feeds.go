// Package datafeed provides Chainlink price feed integration.
package datafeed

import "strings"

// FeedCategory represents the category of a price feed.
type FeedCategory string

const (
	CategoryCrypto     FeedCategory = "crypto"
	CategoryStablecoin FeedCategory = "stablecoin"
	CategoryDeFi       FeedCategory = "defi"
	CategoryL2         FeedCategory = "l2"
	CategoryStaking    FeedCategory = "staking"
	CategoryForex      FeedCategory = "forex"
	CategoryCommodity  FeedCategory = "commodity"
	CategoryIndex      FeedCategory = "index"
)

// FeedConfig represents a Chainlink price feed configuration.
type FeedConfig struct {
	Symbol   string       // e.g., "ETH/USD"
	Address  string       // Chainlink aggregator contract address
	Decimals int          // Price decimals (usually 8)
	Category FeedCategory // Feed category
	Base     string       // Base asset (e.g., "ETH")
	Quote    string       // Quote asset (e.g., "USD")
}

// ChainlinkMainnetFeeds contains the Chainlink price feeds for mainnet.
// Source: https://docs.chain.link/data-feeds/price-feeds/addresses
var ChainlinkMainnetFeeds = []FeedConfig{
	// Major Cryptocurrencies
	{Symbol: "ETH/USD", Address: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", Decimals: 8, Category: CategoryCrypto, Base: "ETH", Quote: "USD"},
	{Symbol: "BTC/USD", Address: "0x6ce185860a4963106506C203335A2910B1416e6F", Decimals: 8, Category: CategoryCrypto, Base: "BTC", Quote: "USD"},
	{Symbol: "LINK/USD", Address: "0x86E53CF1B870786351Da77A57575e79CB55812CB", Decimals: 8, Category: CategoryCrypto, Base: "LINK", Quote: "USD"},
	{Symbol: "ARB/USD", Address: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6", Decimals: 8, Category: CategoryL2, Base: "ARB", Quote: "USD"},

	// Stablecoins
	{Symbol: "USDC/USD", Address: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", Decimals: 8, Category: CategoryStablecoin, Base: "USDC", Quote: "USD"},
	{Symbol: "USDT/USD", Address: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7", Decimals: 8, Category: CategoryStablecoin, Base: "USDT", Quote: "USD"},
	{Symbol: "DAI/USD", Address: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB", Decimals: 8, Category: CategoryStablecoin, Base: "DAI", Quote: "USD"},
	{Symbol: "FRAX/USD", Address: "0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8", Decimals: 8, Category: CategoryStablecoin, Base: "FRAX", Quote: "USD"},
	{Symbol: "LUSD/USD", Address: "0x0411D28c94d85A36bC72Cb0f875dfA8371D8fFfF", Decimals: 8, Category: CategoryStablecoin, Base: "LUSD", Quote: "USD"},
	{Symbol: "MIM/USD", Address: "0x87121F6c9A9F6E90E59591E4Cf4804873f54A95b", Decimals: 8, Category: CategoryStablecoin, Base: "MIM", Quote: "USD"},

	// DeFi Tokens
	{Symbol: "AAVE/USD", Address: "0xaD1d5344AaDE45F43E596773Bcc4c423EAbdD034", Decimals: 8, Category: CategoryDeFi, Base: "AAVE", Quote: "USD"},
	{Symbol: "CRV/USD", Address: "0xaebDA2c976cfd1eE1977Eac079B4382acb849325", Decimals: 8, Category: CategoryDeFi, Base: "CRV", Quote: "USD"},
	{Symbol: "GMX/USD", Address: "0xDB98056FecFff59D032aB628337A4887110df3dB", Decimals: 8, Category: CategoryDeFi, Base: "GMX", Quote: "USD"},
	{Symbol: "UNI/USD", Address: "0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720", Decimals: 8, Category: CategoryDeFi, Base: "UNI", Quote: "USD"},
	{Symbol: "SUSHI/USD", Address: "0xb2A8BA74cbca38508BA1632761b56C897060147C", Decimals: 8, Category: CategoryDeFi, Base: "SUSHI", Quote: "USD"},
	{Symbol: "BAL/USD", Address: "0xBE5eA816870D11239c543F84b71439511D70B94f", Decimals: 8, Category: CategoryDeFi, Base: "BAL", Quote: "USD"},
	{Symbol: "COMP/USD", Address: "0xe7C53FFd03Eb6ceF7d208bC4C13446c76d1E5884", Decimals: 8, Category: CategoryDeFi, Base: "COMP", Quote: "USD"},
	{Symbol: "YFI/USD", Address: "0x745Ab5b69E01E2BE1104Ca84937Bb71f96f5fB21", Decimals: 8, Category: CategoryDeFi, Base: "YFI", Quote: "USD"},
	{Symbol: "SNX/USD", Address: "0x054296f0D036b95531B4E14aFB578B80CFb41252", Decimals: 8, Category: CategoryDeFi, Base: "SNX", Quote: "USD"},
	{Symbol: "1INCH/USD", Address: "0x4bC735Ef24bf286983024CAd5D03f0738865Aaef", Decimals: 8, Category: CategoryDeFi, Base: "1INCH", Quote: "USD"},

	// Layer 2 / Scaling
	{Symbol: "MATIC/USD", Address: "0x52099D4523531f678Dfc568a7B1e5038aadcE1d6", Decimals: 8, Category: CategoryL2, Base: "MATIC", Quote: "USD"},
	{Symbol: "OP/USD", Address: "0x205aaD468a11fd5D34fA7211bC6Bad5b3deB9b98", Decimals: 8, Category: CategoryL2, Base: "OP", Quote: "USD"},

	// Other Major Tokens
	{Symbol: "WBTC/USD", Address: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", Decimals: 8, Category: CategoryCrypto, Base: "WBTC", Quote: "USD"},
	{Symbol: "WSTETH/USD", Address: "0xB1552C5e96B312d0Bf8b554186F846C40614a540", Decimals: 8, Category: CategoryStaking, Base: "WSTETH", Quote: "USD"},
	{Symbol: "STETH/USD", Address: "0x07C5b924399cc23c24a95c8743DE4006a32b7f2a", Decimals: 8, Category: CategoryStaking, Base: "STETH", Quote: "USD"},
	{Symbol: "RETH/USD", Address: "0xF3272CAfe65b190e76caAF483db13424a3e23dD2", Decimals: 8, Category: CategoryStaking, Base: "RETH", Quote: "USD"},
	{Symbol: "CBETH/USD", Address: "0xa668682974E3f121185a3cD94f00322beC674275", Decimals: 8, Category: CategoryStaking, Base: "CBETH", Quote: "USD"},
	{Symbol: "LDO/USD", Address: "0xA43A34030088E6510FecCFb77E88ee5e7ed0fE64", Decimals: 8, Category: CategoryStaking, Base: "LDO", Quote: "USD"},
	{Symbol: "RPL/USD", Address: "0xF0b7159BbFc341Cc41E7Cb182216F62c6d40533D", Decimals: 8, Category: CategoryStaking, Base: "RPL", Quote: "USD"},
	{Symbol: "PENDLE/USD", Address: "0x66853E19d73c0F9301fe099c324A1E9726953C89", Decimals: 8, Category: CategoryDeFi, Base: "PENDLE", Quote: "USD"},
	{Symbol: "RDNT/USD", Address: "0x20d0Fcab0ECFD078B036b6CAf1FaC69A6453b352", Decimals: 8, Category: CategoryDeFi, Base: "RDNT", Quote: "USD"},
	{Symbol: "MAGIC/USD", Address: "0x47E55cCec6582838E173f252D08Afd8116c2202d", Decimals: 8, Category: CategoryCrypto, Base: "MAGIC", Quote: "USD"},
	{Symbol: "DPX/USD", Address: "0xc373B9DB0707fD451Bc56bA5E9b029ba26629DF0", Decimals: 8, Category: CategoryDeFi, Base: "DPX", Quote: "USD"},
	{Symbol: "JOE/USD", Address: "0x04180965a782E487d0632013ABa488A472243542", Decimals: 8, Category: CategoryDeFi, Base: "JOE", Quote: "USD"},
	{Symbol: "SPELL/USD", Address: "0x383b3624478124697BEF675F07cA37570b73992f", Decimals: 8, Category: CategoryDeFi, Base: "SPELL", Quote: "USD"},
	{Symbol: "GNS/USD", Address: "0xE89E98CE4E19071E59Ed4780E0598b541CE76486", Decimals: 8, Category: CategoryDeFi, Base: "GNS", Quote: "USD"},
	{Symbol: "GRAIL/USD", Address: "0x2d9F7D4F6a8E8b6D8b6D8b6D8b6D8b6D8b6D8b6D", Decimals: 8, Category: CategoryDeFi, Base: "GRAIL", Quote: "USD"},

	// Forex Pairs
	{Symbol: "EUR/USD", Address: "0xA14d53bC1F1c0F31B4aA3BD109344E5009051a84", Decimals: 8, Category: CategoryForex, Base: "EUR", Quote: "USD"},
	{Symbol: "GBP/USD", Address: "0x9C4424Fd84C6661F97D8d6b3fc3C1aAc2BeDd137", Decimals: 8, Category: CategoryForex, Base: "GBP", Quote: "USD"},
	{Symbol: "JPY/USD", Address: "0x3dD6e51CB9caE717d5a8778CF79A04029f9cFDF8", Decimals: 8, Category: CategoryForex, Base: "JPY", Quote: "USD"},
	{Symbol: "CHF/USD", Address: "0xe32AccC8c4eC03F6E75bd3621BfC9Fbb234E1FC3", Decimals: 8, Category: CategoryForex, Base: "CHF", Quote: "USD"},
	{Symbol: "AUD/USD", Address: "0x9854e9a850e7C354c1de177eA953a6b1fba8Fc22", Decimals: 8, Category: CategoryForex, Base: "AUD", Quote: "USD"},
	{Symbol: "CAD/USD", Address: "0xf6DA27749484843c4F02f5Ad1378ceE723dD61d4", Decimals: 8, Category: CategoryForex, Base: "CAD", Quote: "USD"},

	// Commodities
	{Symbol: "XAU/USD", Address: "0x1F954Dc24a49708C26E0C1777f16750B5C6d5a2c", Decimals: 8, Category: CategoryCommodity, Base: "XAU", Quote: "USD"},
	{Symbol: "XAG/USD", Address: "0xC56765f04B248394CF1619D20dB8082Edbfa75b1", Decimals: 8, Category: CategoryCommodity, Base: "XAG", Quote: "USD"},

	// Cross Pairs
	{Symbol: "BTC/ETH", Address: "0xc5a90A6d7e4Af242dA238FFe279e9f2BA0c64B2e", Decimals: 18, Category: CategoryCrypto, Base: "BTC", Quote: "ETH"},
	{Symbol: "LINK/ETH", Address: "0xb7c8Fb1dB45007F98A68Da0588e1AA524C317f27", Decimals: 18, Category: CategoryCrypto, Base: "LINK", Quote: "ETH"},
}

// ChainlinkTestnetFeeds contains Chainlink price feeds on testnet.
var ChainlinkTestnetFeeds = []FeedConfig{
	{Symbol: "ETH/USD", Address: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165", Decimals: 8, Category: CategoryCrypto, Base: "ETH", Quote: "USD"},
	{Symbol: "BTC/USD", Address: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69", Decimals: 8, Category: CategoryCrypto, Base: "BTC", Quote: "USD"},
	{Symbol: "LINK/USD", Address: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298", Decimals: 8, Category: CategoryCrypto, Base: "LINK", Quote: "USD"},
	{Symbol: "USDC/USD", Address: "0x0153002d20B96532C639313c2d54c3dA09109309", Decimals: 8, Category: CategoryStablecoin, Base: "USDC", Quote: "USD"},
}

// GetFeedsForNetwork returns the appropriate feeds for the given network.
func GetFeedsForNetwork(network string) []FeedConfig {
	normalized := strings.ToLower(strings.TrimSpace(network))
	switch normalized {
	case "neo-n3-mainnet", "mainnet":
		return ChainlinkMainnetFeeds
	case "neo-n3-testnet", "testnet":
		return ChainlinkTestnetFeeds
	default:
		return ChainlinkMainnetFeeds
	}
}
