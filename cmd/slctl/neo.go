package main

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"
)

func handleNeo(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		return usageError(errors.New("neo subcommand required (status|blocks|block|snapshots|storage|storage-diff|storage-summary|download|verify|verify-manifest|verify-all)"))
	}
	switch args[0] {
	case "status":
		return neoStatus(ctx, client)
	case "checkpoint":
		return neoCheckpoint(ctx, client)
	case "blocks":
		return neoBlocks(ctx, client, args[1:])
	case "block":
		return neoBlock(ctx, client, args[1:])
	case "snapshots":
		return neoSnapshots(ctx, client, args[1:])
	case "storage":
		return neoStorage(ctx, client, args[1:])
	case "storage-diff":
		return neoStorageDiff(ctx, client, args[1:])
	case "storage-summary":
		return neoStorageSummary(ctx, client, args[1:])
	case "download":
		return neoDownload(ctx, client, args[1:])
	case "verify":
		return neoVerify(ctx, args[1:])
	case "verify-manifest":
		return neoVerifyManifest(ctx, client, args[1:])
	case "verify-all":
		return neoVerifyAll(ctx, client, args[1:])
	default:
		return usageError(fmt.Errorf("unknown neo subcommand %q", args[0]))
	}
}

func neoStatus(ctx context.Context, client *apiClient) error {
	data, err := client.request(ctx, "GET", "/neo/status", nil)
	if err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}

func neoCheckpoint(ctx context.Context, client *apiClient) error {
	data, err := client.request(ctx, "GET", "/neo/checkpoint", nil)
	if err != nil {
		return err
	}
	// Try to render a concise view.
	var status struct {
		Enabled         bool    `json:"enabled"`
		LatestHeight    int64   `json:"latest_height"`
		LatestHash      string  `json:"latest_hash"`
		StableHeight    int64   `json:"stable_height"`
		StableHash      string  `json:"stable_hash"`
		LastIndexedAt   *string `json:"last_indexed_at"`
		NodeHeight      int64   `json:"node_height"`
		NodeLag         int64   `json:"node_lag"`
		SnapshotCount   int     `json:"snapshot_count"`
		LatestStateRoot string  `json:"latest_state_root"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		// fallback raw
		fmt.Println(string(data))
		return nil
	}
	fmt.Printf("enabled=%v latest_height=%d stable_height=%d node_height=%d lag=%d snapshots=%d\n",
		status.Enabled, status.LatestHeight, status.StableHeight, status.NodeHeight, status.NodeLag, status.SnapshotCount)
	return nil
}

func neoBlocks(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("neo blocks", flag.ContinueOnError)
	limit := fs.Int("limit", 10, "max blocks to list")
	offset := fs.Int("offset", 0, "offset for pagination")
	fs.SetOutput(os.Stdout)
	if err := fs.Parse(args); err != nil {
		return err
	}
	path := fmt.Sprintf("/neo/blocks?limit=%d&offset=%d", *limit, *offset)
	data, err := client.request(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	var blocks []struct {
		Height    int64   `json:"height"`
		Hash      string  `json:"hash"`
		StateRoot string  `json:"state_root"`
		PrevHash  string  `json:"prev_hash"`
		NextHash  string  `json:"next_hash"`
		BlockTime *string `json:"block_time"`
		TxCount   int     `json:"tx_count"`
	}
	if err := json.Unmarshal(data, &blocks); err != nil {
		return err
	}
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "HEIGHT\tHASH\tSTATE_ROOT\tTXS\tTIME")
	for _, b := range blocks {
		bt := ""
		if b.BlockTime != nil {
			bt = *b.BlockTime
		}
		fmt.Fprintf(w, "%d\t%s\t%s\t%d\t%s\n", b.Height, truncate(b.Hash, 16), truncate(b.StateRoot, 16), b.TxCount, bt)
	}
	return w.Flush()
}

func neoBlock(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		return usageError(errors.New("neo block <height> required"))
	}
	height, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil || height < 0 {
		return usageError(fmt.Errorf("invalid height %q", args[0]))
	}
	path := fmt.Sprintf("/neo/blocks/%d", height)
	data, err := client.request(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	fmt.Println(prettyJSON(data))
	return nil
}

func neoSnapshots(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("neo snapshots", flag.ContinueOnError)
	limit := fs.Int("limit", 20, "max manifests to list")
	fs.SetOutput(os.Stdout)
	if err := fs.Parse(args); err != nil {
		return err
	}
	path := fmt.Sprintf("/neo/snapshots?limit=%d", *limit)
	data, err := client.request(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	fmt.Println(prettyJSON(data))
	return nil
}

func neoStorage(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		return usageError(errors.New("neo storage <height> required"))
	}
	height, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil || height < 0 {
		return usageError(fmt.Errorf("invalid height %q", args[0]))
	}
	path := fmt.Sprintf("/neo/storage/%d", height)
	data, err := client.request(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	fmt.Println(prettyJSON(data))
	return nil
}

func neoStorageDiff(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		return usageError(errors.New("neo storage-diff <height> required"))
	}
	height, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil || height < 0 {
		return usageError(fmt.Errorf("invalid height %q", args[0]))
	}
	path := fmt.Sprintf("/neo/storage-diff/%d", height)
	data, err := client.request(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	fmt.Println(prettyJSON(data))
	return nil
}

func neoStorageSummary(ctx context.Context, client *apiClient, args []string) error {
	if len(args) == 0 {
		return usageError(errors.New("neo storage-summary <height> required"))
	}
	height, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil || height < 0 {
		return usageError(fmt.Errorf("invalid height %q", args[0]))
	}
	summary, err := fetchStorageSummary(ctx, client, height)
	if err != nil {
		fmt.Fprintf(os.Stderr, "storage-summary endpoint unavailable, falling back to full storage fetch: %v\n", err)
		summary, err = legacyStorageSummary(ctx, client, height)
		if err != nil {
			return err
		}
	}
	return renderStorageSummary(summary)
}

type storageSummary struct {
	Contract    string `json:"contract"`
	KVEntries   int    `json:"kv_entries"`
	DiffEntries int    `json:"diff_entries"`
}

func fetchStorageSummary(ctx context.Context, client *apiClient, height int64) ([]storageSummary, error) {
	data, _, err := client.requestWithHeaders(ctx, "GET", fmt.Sprintf("/neo/storage-summary/%d", height), nil)
	if err != nil {
		return nil, err
	}
	var summary []storageSummary
	if err := json.Unmarshal(data, &summary); err != nil {
		return nil, err
	}
	return summary, nil
}

// legacyStorageSummary computes per-contract counts by fetching full storage + diffs.
func legacyStorageSummary(ctx context.Context, client *apiClient, height int64) ([]storageSummary, error) {
	storageData, err := client.request(ctx, "GET", fmt.Sprintf("/neo/storage/%d", height), nil)
	if err != nil {
		return nil, fmt.Errorf("storage: %w", err)
	}
	diffData, err := client.request(ctx, "GET", fmt.Sprintf("/neo/storage-diff/%d", height), nil)
	if err != nil {
		return nil, fmt.Errorf("storage diff: %w", err)
	}
	type storageItem struct {
		Contract string           `json:"contract"`
		KV       []map[string]any `json:"kv"`
		KVDiff   []map[string]any `json:"kv_diff"`
	}
	var storage []storageItem
	var diffs []storageItem
	_ = json.Unmarshal(storageData, &storage)
	_ = json.Unmarshal(diffData, &diffs)

	byContract := make(map[string]storageSummary)
	for _, s := range storage {
		byContract[s.Contract] = storageSummary{Contract: s.Contract, KVEntries: len(s.KV)}
	}
	for _, d := range diffs {
		entry := byContract[d.Contract]
		entry.Contract = d.Contract
		entry.DiffEntries = len(d.KVDiff)
		byContract[d.Contract] = entry
	}
	out := make([]storageSummary, 0, len(byContract))
	for _, v := range byContract {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Contract < out[j].Contract })
	return out, nil
}

func renderStorageSummary(summary []storageSummary) error {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "CONTRACT\tKV_ENTRIES\tDIFF_ENTRIES\n")
	for _, s := range summary {
		fmt.Fprintf(w, "%s\t%d\t%d\n", s.Contract, s.KVEntries, s.DiffEntries)
	}
	return w.Flush()
}

func neoDownload(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("neo download", flag.ContinueOnError)
	height := fs.Int64("height", 0, "block height to download snapshot bundle for")
	diff := fs.Bool("diff", false, "download diff bundle instead of full KV")
	out := fs.String("out", "", "output path (default: block-<h>-kv[-diff].tar.gz)")
	sha := fs.String("sha", "", "optional expected SHA256 to verify")
	fs.SetOutput(os.Stdout)
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *height <= 0 {
		return usageError(errors.New("neo download requires --height"))
	}
	path := fmt.Sprintf("/neo/snapshots/%d/kv", *height)
	suffix := "kv"
	if *diff {
		path = fmt.Sprintf("/neo/snapshots/%d/kv-diff", *height)
		suffix = "kv-diff"
	}
	dest := strings.TrimSpace(*out)
	if dest == "" {
		dest = fmt.Sprintf("block-%d-%s.tar.gz", *height, suffix)
	}
	fmt.Printf("Downloading %s to %s...\n", path, dest)
	n, err := client.downloadToFile(ctx, path, dest)
	if err != nil {
		return err
	}
	fmt.Printf("Saved %d bytes to %s\n", n, dest)
	if s := strings.TrimSpace(*sha); s != "" {
		if err := verifyFileSHA(dest, s); err != nil {
			return err
		}
		fmt.Println("SHA256 verified")
	}
	return nil
}

func neoVerifyManifest(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("neo verify-manifest", flag.ContinueOnError)
	url := fs.String("url", "", "Manifest URL (http(s))")
	file := fs.String("file", "", "Local manifest path")
	timeout := fs.Duration("timeout", 20*time.Second, "Download timeout for bundles")
	fs.SetOutput(os.Stdout)
	if err := fs.Parse(args); err != nil {
		return err
	}
	target := strings.TrimSpace(*url)
	if target == "" {
		target = strings.TrimSpace(*file)
	}
	if target == "" {
		return usageError(errors.New("neo verify-manifest requires --url or --file"))
	}
	var data []byte
	switch {
	case strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://"):
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
		if err != nil {
			return err
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("download failed: %d %s %s", resp.StatusCode, resp.Status, string(body))
		}
		data, err = io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
	case strings.HasPrefix(target, "/"):
		// Use authenticated client against the API for relative manifest paths.
		var err error
		data, err = client.request(ctx, http.MethodGet, target, nil)
		if err != nil {
			return err
		}
	default:
		var err error
		data, err = os.ReadFile(target)
		if err != nil {
			return err
		}
	}

	var manifest struct {
		Network       string `json:"network"`
		Height        int64  `json:"height"`
		StateRoot     string `json:"state_root"`
		KVHash        string `json:"kv_sha256"`
		KVURL         string `json:"kv_url"`
		KVDiffHash    string `json:"kv_diff_sha256"`
		KVDiffURL     string `json:"kv_diff_url"`
		Signature     string `json:"signature"`
		SigningPubKey string `json:"signing_public_key"`
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return fmt.Errorf("parse manifest: %w", err)
	}
	payload := fmt.Sprintf("%s|%d|%s|%s|%s", manifest.Network, manifest.Height, manifest.StateRoot, manifest.KVHash, manifest.KVDiffHash)
	if manifest.Signature == "" || manifest.SigningPubKey == "" {
		return fmt.Errorf("manifest missing signature or signing_public_key")
	}
	pub, err := hex.DecodeString(strings.TrimSpace(manifest.SigningPubKey))
	if err != nil {
		return fmt.Errorf("decode pub: %w", err)
	}
	sig, err := hex.DecodeString(strings.TrimSpace(manifest.Signature))
	if err != nil {
		return fmt.Errorf("decode signature: %w", err)
	}
	if !ed25519.Verify(ed25519.PublicKey(pub), []byte(payload), sig) {
		return fmt.Errorf("signature invalid for payload %s", payload)
	}
	fmt.Println("manifest signature valid")
	resolve := func(u string) string {
		if u == "" {
			return ""
		}
		if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
			return u
		}
		return client.baseURL + u
	}
	if manifest.KVHash != "" && manifest.KVURL != "" {
		if err := verifyResource(ctx, client, resolve(manifest.KVURL), manifest.KVHash, *timeout); err != nil {
			return fmt.Errorf("kv bundle verify failed: %w", err)
		}
		fmt.Println("kv bundle hash OK")
	} else {
		fmt.Println("kv bundle hash skipped (missing url or hash)")
	}
	if manifest.KVDiffHash != "" && manifest.KVDiffURL != "" {
		if err := verifyResource(ctx, client, resolve(manifest.KVDiffURL), manifest.KVDiffHash, *timeout); err != nil {
			return fmt.Errorf("kv diff bundle verify failed: %w", err)
		}
		fmt.Println("kv diff bundle hash OK")
	} else if manifest.KVDiffURL != "" || manifest.KVDiffHash != "" {
		fmt.Println("kv diff bundle hash skipped (url/hash incomplete)")
	}
	return nil
}

func truncate(v string, max int) string {
	v = strings.TrimSpace(v)
	if len(v) <= max {
		return v
	}
	if max <= 3 {
		return v[:max]
	}
	return v[:max-3] + "..."
}

func neoVerify(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("neo verify", flag.ContinueOnError)
	url := fs.String("url", "", "URL to the KV bundle (http(s))")
	file := fs.String("file", "", "Local path to the KV bundle")
	sha := fs.String("sha", "", "Expected SHA256 hex")
	fs.SetOutput(os.Stdout)
	if err := fs.Parse(args); err != nil {
		return err
	}
	target := strings.TrimSpace(*url)
	if target == "" {
		target = strings.TrimSpace(*file)
	}
	if target == "" || strings.TrimSpace(*sha) == "" {
		return usageError(errors.New("neo verify requires --url or --file and --sha"))
	}
	expected := strings.ToLower(strings.TrimSpace(*sha))
	var r io.ReadCloser
	if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
		if err != nil {
			return err
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		if resp.StatusCode >= 300 {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("download failed: %d %s %s", resp.StatusCode, resp.Status, string(body))
		}
		r = resp.Body
		defer resp.Body.Close()
	} else {
		f, err := os.Open(target)
		if err != nil {
			return err
		}
		defer f.Close()
		r = f
	}
	hasher := sha256.New()
	if _, err := io.Copy(hasher, r); err != nil {
		return fmt.Errorf("hashing: %w", err)
	}
	got := hex.EncodeToString(hasher.Sum(nil))
	if got != expected {
		return fmt.Errorf("sha mismatch: expected %s got %s", expected, got)
	}
	fmt.Printf("OK: %s matches %s\n", target, expected)
	return nil
}

func verifyFileSHA(path string, expected string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		return fmt.Errorf("hashing %s: %w", path, err)
	}
	got := hex.EncodeToString(hasher.Sum(nil))
	if strings.ToLower(got) != strings.ToLower(expected) {
		return fmt.Errorf("sha mismatch for %s: expected %s got %s", path, expected, got)
	}
	return nil
}

func neoVerifyAll(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("neo verify-all", flag.ContinueOnError)
	manifestTarget := fs.String("manifest", "", "Manifest URL or API path (defaults to /neo/snapshots/<height> when --height is set)")
	height := fs.Int64("height", 0, "Height to build manifest path (/neo/snapshots/<height>)")
	heightsCSV := fs.String("heights", "", "Comma-separated heights to verify (builds /neo/snapshots/<h> for each)")
	timeout := fs.Duration("timeout", 25*time.Second, "Download timeout")
	outManifest := fs.String("out", "", "Path to write manifest (optional)")
	download := fs.Bool("download", true, "Download bundles to disk (true) or verify remotely without writing (false)")
	kvOut := fs.String("kv-out", "", "Path to write KV bundle (defaults to block-<height>-kv.tar.gz)")
	diffOut := fs.String("kv-diff-out", "", "Path to write KV diff bundle (defaults to block-<height>-kv-diff.tar.gz)")
	fs.SetOutput(os.Stdout)
	if err := fs.Parse(args); err != nil {
		return err
	}
	targets := []string{}
	if t := strings.TrimSpace(*manifestTarget); t != "" {
		targets = append(targets, t)
	}
	if strings.TrimSpace(*heightsCSV) != "" {
		for _, part := range strings.Split(*heightsCSV, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if h, err := strconv.ParseInt(part, 10, 64); err == nil && h > 0 {
				targets = append(targets, fmt.Sprintf("/neo/snapshots/%d", h))
			} else {
				return usageError(fmt.Errorf("invalid height in --heights: %q", part))
			}
		}
	}
	if *height > 0 && len(targets) == 0 {
		targets = append(targets, fmt.Sprintf("/neo/snapshots/%d", *height))
	}
	if len(targets) == 0 {
		return usageError(errors.New("neo verify-all requires --manifest, --height, or --heights"))
	}
	if len(targets) > 1 && (strings.TrimSpace(*outManifest) != "" || strings.TrimSpace(*kvOut) != "" || strings.TrimSpace(*diffOut) != "") {
		return usageError(errors.New("when verifying multiple targets, omit --out/--kv-out/--kv-diff-out to avoid clobbering"))
	}

	opts := verifyAllOptions{
		download:     *download,
		outManifest:  strings.TrimSpace(*outManifest),
		kvOut:        strings.TrimSpace(*kvOut),
		diffOut:      strings.TrimSpace(*diffOut),
		timeout:      *timeout,
		customOutput: strings.TrimSpace(*outManifest) != "" || strings.TrimSpace(*kvOut) != "" || strings.TrimSpace(*diffOut) != "",
	}
	type result struct {
		target string
		err    error
	}
	var results []result
	for _, target := range targets {
		fmt.Printf("== Verifying manifest %s ==\n", target)
		err := verifyAllTarget(ctx, client, target, opts)
		results = append(results, result{target: target, err: err})
	}

	fmt.Println("\nSummary:")
	fmt.Println("TARGET\tSTATUS")
	var errs []string
	for _, r := range results {
		if r.err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", r.target, r.err))
			fmt.Printf("%s\tFAIL (%v)\n", r.target, r.err)
		} else {
			fmt.Printf("%s\tOK\n", r.target)
		}
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

type verifyAllOptions struct {
	download     bool
	outManifest  string
	kvOut        string
	diffOut      string
	timeout      time.Duration
	customOutput bool
}

func verifyAllTarget(ctx context.Context, client *apiClient, target string, opts verifyAllOptions) error {
	data, err := fetchBytes(ctx, client, target, opts.timeout)
	if err != nil {
		return fmt.Errorf("fetch manifest: %w", err)
	}
	var m manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("decode manifest: %w", err)
	}
	fmt.Printf("Manifest: network=%s height=%d root=%s\n", m.Network, m.Height, m.StateRoot)
	if path := strings.TrimSpace(opts.outManifest); path != "" {
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return fmt.Errorf("write manifest: %w", err)
		}
		fmt.Println("Saved manifest to", path)
	}

	// Verify signature if present.
	if m.Signature != "" && m.SigningPublicKey != "" {
		if err := verifyManifestSignature(m); err != nil {
			return fmt.Errorf("manifest signature verify failed: %w", err)
		}
		fmt.Println("Manifest signature OK")
	} else {
		fmt.Println("Manifest signature missing; skipped")
	}

	resolve := func(u string) string {
		if u == "" {
			return ""
		}
		if strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://") {
			return u
		}
		return client.baseURL + u
	}

	defaultKV := fmt.Sprintf("block-%d-kv.tar.gz", m.Height)
	defaultDiff := fmt.Sprintf("block-%d-kv-diff.tar.gz", m.Height)

	if m.KVURL != "" && m.KVHash != "" {
		if opts.download {
			dest := strings.TrimSpace(opts.kvOut)
			if dest == "" {
				dest = defaultKV
			}
			if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
				return fmt.Errorf("prep kv output dir: %w", err)
			}
			if err := downloadBundle(ctx, client, resolve(m.KVURL), m.KVHash, dest, opts.timeout); err != nil {
				return fmt.Errorf("kv bundle download/verify failed: %w", err)
			}
			fmt.Println("KV bundle saved to", dest)
		} else {
			if err := verifyResource(ctx, client, resolve(m.KVURL), m.KVHash, opts.timeout); err != nil {
				return fmt.Errorf("kv bundle verify failed: %w", err)
			}
			fmt.Println("KV bundle hash OK (no write)")
		}
	} else {
		fmt.Println("KV bundle skipped (missing url or hash)")
	}

	if m.KVDiffURL != "" && m.KVDiffHash != "" {
		if opts.download {
			dest := strings.TrimSpace(opts.diffOut)
			if dest == "" {
				dest = defaultDiff
			}
			if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
				return fmt.Errorf("prep kv diff output dir: %w", err)
			}
			if err := downloadBundle(ctx, client, resolve(m.KVDiffURL), m.KVDiffHash, dest, opts.timeout); err != nil {
				return fmt.Errorf("kv diff download/verify failed: %w", err)
			}
			fmt.Println("KV diff bundle saved to", dest)
		} else {
			if err := verifyResource(ctx, client, resolve(m.KVDiffURL), m.KVDiffHash, opts.timeout); err != nil {
				return fmt.Errorf("kv diff verify failed: %w", err)
			}
			fmt.Println("KV diff hash OK (no write)")
		}
	} else if m.KVDiffURL != "" || m.KVDiffHash != "" {
		fmt.Println("KV diff skipped (missing url or hash)")
	} else {
		fmt.Println("KV diff not present; skipped")
	}

	return nil
}
