package chain

import (
	"fmt"

	"github.com/R3E-Network/service_layer/infrastructure/crypto"
)

// PaymentReceivedEvent represents a PaymentHub payment event.
// Event: PaymentReceived(paymentId, appId, sender, amount, memo)
type PaymentReceivedEvent struct {
	PaymentID     string
	AppID         string
	SenderAddress string
	Amount        string
	Memo          string
}

func ParsePaymentReceivedEvent(event *ContractEvent) (*PaymentReceivedEvent, error) {
	if event.EventName != "PaymentReceived" {
		return nil, fmt.Errorf("not a PaymentReceived event")
	}
	if len(event.State) < 5 {
		return nil, fmt.Errorf("invalid event state: expected at least 5 items, got %d", len(event.State))
	}

	paymentID, err := ParseInteger(event.State[0])
	if err != nil {
		return nil, fmt.Errorf("parse paymentId: %w", err)
	}

	appID, err := ParseStringFromItem(event.State[1])
	if err != nil {
		return nil, fmt.Errorf("parse appId: %w", err)
	}

	senderBytes, err := ParseByteArray(event.State[2])
	if err != nil {
		return nil, fmt.Errorf("parse sender: %w", err)
	}
	if len(senderBytes) != 20 {
		return nil, fmt.Errorf("invalid sender length: %d", len(senderBytes))
	}
	senderAddress := crypto.ScriptHashToAddress(senderBytes)

	amount, err := ParseInteger(event.State[3])
	if err != nil {
		return nil, fmt.Errorf("parse amount: %w", err)
	}

	memo, err := ParseStringFromItem(event.State[4])
	if err != nil {
		memo = ""
	}

	return &PaymentReceivedEvent{
		PaymentID:     paymentID.String(),
		AppID:         appID,
		SenderAddress: senderAddress,
		Amount:        amount.String(),
		Memo:          memo,
	}, nil
}
