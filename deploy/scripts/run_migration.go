//go:build scripts

// Run a SQL migration file against Supabase.
// Usage: go run -tags=scripts scripts/run_migration.go <migration_file>
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
)

var dollarQuoteTagPattern = regexp.MustCompile(`\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$`)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run -tags=scripts scripts/run_migration.go <migration_file>")
		os.Exit(1)
	}

	migrationFile := os.Args[1]

	// Read migration file
	content, err := os.ReadFile(migrationFile)
	if err != nil {
		fmt.Printf("❌ Failed to read migration file: %v\n", err)
		os.Exit(1)
	}

	// Parse environment
	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	supabaseKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_KEY"))
	if supabaseKey == "" {
		supabaseKey = strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	}
	supabaseAccessToken := strings.TrimSpace(os.Getenv("SUPABASE_ACCESS_TOKEN"))

	if supabaseURL == "" || supabaseKey == "" {
		fmt.Println("❌ SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) required")
		os.Exit(1)
	}

	projectRef := extractProjectRef(supabaseURL)

	// Initialize database client
	dbClient, err := database.NewClient(database.Config{
		URL:        supabaseURL,
		ServiceKey: supabaseKey,
	})
	if err != nil {
		fmt.Printf("❌ Failed to create database client: %v\n", err)
		os.Exit(1)
	}

	repo := database.NewRepository(dbClient)
	ctx := context.Background()

	// Prefer RPC execution when available. If exec_sql RPC is not exposed,
	// fall back to Supabase management API and execute the full migration body.
	if !canUseExecSQL(ctx, repo) {
		if projectRef == "" || supabaseAccessToken == "" {
			fmt.Println("❌ exec_sql RPC unavailable and no management fallback configured")
			fmt.Println("   Required for fallback: SUPABASE_ACCESS_TOKEN and SUPABASE_URL with valid project ref")
			os.Exit(1)
		}
		if err := executeViaManagementAPI(ctx, supabaseAccessToken, projectRef, string(content)); err != nil {
			fmt.Printf("❌ Migration failed via management API fallback: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✅ Migration complete! (management API fallback)")
		return
	}

	// Execute each statement
	statements := splitStatements(string(content))
	failedStatements := 0
	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || strings.HasPrefix(stmt, "--") {
			continue
		}

		fmt.Printf("📝 Executing statement %d...\n", i+1)
		_, err := repo.RequestRPC(ctx, http.MethodPost, "rpc/exec_sql", []byte(fmt.Sprintf(`{"query": %q}`, stmt)), "")
		if err != nil {
			failedStatements++
			fmt.Printf("❌ Statement %d failed: %v\n", i+1, err)
		}
	}

	if failedStatements > 0 {
		fmt.Printf("❌ Migration finished with %d failed statement(s)\n", failedStatements)
		os.Exit(1)
	}

	fmt.Println("✅ Migration complete!")
}

func splitStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	activeDollarTag := ""

	for _, line := range strings.Split(sql, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}

		tags := dollarQuoteTagPattern.FindAllString(line, -1)
		for _, tag := range tags {
			if activeDollarTag == "" {
				activeDollarTag = tag
				continue
			}
			if tag == activeDollarTag {
				activeDollarTag = ""
			}
		}

		current.WriteString(line)
		current.WriteString("\n")
		if activeDollarTag == "" && strings.HasSuffix(trimmed, ";") {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			current.Reset()
		}
	}

	if current.Len() > 0 {
		stmt := strings.TrimSpace(current.String())
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}

	return statements
}

func canUseExecSQL(ctx context.Context, repo *database.Repository) bool {
	_, err := repo.RequestRPC(ctx, http.MethodPost, "rpc/exec_sql", []byte(`{"query":"select 1;"}`), "")
	return err == nil
}

func extractProjectRef(supabaseURL string) string {
	u, err := url.Parse(strings.TrimSpace(supabaseURL))
	if err != nil {
		return ""
	}
	host := strings.TrimSpace(u.Hostname())
	if host == "" {
		return ""
	}
	parts := strings.Split(host, ".")
	if len(parts) < 1 {
		return ""
	}
	return strings.TrimSpace(parts[0])
}

func executeViaManagementAPI(ctx context.Context, accessToken, projectRef, query string) error {
	if strings.TrimSpace(accessToken) == "" || strings.TrimSpace(projectRef) == "" {
		return fmt.Errorf("missing access token or project ref")
	}

	payload, err := json.Marshal(map[string]string{"query": query})
	if err != nil {
		return fmt.Errorf("marshal management payload: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		fmt.Sprintf("https://api.supabase.com/v1/projects/%s/database/query", projectRef),
		bytes.NewReader(payload),
	)
	if err != nil {
		return fmt.Errorf("create management request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute management request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("management API error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	return nil
}
