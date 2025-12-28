package neosimulation

import (
	"context"
	"encoding/hex"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/service_layer/infrastructure/accountpool/client"
)

// SimulateSecretVote simulates privacy-preserving voting.
// Business flow: CreateProposal -> SubmitVote -> RequestTally
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		voterAddress, ok := s.getRandomUserAddressOrWarn(appID, "submit vote")
		if !ok {
			return nil
		}
		proposalID := fmt.Sprintf("proposal-%d", time.Now().UnixNano())
		encryptedVote := generateRandomBytes(32)

		// Create proposal (every 10 votes)
		if atomic.LoadInt64(&s.secretVoteCasts)%10 == 1 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateProposal", []neoaccountsclient.ContractParam{
				{Type: "String", Value: proposalID},
				{Type: "Hash160", Value: voterAddress},
				{Type: "String", Value: "Simulation proposal"},
				{Type: "Integer", Value: 3600000}, // 1 hour duration
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("create proposal contract: %w", err)
			}
		}

		// Submit vote
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "SubmitVote", []neoaccountsclient.ContractParam{
			{Type: "String", Value: proposalID},
			{Type: "Hash160", Value: voterAddress},
			{Type: "ByteArray", Value: hex.EncodeToString(encryptedVote)},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("submit vote contract: %w", err)
		}
	}

	if atomic.LoadInt64(&s.secretVoteCasts)%5 == 0 {
		atomic.AddInt64(&s.secretVoteTallies, 1)
	}
	return nil
}

// SimulateSecretPoker simulates TEE Texas Hold'em.
// Business flow: CreateTable -> JoinTable -> StartHand
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "join table")
		if !ok {
			return nil
		}
		tableID := atomic.LoadInt64(&s.secretPokerGames)

		// Create table (every 5 games)
		if tableID%5 == 1 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateTable", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: playerAddress},
				{Type: "Integer", Value: amount},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("create table contract: %w", err)
			}
		}

		// Join table
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "JoinTable", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: (tableID-1)/5 + 1},
			{Type: "Hash160", Value: playerAddress},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("join table contract: %w", err)
		}

		// Start hand (every 4 joins)
		if tableID%4 == 0 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "StartHand", []neoaccountsclient.ContractParam{
				{Type: "Integer", Value: (tableID-1)/5 + 1},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("start hand contract: %w", err)
			}
		}
	}

	if randomInt(1, 4) == 1 {
		atomic.AddInt64(&s.secretPokerWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "secret poker payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*3, "poker:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("secret poker payout: %w", err)
		}
	}
	return nil
}

// SimulateMicroPredict simulates 60-second price predictions.
// Business flow: PlacePrediction -> RequestResolve
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		playerAddress, ok := s.getRandomUserAddressOrWarn(appID, "place prediction")
		if !ok {
			return nil
		}
		direction := randomInt(0, 1) == 1
		startPrice := int64(randomInt(30000, 50000)) * 100000000

		// Place prediction
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "PlacePrediction", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: playerAddress},
			{Type: "String", Value: "NEO/GAS"},
			{Type: "Boolean", Value: direction},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: startPrice},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("place prediction contract: %w", err)
		}
	}

	if randomInt(0, 1) == 1 {
		atomic.AddInt64(&s.microPredictWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "micro predict payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*1.9), "micro:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("micro predict payout: %w", err)
		}
	}
	return nil
}

// SimulateRedEnvelope simulates social GAS red packets.
// Business flow: CreateEnvelope -> Claim (multiple times)
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		creatorAddress, ok := s.getRandomUserAddressOrWarn(appID, "create envelope")
		if !ok {
			return nil
		}
		packetCount := randomInt(3, 10)
		envelopeID := atomic.LoadInt64(&s.redEnvelopeSends)

		// Create envelope
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateEnvelope", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: creatorAddress},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: packetCount},
			{Type: "Integer", Value: 3600000}, // 1 hour expiry
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("create envelope contract: %w", err)
		}

		// Simulate claims (1-3 claims per envelope)
		claimCount := randomInt(1, 3)
		for i := 0; i < claimCount; i++ {
			claimerAddress, ok := s.getRandomUserAddressOrWarn(appID, "claim envelope")
			if !ok {
				return nil
			}
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Claim", []neoaccountsclient.ContractParam{
				{Type: "Integer", Value: envelopeID},
				{Type: "Hash160", Value: claimerAddress},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("claim envelope contract: %w", err)
			}
		}
	}

	claimAmount := int64(randomInt(1, 20)) * 1000000
	winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "red envelope payout")
	if !ok {
		return nil
	}
	_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, claimAmount, "redenv:claim")
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("red envelope payout: %w", err)
	}
	atomic.AddInt64(&s.redEnvelopeClaims, 1)
	return nil
}

// SimulateGasCircle simulates daily savings circle with lottery.
// Business flow: CreateCircle -> JoinCircle -> MakeDeposit -> RequestPayout
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

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		memberAddress, ok := s.getRandomUserAddressOrWarn(appID, "join circle")
		if !ok {
			return nil
		}
		circleID := (atomic.LoadInt64(&s.gasCircleDeposits)-1)/10 + 1

		// Create circle (every 10 deposits)
		if atomic.LoadInt64(&s.gasCircleDeposits)%10 == 1 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateCircle", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: memberAddress},
				{Type: "Integer", Value: amount},
				{Type: "Integer", Value: 10}, // max 10 members
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("create circle contract: %w", err)
			}
		}

		// Join circle
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "JoinCircle", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: circleID},
			{Type: "Hash160", Value: memberAddress},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("join circle contract: %w", err)
		}

		// Make deposit
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "MakeDeposit", []neoaccountsclient.ContractParam{
			{Type: "Integer", Value: circleID},
			{Type: "Hash160", Value: memberAddress},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("make deposit contract: %w", err)
		}
	}

	if randomInt(1, 10) == 1 {
		atomic.AddInt64(&s.gasCircleWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "gas circle payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*10, "circle:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("gas circle payout: %w", err)
		}
	}
	return nil
}
