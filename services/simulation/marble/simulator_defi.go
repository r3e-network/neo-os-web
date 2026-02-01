package neosimulation

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	neoaccountsclient "github.com/R3E-Network/neo-miniapps-platform/infrastructure/accountpool/client"
)

// SimulateFlashLoan simulates the flash loan workflow.
// Business flow: RequestLoan -> Execute arbitrage -> Repay
func (s *MiniAppSimulator) SimulateFlashLoan(ctx context.Context) error {
	appID := "miniapp-flashloan"
	amount := int64(100000000)

	memo := fmt.Sprintf("flash:borrow:%d:%d", amount, time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, 1000000, memo) // 0.01 GAS fee
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("flash loan: %w", err)
	}
	atomic.AddInt64(&s.flashloanBorrows, 1)

	// Invoke contract business logic if configured
	if s.invoker.HasMiniAppContract(appID) {
		borrowerAddress, ok := s.getRandomUserAddressOrWarn(appID, "request loan")
		if !ok {
			return nil
		}

		// Request loan
		_, err = s.invoker.InvokeMiniAppContract(ctx, appID, "RequestLoan", []neoaccountsclient.ContractParam{
			{Type: "Hash160", Value: borrowerAddress},
			{Type: "Integer", Value: amount},
			{Type: "Hash160", Value: borrowerAddress}, // callback contract
			{Type: "String", Value: "onFlashLoanCallback"},
		})
		if err != nil {
			atomic.AddInt64(&s.simulationErrors, 1)
			return fmt.Errorf("request loan contract: %w", err)
		}
	}

	atomic.AddInt64(&s.flashloanRepays, 1)
	return nil
}

// SimulateHeritageTrust simulates living trust DAO.
func (s *MiniAppSimulator) SimulateHeritageTrust(ctx context.Context) error {
	appID := "miniapp-heritage-trust"
	amount := int64(100000000)

	memo := fmt.Sprintf("trust:create:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("heritage trust: %w", err)
	}
	atomic.AddInt64(&s.heritageTrustCreates, 1)
	return nil
}

// SimulateCompoundCapsule simulates auto-compounding savings.
func (s *MiniAppSimulator) SimulateCompoundCapsule(ctx context.Context) error {
	appID := "miniapp-compound-capsule"
	amount := int64(50000000)

	memo := fmt.Sprintf("capsule:deposit:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("compound capsule: %w", err)
	}
	atomic.AddInt64(&s.compoundDeposits, 1)
	return nil
}

// SimulateSelfLoan simulates self-repaying loans.
func (s *MiniAppSimulator) SimulateSelfLoan(ctx context.Context) error {
	appID := "miniapp-self-loan"
	amount := int64(100000000)

	memo := fmt.Sprintf("loan:borrow:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("self loan: %w", err)
	}
	atomic.AddInt64(&s.selfLoanBorrows, 1)
	return nil
}

// SimulateUnbreakableVault simulates time-locked vault.
func (s *MiniAppSimulator) SimulateUnbreakableVault(ctx context.Context) error {
	appID := "miniapp-unbreakablevault"
	amount := int64(50000000)

	memo := fmt.Sprintf("vault:lock:%d", time.Now().UnixNano())
	_, err := s.invoker.PayToApp(ctx, appID, amount, memo)
	if err != nil {
		atomic.AddInt64(&s.simulationErrors, 1)
		return fmt.Errorf("unbreakable vault: %w", err)
	}
	atomic.AddInt64(&s.vaultLocks, 1)
	return nil
}
