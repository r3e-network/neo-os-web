package dta

import (
	"testing"
	"time"
)

func TestProductStatus(t *testing.T) {
	tests := []struct {
		status ProductStatus
		want   string
	}{
		{ProductStatusInactive, "inactive"},
		{ProductStatusActive, "active"},
		{ProductStatusSuspended, "suspended"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("ProductStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestOrderType(t *testing.T) {
	tests := []struct {
		orderType OrderType
		want      string
	}{
		{OrderTypeSubscription, "subscription"},
		{OrderTypeRedemption, "redemption"},
	}

	for _, tc := range tests {
		if string(tc.orderType) != tc.want {
			t.Errorf("OrderType = %q, want %q", tc.orderType, tc.want)
		}
	}
}

func TestOrderStatus(t *testing.T) {
	tests := []struct {
		status OrderStatus
		want   string
	}{
		{OrderStatusPending, "pending"},
		{OrderStatusApproved, "approved"},
		{OrderStatusSettled, "settled"},
		{OrderStatusRejected, "rejected"},
		{OrderStatusCanceled, "canceled"},
	}

	for _, tc := range tests {
		if string(tc.status) != tc.want {
			t.Errorf("OrderStatus = %q, want %q", tc.status, tc.want)
		}
	}
}

func TestProductFields(t *testing.T) {
	now := time.Now()
	product := Product{
		ID:              "prod-1",
		AccountID:       "acct-1",
		Name:            "Treasury Fund",
		Symbol:          "TFUND",
		Type:            "money_market",
		Status:          ProductStatusActive,
		SettlementTerms: "T+1",
		Metadata:        map[string]string{"issuer": "bank"},
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if product.ID != "prod-1" {
		t.Errorf("ID = %q, want 'prod-1'", product.ID)
	}
	if product.Symbol != "TFUND" {
		t.Errorf("Symbol = %q, want 'TFUND'", product.Symbol)
	}
	if product.Status != ProductStatusActive {
		t.Errorf("Status = %q, want 'active'", product.Status)
	}
}

func TestOrderFields(t *testing.T) {
	now := time.Now()
	order := Order{
		ID:        "order-1",
		AccountID: "acct-1",
		ProductID: "prod-1",
		Type:      OrderTypeSubscription,
		Amount:    "10000.00",
		Wallet:    "0xwallet",
		Status:    OrderStatusSettled,
		Metadata:  map[string]string{"source": "api"},
		CreatedAt: now,
		UpdatedAt: now,
	}

	if order.ID != "order-1" {
		t.Errorf("ID = %q, want 'order-1'", order.ID)
	}
	if order.Type != OrderTypeSubscription {
		t.Errorf("Type = %q, want 'subscription'", order.Type)
	}
	if order.Status != OrderStatusSettled {
		t.Errorf("Status = %q, want 'settled'", order.Status)
	}
}
