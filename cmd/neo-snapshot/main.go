package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Config controls snapshot generation for a given block height.
type Config struct {
	RPCURL     string
	Height     int64
	OutputDir  string
	Network    string
}

func main() {
	var cfg Config
	flag.StringVar(&cfg.RPCURL, "rpc", envDefault("NEO_RPC_URL", "http://localhost:10332"), "NEO RPC endpoint")
	flag.Int64Var(&cfg.Height, "height", 0, "block height to snapshot (required)")
	flag.StringVar(&cfg.OutputDir, "out", envDefault("NEO_SNAPSHOT_OUT", "./snapshots"), "output directory for KV bundle + manifest")
	flag.StringVar(&cfg.Network, "network", envDefault("NEO_NETWORK", "mainnet"), "network label (mainnet|testnet)")
	flag.Parse()

	if cfg.Height <= 0 {
		log.Fatal("height must be > 0")
	}

	if err := os.MkdirAll(cfg.OutputDir, 0o755); err != nil {
		log.Fatalf("create output dir: %v", err)
	}

	manifestPath := filepath.Join(cfg.OutputDir, fmt.Sprintf("block-%d.json", cfg.Height))
	kvPath := filepath.Join(cfg.OutputDir, fmt.Sprintf("block-%d-kv.tar.gz", cfg.Height))

	// TODO: implement RPC fetch of state root + storage. For now, emit placeholder manifest.
	manifest := fmt.Sprintf(`{"network":"%s","height":%d,"state_root":"TODO","kv_path":"%s","generated_at":"%s"}`, cfg.Network, cfg.Height, kvPath, time.Now().UTC().Format(time.RFC3339))
	if err := os.WriteFile(manifestPath, []byte(manifest), 0o644); err != nil {
		log.Fatalf("write manifest: %v", err)
	}
	if err := os.WriteFile(kvPath, []byte("TODO: bundle KV"), 0o644); err != nil {
		log.Fatalf("write kv placeholder: %v", err)
	}
	log.Printf("snapshot stub written: manifest=%s kv=%s", manifestPath, kvPath)
}

func envDefault(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}
