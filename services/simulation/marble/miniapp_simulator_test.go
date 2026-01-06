// Package neosimulation provides simulation service for automated transaction testing.
package neosimulation

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// =============================================================================
// AllMiniApps Tests
// =============================================================================

func TestAllMiniApps(t *testing.T) {
	apps := AllMiniApps()

	assert.Len(t, apps, 37) // Phase 1-9: 37 total MiniApps (removed 30 deleted apps)

	// Verify all expected apps are present
	appIDs := make(map[string]bool)
	for _, app := range apps {
		appIDs[app.AppID] = true
	}

	// Phase 1 MiniApps
	assert.True(t, appIDs["miniapp-lottery"])
	assert.True(t, appIDs["miniapp-coin-flip"])
	assert.True(t, appIDs["miniapp-dice-game"])
	assert.True(t, appIDs["miniapp-scratch-card"])
	assert.True(t, appIDs["miniapp-mega-millions"])
	assert.True(t, appIDs["miniapp-flashloan"])
	assert.True(t, appIDs["miniapp-gas-spin"])
	assert.True(t, appIDs["miniapp-price-predict"])
	// Phase 2 MiniApps
	assert.True(t, appIDs["miniapp-secret-poker"])
	assert.True(t, appIDs["miniapp-micro-predict"])
	assert.True(t, appIDs["miniapp-red-envelope"])
	assert.True(t, appIDs["miniapp-gas-circle"])
	assert.True(t, appIDs["miniapp-govbooster"])
	// Phase 3 MiniApps
	assert.True(t, appIDs["miniapp-turbo-options"])
	// Phase 5 MiniApps - New deployed contracts
	assert.True(t, appIDs["miniapp-neo-crash"])
	assert.True(t, appIDs["miniapp-throne-of-gas"])
	assert.True(t, appIDs["miniapp-doomsday-clock"])
	// Phase 6 MiniApps - TEE-powered creative apps
	assert.True(t, appIDs["miniapp-time-capsule"])
	assert.True(t, appIDs["miniapp-dev-tipping"])
	// Phase 7 MiniApps - Advanced DeFi & Social
	assert.True(t, appIDs["miniapp-heritage-trust"])
	assert.True(t, appIDs["miniapp-graveyard"])
	assert.True(t, appIDs["miniapp-compound-capsule"])
	assert.True(t, appIDs["miniapp-self-loan"])
	assert.True(t, appIDs["miniapp-burn-league"])
	// Phase 8 MiniApps - Creative & Social
	assert.True(t, appIDs["miniapp-puzzle-mining"])
	assert.True(t, appIDs["miniapp-unbreakablevault"])
	assert.True(t, appIDs["miniapp-million-piece-map"])
	assert.True(t, appIDs["miniapp-cryptoriddle"])
	// Phase 9 MiniApps - New Social & Utility
	assert.True(t, appIDs["miniapp-grant-share"])
	assert.True(t, appIDs["miniapp-neo-ns"])
}

func TestAllMiniApps_Categories(t *testing.T) {
	apps := AllMiniApps()

	gaming := 0
	defi := 0
	governance := 0
	social := 0
	advanced := 0
	creative := 0
	utility := 0
	for _, app := range apps {
		switch app.Category {
		case "gaming":
			gaming++
		case "defi":
			defi++
		case "governance":
			governance++
		case "social":
			social++
		case "advanced":
			advanced++
		case "creative":
			creative++
		case "utility":
			utility++
		}
	}

	// Phase 1-9 totals after removing 30 deleted apps
	assert.Equal(t, 9, gaming)
	assert.Equal(t, 7, defi)
	assert.Equal(t, 2, governance)
	assert.Equal(t, 8, social)
	assert.Equal(t, 1, advanced)
	assert.Equal(t, 1, creative)
	assert.Equal(t, 1, utility)  // neo-ns
}

func TestAllMiniApps_BetAmounts(t *testing.T) {
	apps := AllMiniApps()

	for _, app := range apps {
		assert.Greater(t, app.BetAmount, int64(0), "%s should have positive bet amount", app.AppID)
	}
}

// =============================================================================
// NewMiniAppSimulator Tests
// =============================================================================

func TestNewMiniAppSimulator(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	require.NotNil(t, sim)
	assert.NotNil(t, sim.invoker)
}

// =============================================================================
// SimulateLottery Tests
// =============================================================================

func TestMiniAppSimulator_SimulateLottery_Success(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateLottery(ctx)

	require.NoError(t, err)

	// Verify PayToApp was called (USER ACTION - simulates SDK payGAS)
	payToAppCalls := mockInvoker.getPayToAppCalls()
	require.GreaterOrEqual(t, len(payToAppCalls), 1)
	assert.Equal(t, "miniapp-lottery", payToAppCalls[0].AppID)
	assert.Greater(t, payToAppCalls[0].Amount, int64(0))

	// Verify InvokeMiniAppContract was called (PLATFORM ACTION)
	miniAppCalls := mockInvoker.getInvokeMiniAppCalls()
	require.GreaterOrEqual(t, len(miniAppCalls), 1)
	assert.Equal(t, "miniapp-lottery", miniAppCalls[0].AppID)
	assert.Equal(t, "BuyTickets", miniAppCalls[0].Method)

	// Verify stats updated
	stats := sim.GetStats()
	lotteryStats := stats["gaming"].(map[string]interface{})["lottery"].(map[string]int64)
	assert.Greater(t, lotteryStats["tickets"], int64(0))
}

func TestMiniAppSimulator_SimulateLottery_PaymentError(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	mockInvoker.payToAppErr = errors.New("payment failed")
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateLottery(ctx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "buy tickets")

	// Verify error counter incremented
	stats := sim.GetStats()
	assert.Equal(t, int64(1), stats["errors"])
}

func TestMiniAppSimulator_SimulateLottery_DrawTriggered(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()

	// Run multiple times to trigger a draw (every 5 tickets)
	for i := 0; i < 50; i++ {
		_ = sim.SimulateLottery(ctx)
	}

	// Verify RecordRandomness was called for draws
	randomnessCalls := mockInvoker.getRecordRandomnessCalls()
	assert.Greater(t, len(randomnessCalls), 0)

	stats := sim.GetStats()
	lotteryStats := stats["gaming"].(map[string]interface{})["lottery"].(map[string]int64)
	assert.Greater(t, lotteryStats["draws"], int64(0))
}

// =============================================================================
// SimulateCoinFlip Tests
// =============================================================================

func TestMiniAppSimulator_SimulateCoinFlip_Success(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateCoinFlip(ctx)

	require.NoError(t, err)

	// Verify PayToApp was called (USER ACTION - simulates SDK payGAS)
	payToAppCalls := mockInvoker.getPayToAppCalls()
	require.GreaterOrEqual(t, len(payToAppCalls), 1)
	assert.Equal(t, "miniapp-coin-flip", payToAppCalls[0].AppID)
	assert.Equal(t, int64(5000000), payToAppCalls[0].Amount) // 0.05 GAS

	// Verify InvokeMiniAppContract was called (PLATFORM ACTION)
	miniAppCalls := mockInvoker.getInvokeMiniAppCalls()
	require.GreaterOrEqual(t, len(miniAppCalls), 1)
	assert.Equal(t, "miniapp-coin-flip", miniAppCalls[0].AppID)
	assert.Equal(t, "PlaceBet", miniAppCalls[0].Method)

	// Verify stats updated
	stats := sim.GetStats()
	coinFlipStats := stats["gaming"].(map[string]interface{})["coin_flip"].(map[string]int64)
	assert.Equal(t, int64(1), coinFlipStats["bets"])
}

func TestMiniAppSimulator_SimulateCoinFlip_PaymentError(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	mockInvoker.payToAppErr = errors.New("payment failed")
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateCoinFlip(ctx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "place bet")
}

// =============================================================================
// SimulateDiceGame Tests
// =============================================================================

func TestMiniAppSimulator_SimulateDiceGame_Success(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateDiceGame(ctx)

	require.NoError(t, err)

	// Verify PayToApp was called (USER ACTION - simulates SDK payGAS)
	payToAppCalls := mockInvoker.getPayToAppCalls()
	require.GreaterOrEqual(t, len(payToAppCalls), 1)
	assert.Equal(t, "miniapp-dice-game", payToAppCalls[0].AppID)
	assert.Equal(t, int64(8000000), payToAppCalls[0].Amount) // 0.08 GAS

	// Verify InvokeMiniAppContract was called (PLATFORM ACTION)
	miniAppCalls := mockInvoker.getInvokeMiniAppCalls()
	require.GreaterOrEqual(t, len(miniAppCalls), 1)
	assert.Equal(t, "miniapp-dice-game", miniAppCalls[0].AppID)
	assert.Equal(t, "PlaceBet", miniAppCalls[0].Method)

	// Verify stats updated
	stats := sim.GetStats()
	diceStats := stats["gaming"].(map[string]interface{})["dice_game"].(map[string]int64)
	assert.Equal(t, int64(1), diceStats["bets"])
}

func TestMiniAppSimulator_SimulateDiceGame_PaymentError(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	mockInvoker.payToAppErr = errors.New("payment failed")
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateDiceGame(ctx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "place dice bet")
}

// =============================================================================
// SimulateScratchCard Tests
// =============================================================================

func TestMiniAppSimulator_SimulateScratchCard_Success(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateScratchCard(ctx)

	require.NoError(t, err)

	// Verify PayToApp was called (USER ACTION - simulates SDK payGAS)
	payToAppCalls := mockInvoker.getPayToAppCalls()
	require.GreaterOrEqual(t, len(payToAppCalls), 1)
	assert.Equal(t, "miniapp-scratch-card", payToAppCalls[0].AppID)
	assert.GreaterOrEqual(t, payToAppCalls[0].Amount, int64(2000000))
	assert.LessOrEqual(t, payToAppCalls[0].Amount, int64(6000000))
	assert.Equal(t, int64(0), payToAppCalls[0].Amount%2000000)

	// Verify InvokeMiniAppContract was called (PLATFORM ACTION)
	miniAppCalls := mockInvoker.getInvokeMiniAppCalls()
	require.GreaterOrEqual(t, len(miniAppCalls), 1)
	assert.Equal(t, "miniapp-scratch-card", miniAppCalls[0].AppID)
	assert.Equal(t, "BuyCard", miniAppCalls[0].Method)

	// Verify stats updated
	stats := sim.GetStats()
	scratchStats := stats["gaming"].(map[string]interface{})["scratch_card"].(map[string]int64)
	assert.Equal(t, int64(1), scratchStats["buys"])
}

func TestMiniAppSimulator_SimulateScratchCard_PaymentError(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	mockInvoker.payToAppErr = errors.New("payment failed")
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateScratchCard(ctx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "buy scratch card")
}

// =============================================================================
// SimulateFlashLoan Tests
// =============================================================================

func TestMiniAppSimulator_SimulateFlashLoan_Success(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateFlashLoan(ctx)

	require.NoError(t, err)

	// Verify PayToApp was called (USER ACTION - simulates SDK payGAS for fee)
	payToAppCalls := mockInvoker.getPayToAppCalls()
	require.GreaterOrEqual(t, len(payToAppCalls), 1)
	assert.Equal(t, "miniapp-flashloan", payToAppCalls[0].AppID)
	assert.Equal(t, int64(1000000), payToAppCalls[0].Amount) // 0.01 GAS fee

	// Verify InvokeMiniAppContract was called (PLATFORM ACTION)
	miniAppCalls := mockInvoker.getInvokeMiniAppCalls()
	require.GreaterOrEqual(t, len(miniAppCalls), 1)
	assert.Equal(t, "miniapp-flashloan", miniAppCalls[0].AppID)
	assert.Equal(t, "RequestLoan", miniAppCalls[0].Method)

	// Verify stats updated
	stats := sim.GetStats()
	flashloanStats := stats["defi"].(map[string]interface{})["flashloan"].(map[string]int64)
	assert.Equal(t, int64(1), flashloanStats["borrows"])
	assert.Equal(t, int64(1), flashloanStats["repays"])
}

func TestMiniAppSimulator_SimulateFlashLoan_PaymentError(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	mockInvoker.payToAppErr = errors.New("payment failed")
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	ctx := context.Background()
	err := sim.SimulateFlashLoan(ctx)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "flash loan")
}

// =============================================================================
// GetStats Tests
// =============================================================================

func TestMiniAppSimulator_GetStats(t *testing.T) {
	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})

	stats := sim.GetStats()

	// Verify all stat categories exist
	assert.Contains(t, stats, "gaming")
	assert.Contains(t, stats, "defi")
	assert.Contains(t, stats, "social")
	assert.Contains(t, stats, "other")
	assert.Contains(t, stats, "phase5")
	assert.Contains(t, stats, "phase6")
	assert.Contains(t, stats, "phase7")
	assert.Contains(t, stats, "phase8")
	assert.Contains(t, stats, "phase10")
	assert.Contains(t, stats, "errors")

	gaming := stats["gaming"].(map[string]interface{})
	defi := stats["defi"].(map[string]interface{})
	social := stats["social"].(map[string]interface{})
	other := stats["other"].(map[string]interface{})
	phase7 := stats["phase7"].(map[string]interface{})
	phase8 := stats["phase8"].(map[string]interface{})
	phase10 := stats["phase10"].(map[string]interface{})

	assert.Contains(t, gaming, "lottery")
	assert.Contains(t, gaming, "coin_flip")
	assert.Contains(t, gaming, "dice_game")
	assert.Contains(t, gaming, "scratch_card")
	assert.Contains(t, gaming, "gas_spin")

	assert.Contains(t, defi, "flashloan")
	assert.Contains(t, defi, "price_predict")

	assert.Contains(t, social, "secret_poker")

	assert.Contains(t, other, "gov_booster")

	// Phase 7 stats
	assert.Contains(t, phase7, "heritage_trust")
	assert.Contains(t, phase7, "graveyard")
	assert.Contains(t, phase7, "compound_capsule")
	assert.Contains(t, phase7, "self_loan")
	assert.Contains(t, phase7, "burn_league")

	// Phase 8 stats
	assert.Contains(t, phase8, "puzzle_mining")
	assert.Contains(t, phase8, "unbreakable_vault")
	assert.Contains(t, phase8, "million_piece_map")
	assert.Contains(t, phase8, "crypto_riddle")

	// Phase 10 stats
	assert.Contains(t, phase10, "grant_share")
	assert.Contains(t, phase10, "neo_ns")
}

// =============================================================================
// Helper Function Tests
// =============================================================================

func TestRandomInt(t *testing.T) {
	// Test range [1, 6] (dice roll)
	for i := 0; i < 100; i++ {
		result := randomInt(1, 6)
		assert.GreaterOrEqual(t, result, 1)
		assert.LessOrEqual(t, result, 6)
	}

	// Test range [0, 1] (coin flip)
	for i := 0; i < 100; i++ {
		result := randomInt(0, 1)
		assert.GreaterOrEqual(t, result, 0)
		assert.LessOrEqual(t, result, 1)
	}

	// Test edge case: min == max
	result := randomInt(5, 5)
	assert.Equal(t, 5, result)

	// Test edge case: min > max (should return min)
	result = randomInt(10, 5)
	assert.Equal(t, 10, result)
}

func TestGenerateGameID(t *testing.T) {
	id1 := generateGameID()
	id2 := generateGameID()

	assert.Len(t, id1, 16) // 8 bytes = 16 hex chars
	assert.Len(t, id2, 16)
	assert.NotEqual(t, id1, id2)
}

// =============================================================================
// Integration-style Tests (verify account pool usage patterns)
// =============================================================================

func TestMiniAppSimulator_VerifyPaymentWorkflow(t *testing.T) {
	// This test verifies that all MiniApps use the correct workflow:
	// 1. USER ACTION: PayToApp (simulates SDK payGAS)
	// 2. PLATFORM ACTION: InvokeMiniAppContract (process game logic)
	// 3. PLATFORM ACTION: PayoutToUser (send winnings)

	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})
	ctx := context.Background()

	// Run all MiniApp simulations
	_ = sim.SimulateLottery(ctx)
	_ = sim.SimulateCoinFlip(ctx)
	_ = sim.SimulateDiceGame(ctx)
	_ = sim.SimulateScratchCard(ctx)
	_ = sim.SimulateFlashLoan(ctx)
	_ = sim.SimulateGasSpin(ctx)

	// Verify PayToApp was called for all payment-based MiniApps (USER ACTION)
	payToAppCalls := mockInvoker.getPayToAppCalls()
	// Expected: lottery + coin-flip + dice + scratch + flashloan + gas-spin = 6
	assert.GreaterOrEqual(t, len(payToAppCalls), 6)

	// Verify all expected apps made payment calls
	appPayments := make(map[string]int)
	for _, call := range payToAppCalls {
		appPayments[call.AppID]++
	}

	assert.Greater(t, appPayments["miniapp-lottery"], 0)
	assert.Greater(t, appPayments["miniapp-coin-flip"], 0)
	assert.Greater(t, appPayments["miniapp-dice-game"], 0)
	assert.Greater(t, appPayments["miniapp-scratch-card"], 0)
	assert.Greater(t, appPayments["miniapp-flashloan"], 0)
	assert.Greater(t, appPayments["miniapp-gas-spin"], 0)

	// Verify InvokeMiniAppContract was called (PLATFORM ACTION)
	miniAppCalls := mockInvoker.getInvokeMiniAppCalls()
	assert.GreaterOrEqual(t, len(miniAppCalls), 6)

	invokeCounts := make(map[string]int)
	for _, call := range miniAppCalls {
		invokeCounts[call.AppID]++
	}

	assert.Greater(t, invokeCounts["miniapp-lottery"], 0)
	assert.Greater(t, invokeCounts["miniapp-coin-flip"], 0)
	assert.Greater(t, invokeCounts["miniapp-dice-game"], 0)
	assert.Greater(t, invokeCounts["miniapp-scratch-card"], 0)
	assert.Greater(t, invokeCounts["miniapp-flashloan"], 0)
	assert.Greater(t, invokeCounts["miniapp-gas-spin"], 0)
}

func TestMiniAppSimulator_VerifyMasterAccountUsage(t *testing.T) {
	// This test verifies that PriceFeed and RandomnessLog use master account
	// (via UpdatePriceFeed and RecordRandomness which use InvokeMaster)
	// Note: These are called by the lottery draw, not by individual MiniApp simulations

	mockInvoker := newMockContractInvoker()
	sim := NewMiniAppSimulator(mockInvoker, []string{"NXtest1", "NXtest2", "NXtest3"})
	ctx := context.Background()

	// Run lottery multiple times to trigger a draw (every 5 tickets)
	for i := 0; i < 50; i++ {
		_ = sim.SimulateLottery(ctx)
	}

	// Verify RecordRandomness was called (uses master account) during lottery draws
	randomnessCalls := mockInvoker.getRecordRandomnessCalls()
	assert.Greater(t, len(randomnessCalls), 0)
}
