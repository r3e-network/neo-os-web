//go:build ignore

// Fix manifest event parameter names to be meaningful
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Manifest struct {
	Name               string         `json:"name"`
	ABI                ABI            `json:"abi"`
	Groups             []any          `json:"groups"`
	Features           map[string]any `json:"features"`
	SupportedStandards []string       `json:"supportedstandards"`
	Permissions        []any          `json:"permissions"`
	Trusts             []any          `json:"trusts"`
	Extra              map[string]any `json:"extra"`
}

type ABI struct {
	Methods []Method `json:"methods"`
	Events  []Event  `json:"events"`
}

type Method struct {
	Name       string      `json:"name"`
	Parameters []Parameter `json:"parameters"`
	ReturnType string      `json:"returntype"`
	Offset     int         `json:"offset"`
	Safe       bool        `json:"safe"`
}

type Event struct {
	Name       string      `json:"name"`
	Parameters []Parameter `json:"parameters"`
}

type Parameter struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// Event parameter mappings for each contract
var eventParams = map[string]map[string][]string{
	"ServiceLayerGateway": {
		"ServiceRequested": {"requestId", "appId", "serviceType", "requester", "callbackContract", "callbackMethod", "payload"},
		"ServiceFulfilled": {"requestId", "success", "result", "error"},
	},
	"PaymentHubV2": {
		"PaymentReceived": {"paymentId", "appId", "sender", "amount", "memo"},
		"AppConfigured":   {"appId", "owner"},
		"Withdrawn":       {"appId", "amount"},
	},
	"PriceFeed": {
		"PriceUpdated": {"symbol", "roundId", "price", "timestamp", "attestation", "sourceSetId"},
	},
	"RandomnessLog": {
		"RandomnessRecorded": {"requestId", "randomness", "attestation", "timestamp"},
	},
	"Governance": {
		"Staked":   {"account", "amount"},
		"Unstaked": {"account", "amount"},
		"Voted":    {"voter", "proposalId", "support", "weight"},
	},
	"AppRegistry": {
		"AppRegistered": {"appId", "owner"},
		"AppUpdated":    {"appId", "metadata"},
		"StatusChanged": {"appId", "status"},
	},
	"AutomationAnchor": {
		"TaskRegistered": {"taskId", "owner", "schedule"},
		"Executed":       {"taskId", "blockIndex", "result"},
	},
	"MiniAppServiceConsumer": {
		"OnServiceCallbackEvent": {"requestId", "appId", "serviceType", "success"},
	},
}

func main() {
	buildDir := "contracts/build"

	files, err := filepath.Glob(filepath.Join(buildDir, "*.manifest.json"))
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	for _, file := range files {
		processManifest(file)
	}

	fmt.Println("\n✅ All manifests updated!")
}

func processManifest(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Printf("❌ Read %s: %v\n", path, err)
		return
	}

	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		fmt.Printf("❌ Parse %s: %v\n", path, err)
		return
	}

	contractEvents, ok := eventParams[m.Name]
	if !ok {
		fmt.Printf("⏭️  %s: no event mappings defined\n", m.Name)
		return
	}

	updated := false
	for i, event := range m.ABI.Events {
		paramNames, ok := contractEvents[event.Name]
		if !ok {
			continue
		}

		if len(paramNames) != len(event.Parameters) {
			fmt.Printf("⚠️  %s.%s: param count mismatch (%d vs %d)\n",
				m.Name, event.Name, len(paramNames), len(event.Parameters))
			continue
		}

		for j := range event.Parameters {
			if m.ABI.Events[i].Parameters[j].Name != paramNames[j] {
				m.ABI.Events[i].Parameters[j].Name = paramNames[j]
				updated = true
			}
		}
	}

	if !updated {
		fmt.Printf("✓ %s: already up to date\n", m.Name)
		return
	}

	output, err := json.Marshal(m)
	if err != nil {
		fmt.Printf("❌ Marshal %s: %v\n", path, err)
		return
	}

	if err := os.WriteFile(path, output, 0644); err != nil {
		fmt.Printf("❌ Write %s: %v\n", path, err)
		return
	}

	fmt.Printf("✅ %s: updated event parameters\n", m.Name)
}
