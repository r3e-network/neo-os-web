package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

// Verifies a master-key attestation bundle hash matches the expected on-chain attestation hash.
// Bundle fields expected: pubkey, hash (sha256(pubkey)), plus optional provider evidence fields.
var newVerifyBundleHTTPClient = func() *http.Client {
	return httputil.CopyHTTPClientWithTimeoutNoRedirect(nil, 30*time.Second, false)
}

func main() {
	bundleURI := flag.String("bundle", "", "Bundle URI (file:///path or https://...) containing pubkey/hash/quote")
	expected := flag.String("expected-hash", "", "Expected SHA-256(bundle) hex (on-chain attestation hash)")
	flag.Parse()

	if *bundleURI == "" || *expected == "" {
		flag.Usage()
		os.Exit(1)
	}

	data, err := fetch(*bundleURI)
	if err != nil {
		log.Fatalf("fetch bundle: %v", err)
	}

	sum := sha256.Sum256(data)
	if !strings.EqualFold(hex.EncodeToString(sum[:]), trim0x(*expected)) {
		log.Fatalf("bundle hash mismatch: got %s want %s", hex.EncodeToString(sum[:]), trim0x(*expected))
	}

	var body struct {
		Hash   string `json:"hash"`
		PubKey string `json:"pubkey"`
		Quote  string `json:"quote"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		log.Fatalf("decode bundle: %v", err)
	}
	if body.PubKey == "" || body.Hash == "" {
		log.Fatalf("bundle missing pubkey/hash")
	}

	fmt.Printf("Bundle OK. PubKey=%s Hash=%s BundleHash=%s\n", body.PubKey, body.Hash, hex.EncodeToString(sum[:]))
}

func fetch(uri string) ([]byte, error) {
	if strings.HasPrefix(uri, "file://") {
		path := strings.TrimPrefix(uri, "file://")
		return os.ReadFile(path)
	}

	u, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("unsupported URL scheme: %s", u.Scheme)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), http.NoBody)
	if err != nil {
		return nil, err
	}

	httpClient := newVerifyBundleHTTPClient()
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		httpErr, readErr := httputil.BuildHTTPStatusErrorFromRequest(resp, req, 32<<10)
		if readErr != nil {
			return nil, httputil.WrapReadBodyError(httpErr, readErr)
		}
		return nil, httpErr
	}
	body, err := httputil.ReadAllStrict(resp.Body, 64<<20)
	if err != nil {
		return nil, err
	}
	return body, nil
}

func trim0x(s string) string {
	if len(s) >= 2 && strings.HasPrefix(s, "0x") {
		return s[2:]
	}
	return s
}
