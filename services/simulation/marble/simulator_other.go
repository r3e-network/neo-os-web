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
	appID := "miniapp-gov-booster"
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
	appID := "miniapp-guardian-policy"
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

