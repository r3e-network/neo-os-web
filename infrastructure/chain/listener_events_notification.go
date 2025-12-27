package chain

import "fmt"

// MiniAppNotificationEvent represents a notification from a MiniApp contract.
// Event: Platform_Notification(appId, title, content, notificationType, priority)
// Legacy event name: Notification
type MiniAppNotificationEvent struct {
	AppID            string
	Title            string
	Content          string
	NotificationType string
	Priority         int
}

func ParseMiniAppNotificationEvent(event *ContractEvent) (*MiniAppNotificationEvent, error) {
	if event.EventName != "Platform_Notification" && event.EventName != "Notification" {
		return nil, fmt.Errorf("not a Platform_Notification event")
	}
	if len(event.State) < 3 {
		return nil, fmt.Errorf("invalid event state: expected at least 3 items, got %d", len(event.State))
	}

	if len(event.State) == 3 {
		notificationType, err := ParseStringFromItem(event.State[0])
		if err != nil {
			return nil, fmt.Errorf("parse notificationType: %w", err)
		}

		title, err := ParseStringFromItem(event.State[1])
		if err != nil {
			return nil, fmt.Errorf("parse title: %w", err)
		}

		content, err := ParseStringFromItem(event.State[2])
		if err != nil {
			return nil, fmt.Errorf("parse content: %w", err)
		}

		return &MiniAppNotificationEvent{
			AppID:            "",
			Title:            title,
			Content:          content,
			NotificationType: notificationType,
			Priority:         0,
		}, nil
	}

	appID, err := ParseStringFromItem(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse appId: %w", err)
	}

	title, err := ParseStringFromItem(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse title: %w", err)
	}

	content, err := ParseStringFromItem(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse content: %w", err)
	}

	notifType, err := ParseStringFromItem(event.State[3])
	if err != nil {
		notifType = "Announcement"
	}

	priority := 0
	if len(event.State) >= 5 {
		if p, err := ParseInteger(event.State[4]); err == nil {
			priority = int(p.Int64())
		}
	}

	return &MiniAppNotificationEvent{
		AppID:            appID,
		Title:            title,
		Content:          content,
		NotificationType: notifType,
		Priority:         priority,
	}, nil
}
