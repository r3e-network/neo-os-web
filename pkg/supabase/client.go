// Package supabase provides a unified Supabase client for the Service Layer.
// This client wraps all Supabase services: Auth (GoTrue), Storage, PostgREST, and Realtime.
package supabase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Config holds Supabase connection configuration.
type Config struct {
	// ProjectURL is the Supabase project URL (e.g., http://localhost:8000 for self-hosted)
	ProjectURL string

	// AnonKey is the public anon key for client-side operations
	AnonKey string

	// ServiceRoleKey is the service role key for server-side operations (bypasses RLS)
	ServiceRoleKey string

	// JWTSecret is the JWT secret for token validation
	JWTSecret string

	// GoTrueURL is the direct GoTrue URL (optional, defaults to ProjectURL/auth/v1)
	GoTrueURL string

	// StorageURL is the direct Storage URL (optional, defaults to ProjectURL/storage/v1)
	StorageURL string

	// RealtimeURL is the direct Realtime URL (optional, defaults to ProjectURL/realtime/v1)
	RealtimeURL string
}

// Client is the unified Supabase client.
type Client struct {
	cfg        Config
	httpClient *http.Client
	mu         sync.RWMutex

	// Service endpoints
	authURL     string
	storageURL  string
	restURL     string
	realtimeURL string
}

// New creates a new Supabase client.
func New(cfg Config) (*Client, error) {
	if cfg.ProjectURL == "" {
		return nil, errors.New("supabase: project URL required")
	}

	projectURL := strings.TrimRight(cfg.ProjectURL, "/")

	c := &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		authURL:     cfg.GoTrueURL,
		storageURL:  cfg.StorageURL,
		restURL:     projectURL + "/rest/v1",
		realtimeURL: cfg.RealtimeURL,
	}

	// Set defaults for service URLs
	if c.authURL == "" {
		c.authURL = projectURL + "/auth/v1"
	}
	if c.storageURL == "" {
		c.storageURL = projectURL + "/storage/v1"
	}
	if c.realtimeURL == "" {
		c.realtimeURL = strings.Replace(projectURL, "http", "ws", 1) + "/realtime/v1"
	}

	return c, nil
}

// ============================================================================
// Auth (GoTrue) Methods
// ============================================================================

// AuthResponse represents a GoTrue authentication response.
type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	ExpiresAt    int64  `json:"expires_at"`
	User         *User  `json:"user"`
}

// User represents a Supabase user.
type User struct {
	ID               string                 `json:"id"`
	Email            string                 `json:"email"`
	Phone            string                 `json:"phone"`
	Role             string                 `json:"role"`
	AppMetadata      map[string]interface{} `json:"app_metadata"`
	UserMetadata     map[string]interface{} `json:"user_metadata"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	EmailConfirmedAt *time.Time             `json:"email_confirmed_at"`
}

// SignUp creates a new user with email and password.
func (c *Client) SignUp(ctx context.Context, email, password string, metadata map[string]interface{}) (*AuthResponse, error) {
	payload := map[string]interface{}{
		"email":    email,
		"password": password,
	}
	if metadata != nil {
		payload["data"] = metadata
	}

	return c.authRequest(ctx, "POST", "/signup", payload, false)
}

// SignIn authenticates a user with email and password.
func (c *Client) SignIn(ctx context.Context, email, password string) (*AuthResponse, error) {
	payload := map[string]interface{}{
		"email":    email,
		"password": password,
	}

	return c.authRequest(ctx, "POST", "/token?grant_type=password", payload, false)
}

// RefreshToken exchanges a refresh token for a new access token.
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	payload := map[string]interface{}{
		"refresh_token": refreshToken,
	}

	return c.authRequest(ctx, "POST", "/token?grant_type=refresh_token", payload, false)
}

// GetUser retrieves the current user from an access token.
func (c *Client) GetUser(ctx context.Context, accessToken string) (*User, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.authURL+"/user", nil)
	if err != nil {
		return nil, err
	}
	c.setAuthHeaders(req, accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.parseError(resp)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

// SignOut invalidates the user's session.
func (c *Client) SignOut(ctx context.Context, accessToken string) error {
	req, err := http.NewRequestWithContext(ctx, "POST", c.authURL+"/logout", nil)
	if err != nil {
		return err
	}
	c.setAuthHeaders(req, accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		return c.parseError(resp)
	}
	return nil
}

// InviteUser sends an invite to a user (admin only).
func (c *Client) InviteUser(ctx context.Context, email string, metadata map[string]interface{}) (*User, error) {
	payload := map[string]interface{}{
		"email": email,
	}
	if metadata != nil {
		payload["data"] = metadata
	}

	req, err := c.newJSONRequest(ctx, "POST", c.authURL+"/invite", payload)
	if err != nil {
		return nil, err
	}
	c.setServiceRoleHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.parseError(resp)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (c *Client) authRequest(ctx context.Context, method, path string, payload interface{}, useServiceRole bool) (*AuthResponse, error) {
	req, err := c.newJSONRequest(ctx, method, c.authURL+path, payload)
	if err != nil {
		return nil, err
	}

	if useServiceRole {
		c.setServiceRoleHeaders(req)
	} else {
		c.setAnonHeaders(req)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, c.parseError(resp)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, err
	}
	return &authResp, nil
}

// ============================================================================
// PostgREST Methods
// ============================================================================

// QueryBuilder helps construct PostgREST queries.
type QueryBuilder struct {
	client    *Client
	table     string
	selects   string
	filters   []string
	orders    []string
	limitVal  int
	offsetVal int
	useAuth   string // access token for RLS
}

// From starts a query on a table.
func (c *Client) From(table string) *QueryBuilder {
	return &QueryBuilder{
		client: c,
		table:  table,
	}
}

// Select specifies which columns to return.
func (q *QueryBuilder) Select(columns string) *QueryBuilder {
	q.selects = columns
	return q
}

// Eq adds an equality filter.
func (q *QueryBuilder) Eq(column string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=eq.%v", column, value))
	return q
}

// Neq adds a not-equal filter.
func (q *QueryBuilder) Neq(column string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=neq.%v", column, value))
	return q
}

// Gt adds a greater-than filter.
func (q *QueryBuilder) Gt(column string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=gt.%v", column, value))
	return q
}

// Gte adds a greater-than-or-equal filter.
func (q *QueryBuilder) Gte(column string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=gte.%v", column, value))
	return q
}

// Lt adds a less-than filter.
func (q *QueryBuilder) Lt(column string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=lt.%v", column, value))
	return q
}

// Lte adds a less-than-or-equal filter.
func (q *QueryBuilder) Lte(column string, value interface{}) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=lte.%v", column, value))
	return q
}

// Like adds a LIKE filter.
func (q *QueryBuilder) Like(column string, pattern string) *QueryBuilder {
	q.filters = append(q.filters, fmt.Sprintf("%s=like.%s", column, pattern))
	return q
}

// In adds an IN filter.
func (q *QueryBuilder) In(column string, values []interface{}) *QueryBuilder {
	var strValues []string
	for _, v := range values {
		strValues = append(strValues, fmt.Sprintf("%v", v))
	}
	q.filters = append(q.filters, fmt.Sprintf("%s=in.(%s)", column, strings.Join(strValues, ",")))
	return q
}

// Order adds ordering.
func (q *QueryBuilder) Order(column string, ascending bool) *QueryBuilder {
	dir := "desc"
	if ascending {
		dir = "asc"
	}
	q.orders = append(q.orders, fmt.Sprintf("%s.%s", column, dir))
	return q
}

// Limit sets the maximum number of rows to return.
func (q *QueryBuilder) Limit(n int) *QueryBuilder {
	q.limitVal = n
	return q
}

// Offset sets the number of rows to skip.
func (q *QueryBuilder) Offset(n int) *QueryBuilder {
	q.offsetVal = n
	return q
}

// WithAuth sets the access token for RLS-aware queries.
func (q *QueryBuilder) WithAuth(accessToken string) *QueryBuilder {
	q.useAuth = accessToken
	return q
}

// Execute runs a SELECT query and returns results.
func (q *QueryBuilder) Execute(ctx context.Context, dest interface{}) error {
	url := q.buildURL()

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	if q.useAuth != "" {
		q.client.setAuthHeaders(req, q.useAuth)
	} else {
		q.client.setServiceRoleHeaders(req)
	}

	resp, err := q.client.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return q.client.parseError(resp)
	}

	return json.NewDecoder(resp.Body).Decode(dest)
}

// Insert creates new rows.
func (q *QueryBuilder) Insert(ctx context.Context, data interface{}) error {
	return q.mutate(ctx, "POST", data, false)
}

// Upsert creates or updates rows.
func (q *QueryBuilder) Upsert(ctx context.Context, data interface{}) error {
	return q.mutate(ctx, "POST", data, true)
}

// Update modifies existing rows (requires filters).
func (q *QueryBuilder) Update(ctx context.Context, data interface{}) error {
	if len(q.filters) == 0 {
		return errors.New("supabase: update requires at least one filter")
	}
	return q.mutate(ctx, "PATCH", data, false)
}

// Delete removes rows (requires filters).
func (q *QueryBuilder) Delete(ctx context.Context) error {
	if len(q.filters) == 0 {
		return errors.New("supabase: delete requires at least one filter")
	}

	url := q.buildURL()
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}

	if q.useAuth != "" {
		q.client.setAuthHeaders(req, q.useAuth)
	} else {
		q.client.setServiceRoleHeaders(req)
	}

	resp, err := q.client.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return q.client.parseError(resp)
	}
	return nil
}

func (q *QueryBuilder) mutate(ctx context.Context, method string, data interface{}, upsert bool) error {
	url := q.buildURL()

	req, err := q.client.newJSONRequest(ctx, method, url, data)
	if err != nil {
		return err
	}

	if upsert {
		req.Header.Set("Prefer", "resolution=merge-duplicates")
	}

	if q.useAuth != "" {
		q.client.setAuthHeaders(req, q.useAuth)
	} else {
		q.client.setServiceRoleHeaders(req)
	}

	resp, err := q.client.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return q.client.parseError(resp)
	}
	return nil
}

func (q *QueryBuilder) buildURL() string {
	url := q.client.restURL + "/" + q.table

	var params []string
	if q.selects != "" {
		params = append(params, "select="+q.selects)
	}
	params = append(params, q.filters...)
	if len(q.orders) > 0 {
		params = append(params, "order="+strings.Join(q.orders, ","))
	}
	if q.limitVal > 0 {
		params = append(params, fmt.Sprintf("limit=%d", q.limitVal))
	}
	if q.offsetVal > 0 {
		params = append(params, fmt.Sprintf("offset=%d", q.offsetVal))
	}

	if len(params) > 0 {
		url += "?" + strings.Join(params, "&")
	}
	return url
}

// ============================================================================
// Storage Methods
// ============================================================================

// UploadFile uploads a file to Supabase Storage.
func (c *Client) UploadFile(ctx context.Context, bucket, path string, data io.Reader, contentType string) error {
	url := fmt.Sprintf("%s/object/%s/%s", c.storageURL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, "POST", url, data)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", contentType)
	c.setServiceRoleHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return c.parseError(resp)
	}
	return nil
}

// DownloadFile downloads a file from Supabase Storage.
func (c *Client) DownloadFile(ctx context.Context, bucket, path string) (io.ReadCloser, error) {
	url := fmt.Sprintf("%s/object/%s/%s", c.storageURL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	c.setServiceRoleHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		resp.Body.Close()
		return nil, c.parseError(resp)
	}
	return resp.Body, nil
}

// DeleteFile removes a file from Supabase Storage.
func (c *Client) DeleteFile(ctx context.Context, bucket, path string) error {
	url := fmt.Sprintf("%s/object/%s/%s", c.storageURL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	c.setServiceRoleHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return c.parseError(resp)
	}
	return nil
}

// GetPublicURL returns the public URL for a file.
func (c *Client) GetPublicURL(bucket, path string) string {
	return fmt.Sprintf("%s/object/public/%s/%s", c.storageURL, bucket, path)
}

// ============================================================================
// Helper Methods
// ============================================================================

func (c *Client) newJSONRequest(ctx context.Context, method, url string, payload interface{}) (*http.Request, error) {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = strings.NewReader(string(data))
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func (c *Client) setAnonHeaders(req *http.Request) {
	req.Header.Set("apikey", c.cfg.AnonKey)
}

func (c *Client) setServiceRoleHeaders(req *http.Request) {
	key := c.cfg.ServiceRoleKey
	if key == "" {
		key = c.cfg.AnonKey
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
}

func (c *Client) setAuthHeaders(req *http.Request, accessToken string) {
	req.Header.Set("apikey", c.cfg.AnonKey)
	req.Header.Set("Authorization", "Bearer "+accessToken)
}

// APIError represents a Supabase API error.
type APIError struct {
	Code       int    `json:"code"`
	Message    string `json:"message"`
	ErrorText  string `json:"error"`
	StatusCode int    `json:"-"`
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("supabase: %s (code=%d)", e.Message, e.StatusCode)
	}
	return fmt.Sprintf("supabase: %s (code=%d)", e.ErrorText, e.StatusCode)
}

func (c *Client) parseError(resp *http.Response) error {
	var apiErr APIError
	if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
		return fmt.Errorf("supabase: request failed with status %d", resp.StatusCode)
	}
	apiErr.StatusCode = resp.StatusCode
	return &apiErr
}
