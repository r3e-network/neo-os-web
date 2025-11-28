package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/R3E-Network/service_layer/internal/config"
	engineRuntime "github.com/R3E-Network/service_layer/internal/engine/runtime"
	"github.com/R3E-Network/service_layer/internal/version"
)

func main() {
	addr := flag.String("addr", "", "HTTP listen address (defaults to config or :8080)")
	dsn := flag.String("dsn", "", "PostgreSQL DSN (Supabase) required; no in-memory fallback")
	configPath := flag.String("config", "", "Path to configuration file (JSON or YAML)")
	runMigrations := flag.Bool("migrate", true, "run embedded database migrations on startup (ignored for in-memory)")
	apiTokensFlag := flag.String("api-tokens", "", "comma-separated API tokens for HTTP authentication")
	slowThreshold := flag.Int("slow-ms", 0, "override slow module threshold in milliseconds (defaults to MODULE_SLOW_MS or 1000)")
	showVersion := flag.Bool("version", false, "print build information and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println(version.FullVersion())
		return
	}

	var cfg *config.Config
	var err error
	if trimmed := strings.TrimSpace(*configPath); trimmed != "" {
		cfg, err = loadConfigFile(trimmed)
		if err != nil {
			log.Fatalf("load config %s: %v", trimmed, err)
		}
	} else {
		cfg, err = config.Load()
		if err != nil {
			log.Fatalf("load config: %v", err)
		}
	}

	dsnVal := resolveDSN(*dsn, cfg)
	cfg.Database.DSN = dsnVal

	options := []engineRuntime.Option{
		engineRuntime.WithConfig(cfg),
		engineRuntime.WithRunMigrations(*runMigrations),
	}
	if trimmed := strings.TrimSpace(*addr); trimmed != "" {
		options = append(options, engineRuntime.WithListenAddr(trimmed))
	}
	if tokens := splitTokens(*apiTokensFlag); len(tokens) > 0 {
		options = append(options, engineRuntime.WithAPITokens(tokens))
	}
	if *slowThreshold > 0 {
		options = append(options, engineRuntime.WithSlowThresholdMS(*slowThreshold))
	}

	log.Printf("Service Layer %s starting", version.FullVersion())
	application, err := engineRuntime.NewApplication(options...)
	if err != nil {
		log.Fatalf("initialise runtime: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runErr := make(chan error, 1)
	go func() {
		runErr <- application.Run(ctx)
	}()

	// Surface the bound address (resolved when using :0) for operators.
	if addr := application.ListenAddr(); strings.TrimSpace(addr) != "" {
		log.Printf("HTTP listening on %s", addr)
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-runErr:
		if err != nil {
			log.Fatalf("run: %v", err)
		}
		return
	case <-sigCh:
	}

	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := application.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}

	if err := <-runErr; err != nil {
		log.Fatalf("run: %v", err)
	}
}

func loadConfigFile(path string) (*config.Config, error) {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".yaml", ".yml":
		return config.LoadFile(path)
	case ".json":
		return config.LoadConfig(path)
	default:
		if cfg, err := config.LoadFile(path); err == nil {
			return cfg, nil
		}
		return config.LoadConfig(path)
	}
}

func resolveDSN(flagDSN string, cfg *config.Config) string {
	if trimmed := strings.TrimSpace(flagDSN); trimmed != "" {
		return trimmed
	}
	if envDSN := strings.TrimSpace(os.Getenv("DATABASE_URL")); envDSN != "" {
		return envDSN
	}
	if cfg == nil {
		return ""
	}
	if cfg.Database.DSN != "" {
		return strings.TrimSpace(cfg.Database.DSN)
	}
	if cfg.Database.Host != "" && cfg.Database.Name != "" {
		return cfg.Database.ConnectionString()
	}
	return ""
}

func splitTokens(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	trimmed := make([]string, 0, len(parts))
	for _, part := range parts {
		p := strings.TrimSpace(part)
		if p != "" {
			trimmed = append(trimmed, p)
		}
	}
	return trimmed
}
