package neosimulation

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// SimulateGovBooster simulates bNEO governance optimization.
// Business flow: RequestBoost -> VerifyStake -> ApplyBoost
func (s *MiniAppSimulator) SimulateGovBooster(ctx context.Context) error {
	appID := "miniapp-govbooster"
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

// SimulateGuardianPolicy simulates guardian policy setup.
func (s *MiniAppSimulator) SimulateGuardianPolicy(ctx context.Context) error {
	appID := "miniapp-guardianpolicy"
	amount := int64(5000000)

	memo := fmt.Sprintf("guardian:set:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("guardian policy: %w", err)
	}
	atomic.AddInt64(&s.guardianPolicySets, 1)
	return nil
}

// SimulateDailyCheckin simulates daily check-in workflow.
// Business flow: Pay fee -> CheckIn -> (optionally) ClaimRewards
func (s *MiniAppSimulator) SimulateDailyCheckin(ctx context.Context) error {
	appID := "miniapp-dailycheckin"
	amount := int64(100000) // 0.001 GAS check-in fee

	memo := fmt.Sprintf("checkin:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("daily checkin payment: %w", err)
	}
	atomic.AddInt64(&s.dailyCheckins, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		userAddress, ok := s.getRandomUserAddressOrWarn(appID, "check in")
		if !ok {
			return nil
		}

		// Generate a mock receipt ID
		receiptID := time.Now().UnixNano()

		// CheckIn
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CheckIn", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: userAddress},
			{Type: "Integer", Value: receiptID},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("checkin contract: %w", err)
		}

		// Randomly claim rewards (20% chance)
		if randomInt(1, 100) <= 20 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "ClaimRewards", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: userAddress},
			})
			if err == nil {
				atomic.AddInt64(&s.dailyCheckinClaims, 1)
			}
		}
	}
	return nil
}

// SimulateGovMerc simulates governance mercenary voting.
func (s *MiniAppSimulator) SimulateGovMerc(ctx context.Context) error {
	appID := "miniapp-gov-merc"
	amount := int64(10000000)
	memo := fmt.Sprintf("govmerc:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("gov merc: %w", err)
	}
	atomic.AddInt64(&s.govMercVotes, 1)
	return nil
}

// SimulateMasqueradeDAO simulates anonymous DAO voting.
func (s *MiniAppSimulator) SimulateMasqueradeDAO(ctx context.Context) error {
	appID := "miniapp-masqueradedao"
	amount := int64(5000000)
	memo := fmt.Sprintf("masquerade:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("masquerade dao: %w", err)
	}
	atomic.AddInt64(&s.masqueradeVotes, 1)
	return nil
}

// SimulateGardenOfNeo simulates virtual garden planting.
func (s *MiniAppSimulator) SimulateGardenOfNeo(ctx context.Context) error {
	appID := "miniapp-garden-of-neo"
	amount := int64(10000000)
	memo := fmt.Sprintf("garden:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("garden of neo: %w", err)
	}
	atomic.AddInt64(&s.gardenOfNeoPlants, 1)
	return nil
}

// SimulateOnChainTarot simulates tarot card readings.
func (s *MiniAppSimulator) SimulateOnChainTarot(ctx context.Context) error {
	appID := "miniapp-on-chain-tarot"
	amount := int64(5000000)
	memo := fmt.Sprintf("tarot:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("on chain tarot: %w", err)
	}
	atomic.AddInt64(&s.tarotReadings, 1)
	return nil
}

// SimulateExFiles simulates ex-files sharing.
func (s *MiniAppSimulator) SimulateExFiles(ctx context.Context) error {
	appID := "miniapp-ex-files"
	amount := int64(5000000)
	memo := fmt.Sprintf("exfiles:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("ex files: %w", err)
	}
	atomic.AddInt64(&s.exFilesShares, 1)
	return nil
}

// SimulateBreakupContract simulates breakup contract creation.
func (s *MiniAppSimulator) SimulateBreakupContract(ctx context.Context) error {
	appID := "miniapp-breakup-contract"
	amount := int64(10000000)
	memo := fmt.Sprintf("breakup:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("breakup contract: %w", err)
	}
	atomic.AddInt64(&s.breakupContracts, 1)
	return nil
}

// SimulateMillionPieceMap simulates pixel map purchases.
func (s *MiniAppSimulator) SimulateMillionPieceMap(ctx context.Context) error {
	appID := "miniapp-million-piece-map"
	amount := int64(1000000)
	memo := fmt.Sprintf("map:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("million piece map: %w", err)
	}
	atomic.AddInt64(&s.mapPieceBuys, 1)
	return nil
}

// SimulateCanvas simulates collaborative canvas drawing.
func (s *MiniAppSimulator) SimulateCanvas(ctx context.Context) error {
	appID := "miniapp-canvas"
	amount := int64(1000000)
	memo := fmt.Sprintf("canvas:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("canvas: %w", err)
	}
	atomic.AddInt64(&s.canvasDraws, 1)
	return nil
}

// SimulateCandidateVote simulates candidate voting.
func (s *MiniAppSimulator) SimulateCandidateVote(ctx context.Context) error {
	appID := "miniapp-candidate-vote"
	amount := int64(10000000)
	memo := fmt.Sprintf("vote:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("candidate vote: %w", err)
	}
	atomic.AddInt64(&s.candidateVotes, 1)
	return nil
}

// SimulateNeoburger simulates NEO staking via NeoBurger.
func (s *MiniAppSimulator) SimulateNeoburger(ctx context.Context) error {
	appID := "miniapp-neoburger"
	amount := int64(100000000)
	memo := fmt.Sprintf("neoburger:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("neoburger: %w", err)
	}
	atomic.AddInt64(&s.neoburgerStakes, 1)
	return nil
}

