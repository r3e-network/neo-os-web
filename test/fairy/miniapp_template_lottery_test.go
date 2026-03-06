package fairy

import (
	"strings"
	"testing"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
)

func requireZeroInteger(t *testing.T, item chain.StackItem, field string) {
	t.Helper()

	value, err := chain.ParseInteger(item)
	if err != nil {
		t.Fatalf("parse %s: %v", field, err)
	}
	if value.Sign() != 0 {
		t.Fatalf("%s = %s, want 0", field, value.String())
	}
}

func TestMiniAppTemplateLotteryContractWithFairy(t *testing.T) {
	skipIfNoFairy(t)

	nefPath, manifestPath := getBuiltContractPaths(t, "MiniAppTemplate.Lottery")
	client := NewClient(fairyRPCURL)

	sessionID, _, err := client.SetupSessionWithGas(1000_00000000)
	if err != nil {
		t.Skipf("SetupSessionWithGas: %v", err)
	}
	defer client.DeleteSession(sessionID)

	deployResult, err := client.VirtualDeploy(sessionID, nefPath, manifestPath)
	if err != nil {
		t.Fatalf("VirtualDeploy: %v", err)
	}
	if deployResult.State != "HALT" {
		t.Fatalf("deploy state = %s, want HALT", deployResult.State)
	}

	adminResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "admin", nil)
	if err != nil {
		t.Fatalf("admin(): %v", err)
	}
	if adminResult.State != "HALT" {
		t.Fatalf("admin() state = %s, want HALT", adminResult.State)
	}
	if len(adminResult.Stack) == 0 {
		t.Fatal("admin() returned empty stack")
	}

	adminHash, err := chain.ParseHash160(adminResult.Stack[0])
	if err != nil {
		t.Fatalf("parse admin hash: %v", err)
	}
	if adminHash == "" || adminHash == "0x0000000000000000000000000000000000000000" {
		t.Fatalf("admin hash = %q, want non-zero hash", adminHash)
	}

	stateResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "getLotteryState", nil)
	if err != nil {
		t.Fatalf("getLotteryState(): %v", err)
	}
	if stateResult.State != "HALT" {
		t.Fatalf("getLotteryState() state = %s, want HALT", stateResult.State)
	}
	if len(stateResult.Stack) == 0 {
		t.Fatal("getLotteryState() returned empty stack")
	}

	stateFields, err := chain.ParseArray(stateResult.Stack[0])
	if err != nil {
		t.Fatalf("parse lottery state: %v", err)
	}
	if len(stateFields) != 3 {
		t.Fatalf("lottery state field count = %d, want 3", len(stateFields))
	}

	isDrawn, err := chain.ParseBoolean(stateFields[0])
	if err != nil {
		t.Fatalf("parse IsDrawn: %v", err)
	}
	if isDrawn {
		t.Fatal("IsDrawn = true, want false on fresh deploy")
	}
	if stateFields[1].Type != "Integer" {
		t.Fatalf("TotalTicketsSold type = %s, want Integer", stateFields[1].Type)
	}
	if stateFields[2].Type != "Integer" {
		t.Fatalf("TotalPrizePool type = %s, want Integer", stateFields[2].Type)
	}
	if stateFields[1].Value == nil || stateFields[2].Value == nil {
		t.Fatal("lottery state returned nil integer values")
	}
	requireZeroInteger(t, stateFields[1], "TotalTicketsSold")
	requireZeroInteger(t, stateFields[2], "TotalPrizePool")

	paramsResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "getLotteryParams", nil)
	if err != nil {
		t.Fatalf("getLotteryParams(): %v", err)
	}
	if paramsResult.State != "HALT" {
		t.Fatalf("getLotteryParams() state = %s, want HALT", paramsResult.State)
	}
	if len(paramsResult.Stack) == 0 {
		t.Fatal("getLotteryParams() returned empty stack")
	}

	paramFields, err := chain.ParseArray(paramsResult.Stack[0])
	if err != nil {
		t.Fatalf("parse lottery params: %v", err)
	}
	if len(paramFields) != 9 {
		t.Fatalf("lottery params field count = %d, want 9", len(paramFields))
	}

	requireZeroInteger(t, paramFields[1], "TicketPrice")
	requireZeroInteger(t, paramFields[2], "MaxTicketsPerUser")
	requireZeroInteger(t, paramFields[3], "MaxTotalTickets")
	requireZeroInteger(t, paramFields[4], "EndTimestamp")
	requireZeroInteger(t, paramFields[5], "DrawTimestamp")
	requireZeroInteger(t, paramFields[6], "PrizePool")
	requireZeroInteger(t, paramFields[7], "WinnerCount")

	t.Run("BuyTicketWithoutConfiguredWindowFaults", func(t *testing.T) {
		buyResult, err := client.InvokeFunctionWithSession(sessionID, true, deployResult.ContractHash, "buyTicket", []interface{}{1})
		if err != nil {
			t.Fatalf("buyTicket(1): %v", err)
		}
		if buyResult.State != "FAULT" {
			t.Fatalf("buyTicket(1) state = %s, want FAULT", buyResult.State)
		}
		if !strings.Contains(buyResult.Exception, "Ticket sale ended") {
			t.Fatalf("buyTicket(1) exception = %q, want to contain %q", buyResult.Exception, "Ticket sale ended")
		}

		postStateResult, err := client.InvokeFunctionWithSession(sessionID, false, deployResult.ContractHash, "getLotteryState", nil)
		if err != nil {
			t.Fatalf("getLotteryState() after failed buy: %v", err)
		}
		if postStateResult.State != "HALT" {
			t.Fatalf("getLotteryState() after failed buy state = %s, want HALT", postStateResult.State)
		}
		if len(postStateResult.Stack) == 0 {
			t.Fatal("getLotteryState() after failed buy returned empty stack")
		}

		postStateFields, err := chain.ParseArray(postStateResult.Stack[0])
		if err != nil {
			t.Fatalf("parse lottery state after failed buy: %v", err)
		}
		if len(postStateFields) != 3 {
			t.Fatalf("lottery state field count after failed buy = %d, want 3", len(postStateFields))
		}
		requireZeroInteger(t, postStateFields[1], "TotalTicketsSold after failed buy")
		requireZeroInteger(t, postStateFields[2], "TotalPrizePool after failed buy")
	})
}
