package neosimulation

import (
	"context"
	"time"
)

type miniAppWorkflowKey string

const (
	workflowLottery          miniAppWorkflowKey = "lottery"
	workflowCoinFlip         miniAppWorkflowKey = "coinflip"
	workflowDiceGame         miniAppWorkflowKey = "dicegame"
	workflowScratchCard      miniAppWorkflowKey = "scratch-card"
	workflowMegaMillions     miniAppWorkflowKey = "mega-millions"
	workflowGasSpin          miniAppWorkflowKey = "gas-spin"
	workflowNeoCrash         miniAppWorkflowKey = "neo-crash"
	workflowThroneOfGas      miniAppWorkflowKey = "throne-of-gas"
	workflowDoomsdayClock    miniAppWorkflowKey = "doomsday-clock"
	workflowSchrodingerNFT   miniAppWorkflowKey = "schrodinger-nft"
	workflowAlgoBattle       miniAppWorkflowKey = "algo-battle"
	workflowPredictionMarket miniAppWorkflowKey = "predictionmarket"
	workflowFlashLoan        miniAppWorkflowKey = "flashloan"
	workflowPriceTicker      miniAppWorkflowKey = "price-ticker"
	workflowPricePredict     miniAppWorkflowKey = "price-predict"
	workflowTurboOptions     miniAppWorkflowKey = "turbo-options"
	workflowILGuard          miniAppWorkflowKey = "il-guard"
	workflowCandleWars       miniAppWorkflowKey = "candle-wars"
	workflowDutchAuction     miniAppWorkflowKey = "dutch-auction"
	workflowParasite         miniAppWorkflowKey = "the-parasite"
	workflowNoLossLottery    miniAppWorkflowKey = "no-loss-lottery"
	workflowSecretVote       miniAppWorkflowKey = "secretvote"
	workflowSecretPoker      miniAppWorkflowKey = "secret-poker"
	workflowMicroPredict     miniAppWorkflowKey = "micro-predict"
	workflowRedEnvelope      miniAppWorkflowKey = "redenvelope"
	workflowGasCircle        miniAppWorkflowKey = "gascircle"
	workflowPayToView        miniAppWorkflowKey = "pay-to-view"
	workflowTimeCapsule      miniAppWorkflowKey = "time-capsule"
	workflowGovBooster       miniAppWorkflowKey = "gov-booster"
	workflowAITrader         miniAppWorkflowKey = "ai-trader"
	workflowGridBot          miniAppWorkflowKey = "grid-bot"
	workflowNFTEvolve        miniAppWorkflowKey = "nft-evolve"
	workflowBridgeGuardian   miniAppWorkflowKey = "bridge-guardian"
	workflowFogChess         miniAppWorkflowKey = "fog-chess"
	workflowGardenOfNeo      miniAppWorkflowKey = "garden-of-neo"
	workflowDevTipping       miniAppWorkflowKey = "dev-tipping"
	workflowAirdrop          miniAppWorkflowKey = "airdrop"
	workflowDAOVoting        miniAppWorkflowKey = "dao-voting"
	workflowGacha            miniAppWorkflowKey = "gacha"
)

type miniAppCatalogEntry struct {
	Key           miniAppWorkflowKey
	AppID         string
	EnvSuffix     string
	DefaultConfig *MiniAppConfig
}

var miniAppCatalog = []miniAppCatalogEntry{
	{
		Key:       workflowLottery,
		AppID:     "miniapp-lottery",
		EnvSuffix: "LOTTERY",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-lottery",
			Name:        "Neo Lottery",
			Category:    "gaming",
			Interval:    5 * time.Second,
			BetAmount:   10000000,
			Description: "Buy lottery tickets, draw winners",
		},
	},
	{
		Key:       workflowCoinFlip,
		AppID:     "miniapp-coinflip",
		EnvSuffix: "COINFLIP",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-coinflip",
			Name:        "Neo Coin Flip",
			Category:    "gaming",
			Interval:    3 * time.Second,
			BetAmount:   5000000,
			Description: "50/50 coin flip, double or nothing",
		},
	},
	{
		Key:       workflowDiceGame,
		AppID:     "miniapp-dicegame",
		EnvSuffix: "DICEGAME",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-dicegame",
			Name:        "Neo Dice",
			Category:    "gaming",
			Interval:    4 * time.Second,
			BetAmount:   8000000,
			Description: "Roll dice, win up to 6x",
		},
	},
	{Key: workflowScratchCard, AppID: "miniapp-scratch-card", EnvSuffix: "SCRATCHCARD"},
	{Key: workflowMegaMillions, AppID: "miniapp-mega-millions", EnvSuffix: "MEGAMILLIONS"},
	{Key: workflowGasSpin, AppID: "miniapp-gas-spin", EnvSuffix: "GASSPIN"},
	{Key: workflowNeoCrash, AppID: "miniapp-neo-crash", EnvSuffix: "NEOCRASH"},
	{Key: workflowThroneOfGas, AppID: "miniapp-throne-of-gas", EnvSuffix: "THRONEOFGAS"},
	{Key: workflowDoomsdayClock, AppID: "miniapp-doomsday-clock", EnvSuffix: "DOOMSDAYCLOCK"},
	{Key: workflowSchrodingerNFT, AppID: "miniapp-schrodinger-nft", EnvSuffix: "SCHRODINGERNFT"},
	{Key: workflowAlgoBattle, AppID: "miniapp-algo-battle", EnvSuffix: "ALGOBATTLE"},
	{
		Key:       workflowPredictionMarket,
		AppID:     "miniapp-predictionmarket",
		EnvSuffix: "PREDICTIONMARKET",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-predictionmarket",
			Name:        "Prediction Market",
			Category:    "defi",
			Interval:    8 * time.Second,
			BetAmount:   20000000,
			Description: "Bet on price movements",
		},
	},
	{Key: workflowFlashLoan, AppID: "miniapp-flashloan", EnvSuffix: "FLASHLOAN"},
	{Key: workflowPriceTicker, AppID: "miniapp-price-ticker", EnvSuffix: "PRICETICKER"},
	{Key: workflowPricePredict, AppID: "miniapp-price-predict", EnvSuffix: "PRICEPREDICT"},
	{Key: workflowTurboOptions, AppID: "miniapp-turbo-options", EnvSuffix: "TURBOOPTIONS"},
	{Key: workflowILGuard, AppID: "miniapp-il-guard", EnvSuffix: "ILGUARD"},
	{Key: workflowCandleWars, AppID: "miniapp-candle-wars", EnvSuffix: "CANDLEWARS"},
	{Key: workflowDutchAuction, AppID: "miniapp-dutch-auction", EnvSuffix: "DUTCHAUCTION"},
	{Key: workflowParasite, AppID: "miniapp-the-parasite", EnvSuffix: "PARASITE"},
	{Key: workflowNoLossLottery, AppID: "miniapp-no-loss-lottery", EnvSuffix: "NOLOSSLOTTERY"},
	{Key: workflowSecretVote, AppID: "miniapp-secretvote", EnvSuffix: "SECRETVOTE"},
	{Key: workflowSecretPoker, AppID: "miniapp-secret-poker", EnvSuffix: "SECRETPOKER"},
	{Key: workflowMicroPredict, AppID: "miniapp-micro-predict", EnvSuffix: "MICROPREDICT"},
	{Key: workflowRedEnvelope, AppID: "miniapp-redenvelope", EnvSuffix: "REDENVELOPE"},
	{Key: workflowGasCircle, AppID: "miniapp-gascircle", EnvSuffix: "GASCIRCLE"},
	{Key: workflowPayToView, AppID: "miniapp-pay-to-view", EnvSuffix: "PAYTOVIEW"},
	{Key: workflowTimeCapsule, AppID: "miniapp-time-capsule", EnvSuffix: "TIMECAPSULE"},
	{Key: workflowGovBooster, AppID: "miniapp-gov-booster", EnvSuffix: "GOVBOOSTER"},
	{Key: workflowAITrader, AppID: "miniapp-ai-trader", EnvSuffix: "AITRADER"},
	{Key: workflowGridBot, AppID: "miniapp-grid-bot", EnvSuffix: "GRIDBOT"},
	{Key: workflowNFTEvolve, AppID: "miniapp-nft-evolve", EnvSuffix: "NFTEVOLVE"},
	{Key: workflowBridgeGuardian, AppID: "miniapp-bridge-guardian", EnvSuffix: "BRIDGEGUARDIAN"},
	{Key: workflowFogChess, AppID: "miniapp-fog-chess", EnvSuffix: "FOGCHESS"},
	{Key: workflowGardenOfNeo, AppID: "miniapp-garden-of-neo", EnvSuffix: "GARDENOFNEO"},
	{Key: workflowDevTipping, AppID: "miniapp-dev-tipping", EnvSuffix: "DEVTIPPING"},
	{
		Key:       workflowAirdrop,
		AppID:     "miniapp-airdrop",
		EnvSuffix: "AIRDROP",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-airdrop",
			Name:        "Airdrop Center",
			Category:    "defi",
			Interval:    6 * time.Second,
			BetAmount:   0,
			Description: "Claim Multi-Chain Tokens & NFTs",
		},
	},
	{
		Key:       workflowDAOVoting,
		AppID:     "miniapp-dao-voting",
		EnvSuffix: "DAOVOTING",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-dao-voting",
			Name:        "DAO Snapshot",
			Category:    "governance",
			Interval:    10 * time.Second,
			BetAmount:   0,
			Description: "On-Chain Governance & Voting",
		},
	},
	{
		Key:       workflowGacha,
		AppID:     "miniapp-gacha",
		EnvSuffix: "GACHA",
		DefaultConfig: &MiniAppConfig{
			AppID:       "miniapp-gacha",
			Name:        "On-Chain Gacha",
			Category:    "gaming",
			Interval:    2 * time.Second,
			BetAmount:   2000000,
			Description: "Blind Box Gamification",
		},
	},
}

func miniAppContractEnvMapping() map[string]string {
	mapping := make(map[string]string, len(miniAppCatalog))
	for _, entry := range miniAppCatalog {
		if entry.EnvSuffix == "" {
			continue
		}
		mapping[entry.EnvSuffix] = entry.AppID
	}
	return mapping
}

func buildWorkflowByAppID(workflowsByKey map[miniAppWorkflowKey]func(context.Context) error) map[string]func(context.Context) error {
	workflowByAppID := make(map[string]func(context.Context) error, len(workflowsByKey))
	for _, entry := range miniAppCatalog {
		workflow, ok := workflowsByKey[entry.Key]
		if !ok {
			continue
		}
		workflowByAppID[entry.AppID] = workflow
	}
	return workflowByAppID
}

func defaultMiniAppConfigs() []MiniAppConfig {
	configs := make([]MiniAppConfig, 0, len(miniAppCatalog))
	for _, entry := range miniAppCatalog {
		if entry.DefaultConfig == nil {
			continue
		}
		configs = append(configs, *entry.DefaultConfig)
	}
	return configs
}
