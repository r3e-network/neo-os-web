//go:build integration && postgres

package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"bytes"
	app "github.com/R3E-Network/service_layer/applications"
	"github.com/R3E-Network/service_layer/applications/auth"
	"github.com/R3E-Network/service_layer/applications/jam"
	"github.com/R3E-Network/service_layer/pkg/storage/postgres"
	"github.com/R3E-Network/service_layer/system/platform/database"
	"github.com/R3E-Network/service_layer/system/platform/migrations"
	"github.com/joho/godotenv"
)

// JAM integration against Postgres to ensure endpoints persist data when Store=postgres.
func TestIntegrationJAMPostgres(t *testing.T) {
	_ = godotenv.Load()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; skipping JAM Postgres integration")
	}

	ctx := context.Background()
	db, err := database.Open(ctx, dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	if err := migrations.Apply(ctx, db); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	if _, err := db.Exec(`TRUNCATE jam_receipts, jam_accumulators, jam_attestations, jam_work_reports, jam_work_items, jam_work_packages, jam_messages, jam_preimages, jam_service_versions, jam_services RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate jam tables: %v", err)
	}

	pgStore := postgres.New(db)
	stores := app.Stores{
		Accounts:         pgStore,
		Functions:        pgStore,
		Triggers:         pgStore,
		GasBank:          pgStore,
		Automation:       pgStore,
		PriceFeeds:       pgStore,
		DataFeeds:        pgStore,
		DataStreams:      pgStore,
		DataLink:         pgStore,
		DTA:              pgStore,
		Confidential:     pgStore,
		Oracle:           pgStore,
		Secrets:          pgStore,
		CRE:              pgStore,
		CCIP:             pgStore,
		VRF:              pgStore,
		WorkspaceWallets: pgStore,
	}
	appInstance, err := app.New(stores, nil)
	if err != nil {
		t.Fatalf("new application: %v", err)
	}
	if err := appInstance.Start(ctx); err != nil {
		t.Fatalf("start application: %v", err)
	}
	t.Cleanup(func() { _ = appInstance.Stop(context.Background()) })

	tokens := []string{"dev-token"}
	authMgr := auth.NewManager("integration-secret", []auth.User{{Username: "admin", Password: "pass", Role: "admin"}})
	auditBuf := newAuditLog(50, newPostgresAuditSink(db))
	handler := NewHandler(appInstance, jam.Config{Enabled: true, Store: "postgres", PGDSN: dsn}, tokens, authMgr, auditBuf, nil, nil)
	handler = wrapWithAuth(handler, tokens, nil, authMgr)
	handler = wrapWithAudit(handler, auditBuf)
	handler = wrapWithCORS(handler)
	server := httptest.NewServer(handler)
	defer server.Close()
	client := server.Client()

	content := []byte("jam-postgres-data")
	sum := sha256.Sum256(content)
	hash := hex.EncodeToString(sum[:])

	req, _ := http.NewRequest(http.MethodPut, server.URL+"/jam/preimages/"+hash, bytesReader(t, content))
	req.Header.Set("Authorization", "Bearer dev-token")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("preimage put: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("preimage status %d", resp.StatusCode)
	}
	resp.Body.Close()

	body := marshalBody(t, map[string]any{
		"service_id": "svc-jam",
		"items": []map[string]any{
			{"kind": "demo", "params_hash": "abc"},
		},
	})
	req, _ = http.NewRequest(http.MethodPost, server.URL+"/jam/packages", bytesReader(t, body))
	req.Header.Set("Authorization", "Bearer dev-token")
	req.Header.Set("Content-Type", "application/json")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("package post: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("package status %d", resp.StatusCode)
	}
	var pkg jam.WorkPackage
	if err := json.NewDecoder(resp.Body).Decode(&pkg); err != nil {
		t.Fatalf("decode package: %v", err)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodPost, server.URL+"/jam/process", nil)
	req.Header.Set("Authorization", "Bearer dev-token")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("process: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("process status %d", resp.StatusCode)
	}
	resp.Body.Close()

	req, _ = http.NewRequest(http.MethodGet, server.URL+"/jam/packages/"+pkg.ID+"/report", nil)
	req.Header.Set("Authorization", "Bearer dev-token")
	resp, err = client.Do(req)
	if err != nil {
		t.Fatalf("report: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("report status %d", resp.StatusCode)
	}
	resp.Body.Close()

	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM jam_preimages`).Scan(&count); err != nil {
		t.Fatalf("count preimages: %v", err)
	}
	if count == 0 {
		t.Fatalf("expected preimage persisted in postgres")
	}
}

func bytesReader(t *testing.T, b []byte) *bytes.Buffer {
	t.Helper()
	return bytes.NewBuffer(b)
}
