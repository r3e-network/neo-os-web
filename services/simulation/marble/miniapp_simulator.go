// Package neosimulation provides MiniApp workflow simulation.
package neosimulation

import (
	"fmt"
	"sync/atomic"
)

// MiniAppSimulator simulates all MiniApp workflows.
type MiniAppSimulator struct {
	invoker       ContractInvokerInterface
	userAddresses []string

	// Gaming stats
	lotteryTickets      int64
	lotteryDraws        int64
	lotteryPayouts      int64
	coinFlipBets        int64
	coinFlipWins        int64
	coinFlipPayouts     int64
	diceGameBets        int64
	diceGameWins        int64
	diceGamePayouts     int64
	scratchCardBuys     int64
	scratchCardWins     int64
	scratchCardPayouts  int64
	megaMillionsTickets int64
	megaMillionsDraws   int64
	megaMillionsWins    int64
	megaMillionsPayouts int64
	gasSpinBets         int64
	gasSpinWins         int64
	gasSpinPayouts      int64

	// DeFi stats
	predictionBets      int64
	predictionResolves  int64
	predictionPayouts   int64
	flashloanBorrows    int64
	flashloanRepays     int64
	priceQueries        int64
	pricePredictBets    int64
	pricePredictWins    int64
	pricePredictPayouts int64
	turboOptionsBets    int64
	turboOptionsWins    int64
	turboOptionsPayouts int64
	ilGuardDeposits     int64
	ilGuardClaims       int64

	// Social stats
	secretVoteCasts   int64
	secretVoteTallies int64
	secretPokerGames  int64
	secretPokerWins   int64
	microPredictBets  int64
	microPredictWins  int64
	redEnvelopeSends  int64
	redEnvelopeClaims int64
	gasCircleDeposits int64
	gasCircleWins     int64

	// Governance & Advanced stats
	govBoosterVotes  int64
	fogChessGames    int64
	fogChessWins     int64
	simulationErrors int64

	missingUserAddressesLogged uint32
}

// NewMiniAppSimulator creates a new MiniApp simulator.
func NewMiniAppSimulator(invoker ContractInvokerInterface, userAddresses []string) *MiniAppSimulator {
	return &MiniAppSimulator{
		invoker:       invoker,
		userAddresses: userAddresses,
	}
}

// getRandomUserAddress returns a random user address for payouts.
func (s *MiniAppSimulator) getRandomUserAddress() string {
	if len(s.userAddresses) == 0 {
		return ""
	}
	return s.userAddresses[randomInt(0, len(s.userAddresses)-1)]
}

func (s *MiniAppSimulator) getRandomUserAddressOrWarn(appID, action string) (string, bool) {
	address := s.getRandomUserAddress()
	if address == "" {
		atomic.AddInt64(&s.simulationErrors, 1)
		if atomic.CompareAndSwapUint32(&s.missingUserAddressesLogged, 0, 1) {
			fmt.Printf("neosimulation: skipping %s for %s: no user addresses configured\n", action, appID)
		}
		return "", false
	}
	return address, true
}

// GetStats returns current simulation statistics.
func (s *MiniAppSimulator) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"gaming": map[string]interface{}{
			"lottery":       map[string]int64{"tickets": atomic.LoadInt64(&s.lotteryTickets), "draws": atomic.LoadInt64(&s.lotteryDraws), "payouts": atomic.LoadInt64(&s.lotteryPayouts)},
			"coin_flip":     map[string]int64{"bets": atomic.LoadInt64(&s.coinFlipBets), "wins": atomic.LoadInt64(&s.coinFlipWins), "payouts": atomic.LoadInt64(&s.coinFlipPayouts)},
			"dice_game":     map[string]int64{"bets": atomic.LoadInt64(&s.diceGameBets), "wins": atomic.LoadInt64(&s.diceGameWins), "payouts": atomic.LoadInt64(&s.diceGamePayouts)},
			"scratch_card":  map[string]int64{"buys": atomic.LoadInt64(&s.scratchCardBuys), "wins": atomic.LoadInt64(&s.scratchCardWins), "payouts": atomic.LoadInt64(&s.scratchCardPayouts)},
			"mega_millions": map[string]int64{"tickets": atomic.LoadInt64(&s.megaMillionsTickets), "draws": atomic.LoadInt64(&s.megaMillionsDraws), "wins": atomic.LoadInt64(&s.megaMillionsWins)},
			"gas_spin":      map[string]int64{"bets": atomic.LoadInt64(&s.gasSpinBets), "wins": atomic.LoadInt64(&s.gasSpinWins), "payouts": atomic.LoadInt64(&s.gasSpinPayouts)},
		},
		"defi": map[string]interface{}{
			"prediction":    map[string]int64{"bets": atomic.LoadInt64(&s.predictionBets), "resolves": atomic.LoadInt64(&s.predictionResolves), "payouts": atomic.LoadInt64(&s.predictionPayouts)},
			"flashloan":     map[string]int64{"borrows": atomic.LoadInt64(&s.flashloanBorrows), "repays": atomic.LoadInt64(&s.flashloanRepays)},
			"price_ticker":  map[string]int64{"queries": atomic.LoadInt64(&s.priceQueries)},
			"price_predict": map[string]int64{"bets": atomic.LoadInt64(&s.pricePredictBets), "wins": atomic.LoadInt64(&s.pricePredictWins), "payouts": atomic.LoadInt64(&s.pricePredictPayouts)},
			"turbo_options": map[string]int64{"bets": atomic.LoadInt64(&s.turboOptionsBets), "wins": atomic.LoadInt64(&s.turboOptionsWins), "payouts": atomic.LoadInt64(&s.turboOptionsPayouts)},
			"il_guard":      map[string]int64{"deposits": atomic.LoadInt64(&s.ilGuardDeposits), "claims": atomic.LoadInt64(&s.ilGuardClaims)},
		},
		"social": map[string]interface{}{
			"secret_vote":   map[string]int64{"casts": atomic.LoadInt64(&s.secretVoteCasts), "tallies": atomic.LoadInt64(&s.secretVoteTallies)},
			"secret_poker":  map[string]int64{"games": atomic.LoadInt64(&s.secretPokerGames), "wins": atomic.LoadInt64(&s.secretPokerWins)},
			"micro_predict": map[string]int64{"bets": atomic.LoadInt64(&s.microPredictBets), "wins": atomic.LoadInt64(&s.microPredictWins)},
			"red_envelope":  map[string]int64{"sends": atomic.LoadInt64(&s.redEnvelopeSends), "claims": atomic.LoadInt64(&s.redEnvelopeClaims)},
			"gas_circle":    map[string]int64{"deposits": atomic.LoadInt64(&s.gasCircleDeposits), "wins": atomic.LoadInt64(&s.gasCircleWins)},
		},
		"other": map[string]interface{}{
			"gov_booster": map[string]int64{"votes": atomic.LoadInt64(&s.govBoosterVotes)},
			"fog_chess":   map[string]int64{"games": atomic.LoadInt64(&s.fogChessGames), "wins": atomic.LoadInt64(&s.fogChessWins)},
		},
		"errors": atomic.LoadInt64(&s.simulationErrors),
	}
}
