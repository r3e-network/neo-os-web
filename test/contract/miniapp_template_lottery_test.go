package contract

import "testing"

func TestMiniAppTemplateLotteryContract(t *testing.T) {
	deployed := deployContractNeotest(t, "MiniAppTemplate.Lottery", nil)

	t.Run("Admin", func(t *testing.T) {
		deployed.requireAdminEqualsDeployer(t)
	})

	t.Run("FreshState", func(t *testing.T) {
		deployed.requireLotteryStateZeroed(t)
	})

	t.Run("BuyTicketWithoutConfiguredWindowFaults", func(t *testing.T) {
		deployed.invokeFault(t, "Ticket sale ended", "buyTicket", int64(1))
		deployed.requireLotteryStateZeroed(t)
	})
}
