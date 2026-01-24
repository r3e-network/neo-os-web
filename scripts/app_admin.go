package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultPlatformURL = "http://localhost:8000"
	defaultAction      = "approve"
)

type ApprovalRequest struct {
	AppID  string `json:"app_id"`
	Action string `json:"action"`
	Reason string `json:"reason,omitempty"`
}

type ApprovalResponse struct {
	RequestID      string `json:"request_id"`
	AppID          string `json:"app_id"`
	Action         string `json:"action"`
	PreviousStatus string `json:"previous_status"`
	NewStatus      string `json:"new_status"`
	ReviewedBy     string `json:"reviewed_by"`
	ReviewedAt     string `json:"reviewed_at"`
	Reason         string `json:"reason,omitempty"`
	ChainTxID      string `json:"chainTxId,omitempty"`
}

func main() {
	// Get JWT token from environment
	jwtToken := os.Getenv("SUPABASE_JWT")
	if jwtToken == "" {
		fmt.Fprintln(os.Stderr, "Error: SUPABASE_JWT environment variable required")
		fmt.Fprintln(os.Stderr, "Usage: SUPABASE_JWT=your-jwt-token go run scripts/app_admin.go <app_id> [approve|reject|disable] [reason]")
		os.Exit(1)
	}

	// Parse command line arguments
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: SUPABASE_JWT=your-jwt-token go run scripts/app_admin.go <app_id> [approve|reject|disable] [reason]")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Arguments:")
		fmt.Fprintln(os.Stderr, "  app_id    - MiniApp ID to approve/reject")
		fmt.Fprintln(os.Stderr, "  action    - approve, reject, or disable (default: approve)")
		fmt.Fprintln(os.Stderr, "  reason    - Required for rejection, optional for others")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Examples:")
		fmt.Fprintln(os.Stderr, "  go run scripts/app_admin.go com.example.app")
		fmt.Fprintln(os.Stderr, "  go run scripts/app_admin.go com.example.app reject \"Contains malware\"")
		fmt.Fprintln(os.Stderr, "  go run scripts/app_admin.go com.example.app disable")
		os.Exit(1)
	}

	appID := strings.TrimSpace(os.Args[1])
	action := defaultAction
	reason := ""

	if len(os.Args) >= 3 {
		action = strings.ToLower(strings.TrimSpace(os.Args[2]))
	}

	if len(os.Args) >= 4 {
		reason = strings.Join(os.Args[3:], " ")
	}

	// Validate action
	if action != "approve" && action != "reject" && action != "disable" {
		fmt.Fprintf(os.Stderr, "Error: invalid action '%s'. Must be: approve, reject, or disable\n", action)
		os.Exit(1)
	}

	// Require reason for rejection
	if action == "reject" && reason == "" {
		fmt.Fprintln(os.Stderr, "Error: reason is required when rejecting an app")
		os.Exit(1)
	}

	// Get platform URL from environment or use default
	platformURL := os.Getenv("PLATFORM_URL")
	if platformURL == "" {
		platformURL = defaultPlatformURL
	}

	// Prepare request
	reqBody := ApprovalRequest{
		AppID:  appID,
		Action: action,
		Reason: reason,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to marshal request: %v\n", err)
		os.Exit(1)
	}

	// Send request
	url := fmt.Sprintf("%s/functions/v1/app-approve", strings.TrimSuffix(platformURL, "/"))
	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to create request: %v\n", err)
		os.Exit(1)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+jwtToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to send request: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to read response: %v\n", err)
		os.Exit(1)
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "Error: request failed with status %d\n", resp.StatusCode)
		fmt.Fprintln(os.Stderr, string(body))
		os.Exit(1)
	}

	// Parse response
	var result ApprovalResponse
	if err := json.Unmarshal(body, &result); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to parse response: %v\n", err)
		fmt.Fprintln(os.Stderr, string(body))
		os.Exit(1)
	}

	// Print success message
	fmt.Printf("✓ MiniApp '%s' %s\n", result.AppID, strings.ToUpper(result.NewStatus))
	fmt.Printf("  Previous status: %s\n", result.PreviousStatus)
	fmt.Printf("  New status: %s\n", result.NewStatus)
	fmt.Printf("  Reviewed by: %s\n", result.ReviewedBy)
	fmt.Printf("  Reviewed at: %s\n", result.ReviewedAt)
	if result.Reason != "" {
		fmt.Printf("  Reason: %s\n", result.Reason)
	}
	if result.ChainTxID != "" {
		fmt.Printf("  Chain TX: %s\n", result.ChainTxID)
	}
	fmt.Printf("  Request ID: %s\n", result.RequestID)
}
