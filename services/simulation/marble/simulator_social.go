package neosimulation

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"
)

// SimulateSecretVote simulates privacy-preserving voting.
func (s *MiniAppSimulator) SimulateSecretVote(ctx context.Context) error {
	appID := "builtin-secret-vote"
	amount := int64(1000000)

	memo := fmt.Sprintf("vote:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("secret vote: %w", err)
	}
	atomic.AddInt64(&s.secretVoteCasts, 1)

	if atomic.LoadInt64(&s.secretVoteCasts)%5 == 0 {
		atomic.AddInt64(&s.secretVoteTallies, 1)
	}
	return nil
}

// SimulateSecretPoker simulates TEE Texas Hold'em.
func (s *MiniAppSimulator) SimulateSecretPoker(ctx context.Context) error {
	appID := "builtin-secret-poker"
	amount := int64(50000000)

	memo := fmt.Sprintf("poker:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("poker: %w", err)
	}
	atomic.AddInt64(&s.secretPokerGames, 1)

	if randomInt(1, 4) == 1 {
		atomic.AddInt64(&s.secretPokerWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, _ = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*3, "poker:win")
	}
	return nil
}

// SimulateMicroPredict simulates 60-second price predictions.
func (s *MiniAppSimulator) SimulateMicroPredict(ctx context.Context) error {
	appID := "builtin-micro-predict"
	amount := int64(10000000)

	memo := fmt.Sprintf("micro:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("micro predict: %w", err)
	}
	atomic.AddInt64(&s.microPredictBets, 1)

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.microPredictWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, _ = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.9), "micro:win")
	}
	return nil
}

// SimulateRedEnvelope simulates social GAS red packets.
func (s *MiniAppSimulator) SimulateRedEnvelope(ctx context.Context) error {
	appID := "builtin-red-envelope"
	amount := int64(20000000)

	memo := fmt.Sprintf("redenv:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("red envelope: %w", err)
	}
	atomic.AddInt64(&s.redEnvelopeSends, 1)

	claimAmount := int64(randomInt(1, 20)) * 1000000
	winnerAddress := s.getRandomUserAddress()
	_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, claimAmount, "redenv:claim")
	if err == nil {
		atomic.AddInt64(&s.redEnvelopeClaims, 1)
	}
	return nil
}

// SimulateGasCircle simulates daily savings circle with lottery.
func (s *MiniAppSimulator) SimulateGasCircle(ctx context.Context) error {
	appID := "builtin-gas-circle"
	amount := int64(10000000)

	memo := fmt.Sprintf("circle:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("gas circle: %w", err)
	}
	atomic.AddInt64(&s.gasCircleDeposits, 1)

	if randomInt(1, 10) == 1 {
		atomic.AddInt64(&s.gasCircleWins, 1)
		winnerAddress := s.getRandomUserAddress()
		_, _ = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*10, "circle:win")
	}
	return nil
}
