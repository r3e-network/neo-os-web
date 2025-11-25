package postgres

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/R3E-Network/service_layer/internal/platform/migrations"
	_ "github.com/lib/pq"
)

func newTestStore(t *testing.T) (*Store, context.Context) {
	t.Helper()
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN not set; skipping postgres integration test")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	if err := migrations.Apply(context.Background(), db); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := resetTables(db); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	t.Cleanup(func() {
		_ = resetTables(db)
		_ = db.Close()
	})

	return New(db), context.Background()
}

func resetTables(db *sql.DB) error {
	_, err := db.Exec(`
		TRUNCATE
			confidential_attestations,
			confidential_sealed_keys,
			confidential_enclaves,
			chainlink_datastream_frames,
			chainlink_datastreams,
			chainlink_datalink_deliveries,
			chainlink_datalink_channels,
			chainlink_data_feed_updates,
			chainlink_data_feeds,
			chainlink_dta_orders,
			chainlink_dta_products,
			app_ccip_messages,
			app_ccip_lanes,
			app_cre_runs,
			app_cre_executors,
			app_cre_playbooks,
			app_vrf_requests,
			app_vrf_keys,
			workspace_wallets,
			app_oracle_requests,
			app_oracle_sources,
			app_secrets,
			app_price_feed_rounds,
			app_price_feed_snapshots,
			app_price_feeds,
			app_automation_jobs,
			app_triggers,
			app_functions,
			app_gas_transactions,
			app_gas_accounts,
			app_accounts
		RESTART IDENTITY CASCADE
	`)
	return err
}
