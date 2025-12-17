// Package chain provides contract interaction for the Service Layer.
package chain

import (
	"fmt"
	"os"
	"strings"
)

// =============================================================================
// Contract Addresses (configurable)
// =============================================================================

// ContractAddresses holds the deployed contract addresses.
type ContractAddresses struct {
	// MiniApp platform contracts.
	PaymentHub       string `json:"paymenthub"`
	Governance       string `json:"governance"`
	PriceFeed        string `json:"pricefeed"`
	RandomnessLog    string `json:"randomnesslog"`
	AppRegistry      string `json:"appregistry"`
	AutomationAnchor string `json:"automationanchor"`
}

// LoadFromEnv loads contract addresses from environment variables.
func (c *ContractAddresses) LoadFromEnv() {
	// MiniApp platform contracts.
	if h := firstNonEmptyEnv("CONTRACT_PAYMENTHUB_HASH", "CONTRACT_PAYMENT_HUB_HASH"); h != "" {
		c.PaymentHub = h
	}
	if h := os.Getenv("CONTRACT_GOVERNANCE_HASH"); h != "" {
		c.Governance = h
	}
	if h := firstNonEmptyEnv("CONTRACT_PRICEFEED_HASH", "CONTRACT_PRICE_FEED_HASH"); h != "" {
		c.PriceFeed = h
	}
	if h := firstNonEmptyEnv("CONTRACT_RANDOMNESSLOG_HASH", "CONTRACT_RANDOMNESS_LOG_HASH"); h != "" {
		c.RandomnessLog = h
	}
	if h := firstNonEmptyEnv("CONTRACT_APPREGISTRY_HASH", "CONTRACT_APP_REGISTRY_HASH"); h != "" {
		c.AppRegistry = h
	}
	if h := firstNonEmptyEnv("CONTRACT_AUTOMATIONANCHOR_HASH", "CONTRACT_AUTOMATION_ANCHOR_HASH"); h != "" {
		c.AutomationAnchor = h
	}
}

// ContractAddressesFromEnv creates ContractAddresses from environment variables.
func ContractAddressesFromEnv() ContractAddresses {
	c := ContractAddresses{}
	c.LoadFromEnv()
	return c
}

// =============================================================================
// Common Invocation Result Checks
// =============================================================================

func isHaltState(state string) bool {
	return strings.HasPrefix(strings.TrimSpace(state), "HALT")
}

func requireHalt(method string, result *InvokeResult) error {
	if result == nil {
		return fmt.Errorf("%s: nil invoke result", method)
	}
	if isHaltState(result.State) {
		return nil
	}

	if msg := strings.TrimSpace(result.Exception); msg != "" {
		return fmt.Errorf("%s: execution failed (%s): %s", method, result.State, msg)
	}
	return fmt.Errorf("%s: execution failed (%s)", method, result.State)
}

func requireStack(method string, result *InvokeResult) error {
	if result == nil {
		return fmt.Errorf("%s: nil invoke result", method)
	}
	if len(result.Stack) == 0 {
		return fmt.Errorf("%s: no result", method)
	}
	return nil
}

func firstStackItem(method string, result *InvokeResult) (StackItem, error) {
	if err := requireStack(method, result); err != nil {
		return StackItem{}, err
	}
	return result.Stack[0], nil
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}
