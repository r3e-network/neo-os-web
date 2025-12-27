package chain

import "fmt"

// AppRegistryEvent represents a lifecycle event from AppRegistry.
type AppRegistryEvent struct {
	AppID        string
	Developer    string
	ManifestHash []byte
	Status       int
}

// ParseAppRegistryEvent parses AppRegistry events:
// - AppRegistered(appId, developer)
// - AppUpdated(appId, manifestHash)
// - StatusChanged(appId, status)
func ParseAppRegistryEvent(event *ContractEvent) (*AppRegistryEvent, error) {
	if event == nil {
		return nil, fmt.Errorf("nil event")
	}
	switch event.EventName {
	case "AppRegistered":
		if len(event.State) < 2 {
			return nil, fmt.Errorf("invalid AppRegistered state: expected 2 items, got %d", len(event.State))
		}
		appID, err := ParseStringFromItem(event.State[0])
		if err != nil {
			return nil, fmt.Errorf("parse appId: %w", err)
		}
		developer, err := ParseHash160(event.State[1])
		if err != nil {
			return nil, fmt.Errorf("parse developer: %w", err)
		}
		return &AppRegistryEvent{
			AppID:     appID,
			Developer: developer,
		}, nil
	case "AppUpdated":
		if len(event.State) < 2 {
			return nil, fmt.Errorf("invalid AppUpdated state: expected 2 items, got %d", len(event.State))
		}
		appID, err := ParseStringFromItem(event.State[0])
		if err != nil {
			return nil, fmt.Errorf("parse appId: %w", err)
		}
		manifestHash, err := ParseByteArray(event.State[1])
		if err != nil {
			return nil, fmt.Errorf("parse manifestHash: %w", err)
		}
		return &AppRegistryEvent{
			AppID:        appID,
			ManifestHash: manifestHash,
		}, nil
	case "StatusChanged":
		if len(event.State) < 2 {
			return nil, fmt.Errorf("invalid StatusChanged state: expected 2 items, got %d", len(event.State))
		}
		appID, err := ParseStringFromItem(event.State[0])
		if err != nil {
			return nil, fmt.Errorf("parse appId: %w", err)
		}
		statusValue, err := ParseInteger(event.State[1])
		if err != nil {
			return nil, fmt.Errorf("parse status: %w", err)
		}
		return &AppRegistryEvent{
			AppID:  appID,
			Status: int(statusValue.Int64()),
		}, nil
	default:
		return nil, fmt.Errorf("not an AppRegistry event")
	}
}
