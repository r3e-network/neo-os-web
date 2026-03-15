package chain

import (
	"fmt"
	"math/big"
)

// MiniAppMetricEvent represents a metric emitted by a MiniApp contract.
// Event: Platform_Metric(appId, metricName, value)
// Legacy event name: Metric
type MiniAppMetricEvent struct {
	AppID      string
	MetricName string
	Value      *big.Int
}

func ParseMiniAppMetricEvent(event *ContractEvent) (*MiniAppMetricEvent, error) {
	if event.EventName != "Platform_Metric" && event.EventName != "Metric" {
		return nil, fmt.Errorf("not a Platform_Metric event")
	}
	if len(event.State) < 2 {
		return nil, fmt.Errorf("invalid event state: expected at least 2 items, got %d", len(event.State))
	}

	if len(event.State) == 2 {
		metricName, err := ParseStringFromItem(event.State[0])
		if err != nil {
			return nil, fmt.Errorf("parse metricName: %w", err)
		}

		value, err := ParseInteger(event.State[1])
		if err != nil {
			return nil, fmt.Errorf("parse value: %w", err)
		}

		return &MiniAppMetricEvent{
			AppID:      "",
			MetricName: metricName,
			Value:      value,
		}, nil
	}

	appID, err := ParseStringFromItem(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse appId: %w", err)
	}

	metricName, err := ParseStringFromItem(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse metricName: %w", err)
	}

	value, err := ParseInteger(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse value: %w", err)
	}

	return &MiniAppMetricEvent{
		AppID:      appID,
		MetricName: metricName,
		Value:      value,
	}, nil
}
