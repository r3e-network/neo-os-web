package neosimulation

import (
	"context"
	"encoding/hex"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/client"
)

// SimulateSecretPoker simulates TEE Texas Hold'em.
// Business flow: CreateTable -> JoinTable -> StartHand
func (s *MiniAppSimulator) SimulateSecretPoker(ctx context.Context) error {
	appID := "miniapp-secret-poker"
	amount := int64(SecretPokerBuyIn)

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

		// Create table (every N games)
		if tableID%SecretPokerTableEveryN == 1 {
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
			{Type: "Integer", Value: (tableID-1)/SecretPokerTableEveryN + 1},
			{Type: "Hash160", Value: playerAddress},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("join table contract: %w", err)
		}

		// Start hand (every N joins)
		if tableID%SecretPokerHandEveryN == 0 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "StartHand", []neoaccountsclient.ContractParam{
				{Type: "Integer", Value: (tableID-1)/SecretPokerTableEveryN + 1},
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("start hand contract: %w", err)
			}
		}
	}

	if randomInt(1, SecretPokerWinChance) == 1 {
		atomic.AddInt64(&s.secretPokerWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "secret poker payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*SecretPokerPayoutMult, "poker:win")
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
	appID := "miniapp-micro-predict"
	amount := int64(MicroPredictBet)

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
		startPrice := int64(randomInt(MicroPredictMinPrice, MicroPredictMaxPrice)) * MicroPredictPriceScale

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
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, int64(float64(amount)*MicroPredictPayoutRate), "micro:win")
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
	appID := "miniapp-red-envelope"
	amount := int64(RedEnvelopeAmount)

	memo := fmt.Sprintf("redenv:%d", time.Now().UnixNano())
	txHash, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("red envelope: %w", err)
	}
	atomic.AddInt64(&s.redEnvelopeSends, 1)
	s.recordPayment(appID, txHash, amount)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		creatorAddress, ok := s.getRandomUserAddressOrWarn(appID, "create envelope")
		if !ok {
			return nil
		}
		packetCount := randomInt(RedEnvelopeMinPackets, RedEnvelopeMaxPackets)
		envelopeID := atomic.LoadInt64(&s.redEnvelopeSends)

		// Create envelope
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateEnvelope", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: creatorAddress},
			{Type: "Integer", Value: amount},
			{Type: "Integer", Value: packetCount},
			{Type: "Integer", Value: RedEnvelopeExpiryMS}, // 1 hour expiry
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("create envelope contract: %w", err)
		}

		// Simulate claims (1-3 claims per envelope)
		claimCount := randomInt(RedEnvelopeMinClaims, RedEnvelopeMaxClaims)
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

	claimAmount := int64(randomInt(1, RedEnvelopeMaxClaimAmt)) * RedEnvelopeClaimUnit
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
	appID := "miniapp-gas-circle"
	amount := int64(GasCircleDepositAmount)

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
		circleID := (atomic.LoadInt64(&s.gasCircleDeposits)-1)/GasCircleCreateEveryN + 1

		// Create circle (every N deposits)
		if atomic.LoadInt64(&s.gasCircleDeposits)%GasCircleCreateEveryN == 1 {
			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "CreateCircle", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: memberAddress},
				{Type: "Integer", Value: amount},
				{Type: "Integer", Value: GasCircleMaxMembers},
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

	if randomInt(1, GasCircleWinChance) == 1 {
		atomic.AddInt64(&s.gasCircleWins, 1)
		winnerAddress, ok := s.getRandomUserAddressOrWarn(appID, "gas circle payout")
		if !ok {
			return nil
		}
		_, err = s.invoker.PayoutToUser(ctx, appID, winnerAddress, amount*GasCirclePayoutMult, "circle:win")
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("gas circle payout: %w", err)
		}
	}
	return nil
}

// SimulateTimeCapsule simulates the TEE time capsule workflow.
// Business flow: Bury (encrypt) -> Fish (random pickup) -> Reveal (time unlock)
func (s *MiniAppSimulator) SimulateTimeCapsule(ctx context.Context) error {
	appID := "miniapp-time-capsule"
	buryFee := int64(TimeCapsuleBuryFee)
	fishFee := int64(TimeCapsuleFishFee)

	// Randomly decide action: bury (40%), fish (40%), reveal (20%)
	action := randomInt(1, 10)

	switch {
	case action <= TimeCapsuleBuryChance:
		// Bury a new time capsule
		memo := fmt.Sprintf("capsule:bury:%d", time.Now().UnixNano())
		txHash, err := s.invoker.PayToApp(ctx, appID, buryFee, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("time capsule bury: %w", err)
		}
		atomic.AddInt64(&s.timeCapsuleBuries, 1)
		s.recordPayment(appID, txHash, buryFee)

		if s.invoker.HasMiniAppContract(appID) {
			ownerAddress, ok := s.getRandomUserAddressOrWarn(appID, "bury capsule")
			if !ok {
				return nil
			}
			contentHash := hex.EncodeToString(generateRandomBytes())
			unlockTime := time.Now().Add(time.Duration(randomInt(1, TimeCapsuleMaxUnlockDays)) * 24 * time.Hour).Unix()

			_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Bury", []neoaccountsclient.ContractParam{
				{Type: "Hash160", Value: ownerAddress},
				{Type: "String", Value: contentHash},
				{Type: "Integer", Value: unlockTime},
				{Type: "Boolean", Value: randomInt(0, 1) == 1}, // isPublic
			})
			if err != nil {
				atomic.AddInt64(&s.simulationErrors, 1)
				return fmt.Errorf("bury contract: %w", err)
			}
		}
	case action <= TimeCapsuleFishChance:
		// Fish for a random public capsule
		memo := fmt.Sprintf("capsule:fish:%d", time.Now().UnixNano())
		txHash, err := s.invoker.PayToApp(ctx, appID, fishFee, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("time capsule fish: %w", err)
		}
		atomic.AddInt64(&s.timeCapsuleFishes, 1)
		s.recordPayment(appID, txHash, fishFee)
	default:
		// Reveal an unlocked capsule
		atomic.AddInt64(&s.timeCapsuleReveals, 1)
	}
	return nil
}

// SimulateDevTipping simulates the EcoBoost developer tipping app.
func (s *MiniAppSimulator) SimulateDevTipping(ctx context.Context) error {
	appID := "miniapp-dev-tipping"
	tipAmount := int64(randomInt(1, DevTippingMaxAmount)) * DevTippingUnit

	devID := randomInt(1, DevTippingMaxDevID)
	memo := fmt.Sprintf("tip:dev%d:%d", devID, time.Now().UnixNano())

	_, err := s.invoker.PayToApp(ctx, appID, tipAmount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("dev tipping: %w", err)
	}
	atomic.AddInt64(&s.devTippingTips, 1)

	if s.invoker.HasMiniAppContract(appID) {
		tipperAddress, ok := s.getRandomUserAddressOrWarn(appID, "tip developer")
		if !ok {
			return nil
		}
		messages := []string{"Thanks!", "Keep building!", "Great work!", "Coffee on me!"}
		message := messages[randomInt(0, len(messages)-1)]

		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "Tip", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: tipperAddress},
			{Type: "Integer", Value: devID},
			{Type: "Integer", Value: tipAmount},
			{Type: "String", Value: message},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("tip contract: %w", err)
		}
	}
	return nil
}

// SimulateGraveyard simulates digital graveyard.
func (s *MiniAppSimulator) SimulateGraveyard(ctx context.Context) error {
	appID := "miniapp-graveyard"
	amount := int64(GraveyardBurialFee)

	memo := fmt.Sprintf("grave:bury:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("graveyard: %w", err)
	}
	atomic.AddInt64(&s.graveyardBurials, 1)
	return nil
}

// SimulateGrantShare simulates community grant funding.
// Business flow: CreateGrant -> FundGrant -> WithdrawFunds
func (s *MiniAppSimulator) SimulateGrantShare(ctx context.Context) error {
	appID := "miniapp-grant-share"
	amount := int64(GrantShareAmount)

	// Randomly create or fund a grant
	if randomInt(0, GrantShareCreateChance) == 0 {
		// Create a new grant
		memo := fmt.Sprintf("grant:create:%d", time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("grant share create: %w", err)
		}
		atomic.AddInt64(&s.grantShareCreates, 1)
	} else {
		// Fund an existing grant
		grantID := fmt.Sprintf("grant-%d", randomInt(1, GrantShareMaxGrantID))
		memo := fmt.Sprintf("grant:fund:%s:%d", grantID, time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("grant share fund: %w", err)
		}
		atomic.AddInt64(&s.grantShareFunds, 1)
	}
	return nil
}

// SimulateNeoNS simulates Neo Name Service domain registration.
// Business flow: SearchDomain -> RegisterDomain -> RenewDomain
func (s *MiniAppSimulator) SimulateNeoNS(ctx context.Context) error {
	appID := "miniapp-neo-ns"
	amount := int64(NeoNSBasePrice)

	// Randomly register or renew
	if randomInt(0, NeoNSRegisterChance) == 0 {
		// Register a new domain
		domainName := fmt.Sprintf("user%d.neo", randomInt(NeoNSMinDomainNum, NeoNSMaxDomainNum))
		memo := fmt.Sprintf("nns:register:%s:%d", domainName, time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, amount*NeoNSRegistrationMult, memo) // Registration costs more
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("neo ns register: %w", err)
		}
		atomic.AddInt64(&s.neoNSRegistrations, 1)
	} else {
		// Renew an existing domain
		domainName := fmt.Sprintf("user%d.neo", randomInt(NeoNSRenewMinNum, NeoNSRenewMaxNum))
		memo := fmt.Sprintf("nns:renew:%s:%d", domainName, time.Now().UnixNano())
		_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("neo ns renew: %w", err)
		}
		atomic.AddInt64(&s.neoNSRenewals, 1)
	}
	return nil
}
