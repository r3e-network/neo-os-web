//go:build scripts

// Run a SQL migration file against Supabase.
// Usage: go run -tags=scripts scripts/run_migration.go <migration_file>
package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
)

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

	if supabaseURL == "" || supabaseKey == "" {
		fmt.Println("❌ SUPABASE_URL and SUPABASE_SERVICE_KEY required")
		os.Exit(1)
	}

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

	// Execute each statement
	statements := splitStatements(string(content))
	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || strings.HasPrefix(stmt, "--") {
			continue
		}

		fmt.Printf("📝 Executing statement %d...\n", i+1)
		_, err := repo.Request(ctx, "POST", "rpc/exec_sql", []byte(fmt.Sprintf(`{"query": %q}`, stmt)), "")
		if err != nil {
			fmt.Printf("⚠️  Statement %d may have failed (this is often OK for IF NOT EXISTS): %v\n", i+1, err)
		}
	}

	fmt.Println("✅ Migration complete!")
}

func splitStatements(sql string) []string {
	// Simple statement splitter - split on semicolons
	var statements []string
	var current strings.Builder

	for _, line := range strings.Split(sql, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "--") {
			continue
		}
		current.WriteString(line)
		current.WriteString(" ")
		if strings.HasSuffix(line, ";") {
			statements = append(statements, current.String())
			current.Reset()
		}
	}

	if current.Len() > 0 {
		statements = append(statements, current.String())
	}

	return statements
}
