package neosimulation

import (
	"context"
	"encoding/hex"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// SimulateGovBooster simulates bNEO governance optimization.
// Business flow: RequestBoost -> VerifyStake -> ApplyBoost
func (s *MiniAppSimulator) SimulateGovBooster(ctx context.Context) error {
	appID := "builtin-gov-booster"
	amount := int64(100000000) // 1 GAS minimum

	memo := fmt.Sprintf("gov:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("gov booster: %w", err)
	}
	atomic.AddInt64(&s.govBoosterVotes, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		voterAddress, ok := s.getRandomUserAddressOrWarn(appID, "request boost")
		if !ok {
			return nil
		}
		proposalID := fmt.Sprintf("proposal-%d", time.Now().UnixNano())
		lockDays := int64(randomInt(7, 90))

		// Request boost
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "RequestBoost", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: voterAddress},
			{Type: "String", Value: proposalID},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: lockDays},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("request boost contract: %w", err)
		}
	}
	return nil
}

// SimulateAITrader simulates autonomous AI trading.
// Business flow: CreateStrategy -> RequestPriceCheck -> ExecuteTrade
func (s *MiniAppSimulator) SimulateAITrader(ctx context.Context) error {
	appID := "builtin-ai-trader"
	amount := int64(10000000) // 0.1 GAS minimum

	memo := fmt.Sprintf("ai:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("ai trader: %w", err)
	}

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		traderAddress, ok := s.getRandomUserAddressOrWarn(appID, "create strategy")
		if !ok {
			return nil
		}

		// Create strategy
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateStrategy", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: traderAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Integer", Value: amount},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("create strategy contract: %w", err)
		}
	}
	return nil
}

// SimulateGridBot simulates automated grid trading.
// Business flow: CreateGrid -> RequestPriceCheck -> FillGridOrder
func (s *MiniAppSimulator) SimulateGridBot(ctx context.Context) error {
	appID := "builtin-grid-bot"
	amount := int64(10000000) // 0.1 GAS minimum

	memo := fmt.Sprintf("grid:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("grid bot: %w", err)
	}

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		traderAddress, ok := s.getRandomUserAddressOrWarn(appID, "create grid")
		if !ok {
			return nil
		}
		lowPrice := int64(randomInt(30000, 35000)) * 100000000
		highPrice := int64(randomInt(45000, 50000)) * 100000000
		gridLevels := int64(randomInt(5, 10))

		// Create grid
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateGrid", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: traderAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: lowPrice},
			{Type: "Integer", Value: highPrice},
			{Type: "Integer", Value: gridLevels},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("create grid contract: %w", err)
		}
	}
	return nil
}

// SimulateNFTEvolve simulates dynamic NFT evolution.
// Business flow: InitiateEvolution -> RequestRNG -> ResolveEvolution
func (s *MiniAppSimulator) SimulateNFTEvolve(ctx context.Context) error {
	appID := "builtin-nft-evolve"
	amount := int64(50000000) // 0.5 GAS evolution fee

	memo := fmt.Sprintf("nft:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("nft evolve: %w", err)
	}

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		ownerAddress, ok := s.getRandomUserAddressOrWarn(appID, "initiate evolution")
		if !ok {
			return nil
		}
		tokenID := generateRandomBytes(32)
		currentLevel := int64(randomInt(1, 5))

		// Initiate evolution
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "InitiateEvolution", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: ownerAddress},
			{Type: "ByteArray", Value: hex.EncodeToString(tokenID)},
			{Type: "Integer", Value: currentLevel},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("initiate evolution contract: %w", err)
		}
	}
	return nil
}

// SimulateBridgeGuardian simulates cross-chain bridge.
// Business flow: InitiateBridge -> RequestVerification -> CompleteBridge
func (s *MiniAppSimulator) SimulateBridgeGuardian(ctx context.Context) error {
	appID := "builtin-bridge-guardian"
	amount := int64(100000000) // 1 GAS minimum

	memo := fmt.Sprintf("bridge:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("bridge: %w", err)
	}

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		userAddress, ok := s.getRandomUserAddressOrWarn(appID, "initiate bridge")
		if !ok {
			return nil
		}
		targetChains := []string{"ethereum", "polygon", "arbitrum", "optimism"}
		targetChain := targetChains[randomInt(0, len(targetChains)-1)]
		targetAddress := fmt.Sprintf("0x%s", hex.EncodeToString(generateRandomBytes(20)))

		// Initiate bridge
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "InitiateBridge", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: userAddress},
			{Type: "String", Value: targetChain},
			{Type: "Integer", Value: amount},
			{Type: "String", Value: targetAddress},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("initiate bridge contract: %w", err)
		}
	}
	return nil
}

// SimulateFogChess simulates chess with fog of war.
// Business flow: CreateGame -> JoinGame -> SubmitMove -> RevealMove
func (s *MiniAppSimulator) SimulateFogChess(ctx context.Context) error {
	appID := "builtin-fog-chess"
	amount := int64(50000000) // 0.5 GAS minimum stake

	memo := fmt.Sprintf("chess:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("fog chess: %w", err)
	}
	atomic.AddInt64(&s.fogChessGames, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		player1Address, ok := s.getRandomUserAddressOrWarn(appID, "create game")
		if !ok {
			return nil
		}
		gameID := atomic.LoadInt64(&s.fogChessGames)

		// Create game (every 2 games)
		if gameID%2 == 1 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateGame", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: player1Address},
				{Type: "Integer", Value: amount},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("create game contract: %w", err)
			}
		} else {
			// Join existing game
			player2Address, ok := s.getRandomUserAddressOrWarn(appID, "join game")
			if !ok {
				return nil
			}
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "JoinGame", []neoaccountsclient.ContractParam{
				{Type: "Integer", Value: (gameID-1)/2 + 1},
				{Type: "Hash160", Value: player2Address},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("join game contract: %w", err)
			}
		}
	}

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.fogChessWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "fog chess payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*2, "chess:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("fog chess payout: %w", err)
		}
	}
	return nil
}
