package chain

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func newResponse(payload []byte) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader(payload)),
	}
}

func TestNewClient(t *testing.T) {
	tests := []struct {
		name    string
		cfg     Config
		wantErr bool
	}{
		{
			name:    "valid config",
			cfg:     Config{RPCURL: "http://localhost:10332"},
			wantErr: false,
		},
		{
			name:    "missing URL",
			cfg:     Config{},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewClient(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewClient() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestClientCall(t *testing.T) {
	client, err := NewClient(Config{RPCURL: "http://example"})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		var req RPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
		}

		switch req.Method {
		case "getblockcount":
			resp.Result = json.RawMessage(`12345`)
		case "invokefunction":
			resp.Result = json.RawMessage(`{"state":"HALT","gasconsumed":"0.1","stack":[{"type":"Integer","value":"100"}]}`)
		default:
			resp.Error = &RPCError{Code: -1, Message: "unknown method"}
		}

		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	ctx := context.Background()

	// Test getblockcount
	result, err := client.Call(ctx, "getblockcount", nil)
	if err != nil {
		t.Errorf("Call(getblockcount) error = %v", err)
	}

	var count int
	json.Unmarshal(result, &count)
	if count != 12345 {
		t.Errorf("Expected block count 12345, got %d", count)
	}
}

func TestGetBlockCount(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		resp := RPCResponse{JSONRPC: "2.0", ID: 1, Result: json.RawMessage(`12345`)}
		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})
	ctx := context.Background()

	count, err := client.GetBlockCount(ctx)
	if err != nil {
		t.Errorf("GetBlockCount() error = %v", err)
	}
	if count != 12345 {
		t.Errorf("Expected 12345, got %d", count)
	}
}

func TestInvokeFunction(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      1,
			Result: json.RawMessage(`{
				"script": "test",
				"state": "HALT",
				"gasconsumed": "0.1234",
				"stack": [{"type": "Integer", "value": "42"}]
			}`),
		}
		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})
	ctx := context.Background()

	result, err := client.InvokeFunction(ctx, "0x1234", "test", nil)
	if err != nil {
		t.Errorf("InvokeFunction() error = %v", err)
	}
	if result.State != "HALT" {
		t.Errorf("Expected HALT state, got %s", result.State)
	}
	if len(result.Stack) != 1 {
		t.Errorf("Expected 1 stack item, got %d", len(result.Stack))
	}
}

func TestContractParams(t *testing.T) {
	// Test string param
	strParam := NewStringParam("hello")
	if strParam.Type != "String" || strParam.Value != "hello" {
		t.Errorf("NewStringParam failed")
	}

	// Test integer param
	intParam := NewIntegerParam(big.NewInt(42))
	if intParam.Type != "Integer" || intParam.Value != "42" {
		t.Errorf("NewIntegerParam failed")
	}

	// Test bool param
	boolParam := NewBoolParam(true)
	if boolParam.Type != "Boolean" || boolParam.Value != true {
		t.Errorf("NewBoolParam failed")
	}

	// Test byte array param
	byteParam := NewByteArrayParam([]byte{0x01, 0x02, 0x03})
	if byteParam.Type != "ByteArray" || byteParam.Value != "AQID" {
		t.Errorf("NewByteArrayParam failed")
	}

	// Test hash160 param
	hashParam := NewHash160Param("0x1234567890abcdef1234567890abcdef12345678")
	if hashParam.Type != "Hash160" {
		t.Errorf("NewHash160Param failed")
	}

	// Test any param
	anyParam := NewAnyParam()
	if anyParam.Type != "Any" || anyParam.Value != nil {
		t.Errorf("NewAnyParam failed")
	}
}

func TestRPCError(t *testing.T) {
	err := &RPCError{
		Code:    -100,
		Message: "test error",
	}

	expected := "RPC error -100: test error"
	if err.Error() != expected {
		t.Errorf("Expected %q, got %q", expected, err.Error())
	}
}

func TestParseInteger(t *testing.T) {
	item := StackItem{
		Type:  "Integer",
		Value: json.RawMessage(`"12345"`),
	}

	result, err := ParseInteger(item)
	if err != nil {
		t.Errorf("ParseInteger() error = %v", err)
	}
	if result.Cmp(big.NewInt(12345)) != 0 {
		t.Errorf("Expected 12345, got %s", result.String())
	}
}

func TestParseBoolean(t *testing.T) {
	item := StackItem{
		Type:  "Boolean",
		Value: json.RawMessage(`true`),
	}

	result, err := ParseBoolean(item)
	if err != nil {
		t.Errorf("ParseBoolean() error = %v", err)
	}
	if !result {
		t.Errorf("Expected true, got false")
	}
}

func TestParseByteArray(t *testing.T) {
	item := StackItem{
		Type:  "ByteString",
		Value: json.RawMessage(`"48656c6c6f"`), // "Hello" in hex
	}

	result, err := ParseByteArray(item)
	if err != nil {
		t.Errorf("ParseByteArray() error = %v", err)
	}
	if string(result) != "Hello" {
		t.Errorf("Expected 'Hello', got %q", string(result))
	}
}

func TestSendRawTransactionAndWait(t *testing.T) {
	callCount := 0

	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		var req RPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		callCount++

		resp := RPCResponse{JSONRPC: "2.0", ID: req.ID}
		switch req.Method {
		case "sendrawtransaction":
			resp.Result = json.RawMessage(`{"hash":"0xabc"}`)
		case "getapplicationlog":
			if callCount < 3 {
				resp.Error = &RPCError{Code: -100, Message: "Unknown transaction"}
				break
			}
			log := ApplicationLog{TxID: "0xabc", Executions: []Execution{{VMState: "HALT"}}}
			raw, _ := json.Marshal(log)
			resp.Result = raw
		default:
			resp.Error = &RPCError{Code: -1, Message: "unknown"}
		}

		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	ctx := context.Background()
	log, err := client.SendRawTransactionAndWait(ctx, "deadbeef", time.Millisecond*10, time.Second)
	if err != nil {
		t.Fatalf("SendRawTransactionAndWait error: %v", err)
	}
	if log.TxID != "0xabc" || len(log.Executions) != 1 || log.Executions[0].VMState != "HALT" {
		t.Fatalf("unexpected log %+v", log)
	}
}

func TestWaitForApplicationLogTimeout(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		var req RPCRequest
		_ = json.NewDecoder(r.Body).Decode(&req)

		resp := RPCResponse{JSONRPC: "2.0", ID: req.ID}
		if req.Method == "getapplicationlog" {
			resp.Error = &RPCError{Code: -100, Message: "Unknown transaction"}
		} else {
			resp.Result = json.RawMessage(`{"hash":"0xabc"}`)
		}

		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	wctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*50)
	defer cancel()
	_, err := client.WaitForApplicationLog(wctx, "0xabc", time.Millisecond*10)
	if err == nil || !strings.Contains(err.Error(), "deadline exceeded") {
		t.Fatalf("expected timeout error, got %v", err)
	}
}

func TestParseByteArrayNull(t *testing.T) {
	item := StackItem{
		Type:  "Null",
		Value: nil,
	}

	result, err := ParseByteArray(item)
	if err != nil {
		t.Errorf("ParseByteArray() error = %v", err)
	}
	if result != nil {
		t.Errorf("Expected nil, got %v", result)
	}
}

func TestClientNetworkID(t *testing.T) {
	client, err := NewClient(Config{
		RPCURL:    "http://localhost:10332",
		NetworkID: 860833102,
	})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	if got := client.NetworkID(); got != 860833102 {
		t.Errorf("NetworkID() = %d, want %d", got, 860833102)
	}

	// Test nil client
	var nilClient *Client
	if got := nilClient.NetworkID(); got != 0 {
		t.Errorf("nil.NetworkID() = %d, want 0", got)
	}
}

func TestClientCloneWithRPCURL(t *testing.T) {
	client, err := NewClient(Config{
		RPCURL:    "http://localhost:10332",
		NetworkID: 860833102,
		Timeout:   30 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	t.Run("valid clone", func(t *testing.T) {
		clone, err := client.CloneWithRPCURL("http://localhost:20332")
		if err != nil {
			t.Fatalf("CloneWithRPCURL() error = %v", err)
		}
		if clone.NetworkID() != client.NetworkID() {
			t.Error("clone should preserve NetworkID")
		}
	})

	t.Run("nil client", func(t *testing.T) {
		var nilClient *Client
		_, err := nilClient.CloneWithRPCURL("http://localhost:20332")
		if err == nil {
			t.Error("expected error for nil client")
		}
	})
}

func TestGetBlock(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      1,
			Result: json.RawMessage(`{
				"hash": "0x1234",
				"index": 100,
				"time": 1234567890
			}`),
		}
		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	block, err := client.GetBlock(context.Background(), 100)
	if err != nil {
		t.Fatalf("GetBlock() error = %v", err)
	}
	if block == nil {
		t.Error("GetBlock() returned nil")
	}
}

func TestGetTransaction(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      1,
			Result: json.RawMessage(`{
				"hash": "0xabc123",
				"blockhash": "0xdef456",
				"blocktime": 1234567890
			}`),
		}
		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	tx, err := client.GetTransaction(context.Background(), "0xabc123")
	if err != nil {
		t.Fatalf("GetTransaction() error = %v", err)
	}
	if tx == nil {
		t.Error("GetTransaction() returned nil")
	}
}

func TestGetApplicationLog(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      1,
			Result: json.RawMessage(`{
				"txid": "0xabc123",
				"executions": [{"vmstate": "HALT"}]
			}`),
		}
		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	log, err := client.GetApplicationLog(context.Background(), "0xabc123")
	if err != nil {
		t.Fatalf("GetApplicationLog() error = %v", err)
	}
	if log == nil {
		t.Error("GetApplicationLog() returned nil")
	}
}

func TestClientCallHTTPError(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusInternalServerError,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader("internal error")),
		}, nil
	})

	_, err := client.Call(context.Background(), "getblockcount", nil)
	if err == nil {
		t.Error("expected error for HTTP error response")
	}
}

func TestClientCallRPCError(t *testing.T) {
	client, _ := NewClient(Config{RPCURL: "http://example"})
	client.httpClient.Transport = roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		resp := RPCResponse{
			JSONRPC: "2.0",
			ID:      1,
			Error:   &RPCError{Code: -100, Message: "Unknown transaction"},
		}
		payload, _ := json.Marshal(resp)
		return newResponse(payload), nil
	})

	_, err := client.Call(context.Background(), "getrawtransaction", []interface{}{"invalid"})
	if err == nil {
		t.Error("expected error for RPC error response")
	}
}

func TestNewClientWithCustomHTTPClient(t *testing.T) {
	customClient := &http.Client{Timeout: 60 * time.Second}
	client, err := NewClient(Config{
		RPCURL:     "http://localhost:10332",
		HTTPClient: customClient,
	})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	if client == nil {
		t.Error("NewClient() returned nil")
	}
}

func TestNewClientWithTimeout(t *testing.T) {
	client, err := NewClient(Config{
		RPCURL:  "http://localhost:10332",
		Timeout: 120 * time.Second,
	})
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	if client == nil {
		t.Error("NewClient() returned nil")
	}
}
