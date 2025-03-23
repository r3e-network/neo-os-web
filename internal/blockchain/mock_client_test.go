package blockchain

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMockClient(t *testing.T) {
	// Create a mock client with nil logger for testing
	client := NewMockClient(nil)

	// Set a test block height
	testHeight := uint32(12345)
	client.SetBlockHeight(testHeight)

	// Test GetBlockHeight
	height, err := client.GetBlockHeight()
	assert.NoError(t, err)
	assert.Equal(t, testHeight, height)

	// Test GetBlock
	_, err = client.GetBlock(testHeight)
	assert.Error(t, err) // Should error since no block is set

	// Set a mock transaction
	txHash := "0x1234567890abcdef"
	txData := []byte("mock_tx_data")
	client.SetTransaction(txHash, txData)

	// Test GetTransaction
	tx, err := client.GetTransaction(txHash)
	assert.NoError(t, err)
	assert.Equal(t, txData, tx)

	// Test InvokeContract
	client.SetContractCallResult("0xContractHash", "testMethod", "success")
	result, err := client.InvokeContract("0xContractHash", "testMethod", nil)
	assert.NoError(t, err)
	assert.Equal(t, "success", result["value"])

	// Test SendTransaction
	hash, err := client.SendTransaction(nil)
	assert.NoError(t, err)
	assert.Contains(t, hash, "0x")

	// Test SubscribeToEvents and EmitEvent
	ctx := context.Background()
	var receivedEvent interface{}
	err = client.SubscribeToEvents(ctx, "0xContract", "TestEvent", func(event interface{}) {
		receivedEvent = event
	})
	assert.NoError(t, err)

	// Emit an event
	testEventData := map[string]string{"test": "data"}
	client.EmitEvent("0xContract", "TestEvent", testEventData)

	// Check that our handler received the event
	if mockEvent, ok := receivedEvent.(mockEvent); ok {
		assert.Equal(t, "0xContract", mockEvent.ContractHash)
		assert.Equal(t, "TestEvent", mockEvent.EventName)
		assert.Equal(t, testEventData, mockEvent.Data)
	} else {
		t.Errorf("Received event is not a mockEvent: %v", receivedEvent)
	}

	// Test GetTransactionReceipt
	receipt, err := client.GetTransactionReceipt(ctx, txHash)
	assert.NoError(t, err)
	assert.NotNil(t, receipt)

	// Test health check
	err = client.CheckHealth(ctx)
	assert.NoError(t, err)

	// Test closing the client
	err = client.Close()
	assert.NoError(t, err)
}
