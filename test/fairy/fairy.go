// Package fairy provides a Go client for Neo Fairy RPC.
package fairy

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nspcc-dev/neo-go/pkg/crypto/keys"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

const (
	DefaultRPCURL  = "http://127.0.0.1:16868"
	DefaultTimeout = 30 * time.Second
)

// Client is a Neo Fairy RPC client.
type Client struct {
	url    string
	client *http.Client
}

type contractParameter struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value,omitempty"`
}

// NewClient creates a new Fairy client.
func NewClient(url string) *Client {
	if url == "" {
		url = DefaultRPCURL
	}
	return &Client{
		url: url,
		client: &http.Client{
			Timeout: DefaultTimeout,
		},
	}
}

// RPC types (RPCRequest, RPCResponse, RPCError) imported from infrastructure/chain package

func (c *Client) call(method string, params ...interface{}) (*chain.RPCResponse, error) {
	if params == nil {
		params = []interface{}{}
	}
	req := chain.RPCRequest{
		JSONRPC: "2.0",
		Method:  method,
		Params:  params,
		ID:      1,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, c.url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		statusErr, readErr := httputil.BuildHTTPStatusErrorFromRequest(resp, httpReq, 32<<10)
		httpErr := &chain.RPCHTTPError{
			HTTPStatusError: statusErr,
		}
		if readErr != nil {
			return nil, httputil.WrapReadBodyError(httpErr, readErr)
		}
		return nil, httpErr
	}

	respBody, err := httputil.ReadAllStrict(resp.Body, 8<<20)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var rpcResp chain.RPCResponse
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return &rpcResp, nil
}

func normalizeHash160(value string) (string, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", false
	}
	if strings.HasPrefix(trimmed, "0x") || strings.HasPrefix(trimmed, "0X") {
		trimmed = trimmed[2:]
	}
	if len(trimmed) != 40 {
		return "", false
	}
	for _, ch := range trimmed {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F') {
			continue
		}
		return "", false
	}
	return strings.ToLower(trimmed), true
}

func encodeContractArgument(arg interface{}) interface{} {
	switch value := arg.(type) {
	case nil:
		return contractParameter{Type: "Any"}
	case contractParameter:
		return value
	case map[string]interface{}:
		if _, ok := value["type"]; ok {
			return value
		}
		return value
	case bool:
		return contractParameter{Type: "Boolean", Value: value}
	case string:
		if hash160, ok := normalizeHash160(value); ok {
			return contractParameter{Type: "Hash160", Value: hash160}
		}
		return contractParameter{Type: "String", Value: value}
	case []byte:
		return contractParameter{Type: "ByteArray", Value: base64.StdEncoding.EncodeToString(value)}
	case int:
		return contractParameter{Type: "Integer", Value: strconv.FormatInt(int64(value), 10)}
	case int8:
		return contractParameter{Type: "Integer", Value: strconv.FormatInt(int64(value), 10)}
	case int16:
		return contractParameter{Type: "Integer", Value: strconv.FormatInt(int64(value), 10)}
	case int32:
		return contractParameter{Type: "Integer", Value: strconv.FormatInt(int64(value), 10)}
	case int64:
		return contractParameter{Type: "Integer", Value: strconv.FormatInt(value, 10)}
	case uint:
		return contractParameter{Type: "Integer", Value: strconv.FormatUint(uint64(value), 10)}
	case uint8:
		return contractParameter{Type: "Integer", Value: strconv.FormatUint(uint64(value), 10)}
	case uint16:
		return contractParameter{Type: "Integer", Value: strconv.FormatUint(uint64(value), 10)}
	case uint32:
		return contractParameter{Type: "Integer", Value: strconv.FormatUint(uint64(value), 10)}
	case uint64:
		return contractParameter{Type: "Integer", Value: strconv.FormatUint(value, 10)}
	case []interface{}:
		encoded := make([]interface{}, len(value))
		for i := range value {
			encoded[i] = encodeContractArgument(value[i])
		}
		return contractParameter{Type: "Array", Value: encoded}
	default:
		return value
	}
}

func encodeContractArguments(args []interface{}) []interface{} {
	if args == nil {
		return []interface{}{}
	}
	encoded := make([]interface{}, len(args))
	for i := range args {
		encoded[i] = encodeContractArgument(args[i])
	}
	return encoded
}

// HelloFairy tests connectivity to Fairy.
func (c *Client) HelloFairy() (map[string]interface{}, error) {
	resp, err := c.call("hellofairy") // lowercase required
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// NewSession creates a new testing session.
func (c *Client) NewSession() (string, error) {
	sessionID := fmt.Sprintf("test-%d", time.Now().UnixNano())
	resp, err := c.call("newsnapshotsfromcurrentsystem", sessionID) // creates session
	if err != nil {
		return "", err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return "", err
	}
	return sessionID, nil
}

func resolveSessionWIF() (string, error) {
	if wif := strings.TrimSpace(os.Getenv("NEO_TESTNET_WIF")); wif != "" {
		return wif, nil
	}

	privateKey, err := keys.NewPrivateKey()
	if err != nil {
		return "", fmt.Errorf("generate fairy session key: %w", err)
	}
	return privateKey.WIF(), nil
}

// SetupSessionWithGas creates a session, assigns a wallet, and funds it with GAS.
// If `NEO_TESTNET_WIF` is set it is reused, otherwise an ephemeral key is generated.
func (c *Client) SetupSessionWithGas(gasAmount int64) (sessionID, accountHash string, err error) {
	sessionID = fmt.Sprintf("test-%d", time.Now().UnixNano())

	// Create session.
	_, err = c.call("newsnapshotsfromcurrentsystem", sessionID)
	if err != nil {
		return "", "", fmt.Errorf("create session: %w", err)
	}

	wif, err := resolveSessionWIF()
	if err != nil {
		return "", "", err
	}

	// Set session wallet.
	resp, err := c.call("setsessionfairywalletwithwif", sessionID, wif)
	if err != nil {
		return "", "", fmt.Errorf("set wallet: %w", err)
	}

	var walletInfo map[string]interface{}
	if unmarshalErr := json.Unmarshal(resp.Result, &walletInfo); unmarshalErr != nil {
		return "", "", fmt.Errorf("parse wallet info: %w", unmarshalErr)
	}

	for _, value := range walletInfo {
		address, ok := value.(string)
		if ok && strings.TrimSpace(address) != "" {
			accountHash = address
			break
		}
	}
	if accountHash == "" {
		return "", "", fmt.Errorf("could not get account hash from wallet")
	}

	_, err = c.call("setgasbalance", sessionID, accountHash, fmt.Sprintf("%d", gasAmount))
	if err != nil {
		return "", "", fmt.Errorf("set gas balance: %w", err)
	}

	return sessionID, accountHash, nil
}

// FundTEEAccount funds a TEE account with GAS in the session.
// teeAccount is the script hash of the TEE account.
func (c *Client) FundTEEAccount(sessionID, teeAccountHash string, gasAmount int64) error {
	_, err := c.call("setgasbalance", sessionID, teeAccountHash, fmt.Sprintf("%d", gasAmount))
	return err
}

// DeleteSession deletes a session.
func (c *Client) DeleteSession(sessionID string) error {
	_, err := c.call("deletesnapshots", sessionID)
	return err
}

// VirtualDeployResult represents the result of VirtualDeploy.
type VirtualDeployResult struct {
	ContractHash string `json:"contracthash"`
	GasConsumed  string `json:"gasconsumed"`
	State        string `json:"state"`
}

// VirtualDeploy deploys a contract virtually in a session.
func (c *Client) VirtualDeploy(sessionID, nefPath, manifestPath string) (*VirtualDeployResult, error) {
	nefData, err := os.ReadFile(nefPath)
	if err != nil {
		return nil, fmt.Errorf("read nef: %w", err)
	}
	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}

	nefBase64 := base64.StdEncoding.EncodeToString(nefData)

	// VirtualDeploy params: session, nefBase64, manifestJSON, signers(empty array)
	resp, err := c.call("virtualdeploy", sessionID, nefBase64, string(manifestData), []interface{}{})
	if err != nil {
		return nil, err
	}

	var result VirtualDeployResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, err
	}
	// Contract hash is in the session field
	var rawResult map[string]interface{}
	if err := json.Unmarshal(resp.Result, &rawResult); err != nil {
		return nil, err
	}
	if hash, ok := rawResult[sessionID].(string); ok {
		result.ContractHash = hash
	}
	return &result, nil
}

// InvokeResult and StackItem imported from infrastructure/chain package

// InvokeFunctionWithSession invokes a contract method in a session.
func (c *Client) InvokeFunctionWithSession(sessionID string, writeSnapshot bool, contractHash, method string, args []interface{}) (*chain.InvokeResult, error) {
	params := []interface{}{
		sessionID,
		writeSnapshot,
		contractHash,
		method,
		encodeContractArguments(args),
	}

	resp, err := c.call("invokefunctionwithsession", params...) // lowercase required
	if err != nil {
		return nil, err
	}

	var result chain.InvokeResult
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// SetTime sets the virtual time for a session.
func (c *Client) SetTime(sessionID string, timestamp uint64) error {
	_, err := c.call("settime", sessionID, timestamp) // lowercase required
	return err
}

// SetGasBalance sets GAS balance for an account in a session.
func (c *Client) SetGasBalance(sessionID, account string, balance int64) error {
	_, err := c.call("setgasbalance", sessionID, account, balance) // lowercase required
	return err
}

// IsAvailable checks if Fairy is available.
func (c *Client) IsAvailable() bool {
	_, err := c.HelloFairy()
	return err == nil
}
