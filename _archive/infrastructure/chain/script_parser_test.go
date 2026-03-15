package chain

import (
	"encoding/hex"
	"testing"

	"github.com/nspcc-dev/neo-go/pkg/core/interop/interopnames"
	"github.com/nspcc-dev/neo-go/pkg/io"
	"github.com/nspcc-dev/neo-go/pkg/smartcontract/callflag"
	"github.com/nspcc-dev/neo-go/pkg/util"
	"github.com/nspcc-dev/neo-go/pkg/vm/emit"
)

func TestExtractContractCallTargets(t *testing.T) {
	hashLE := "d2a4cff31913016155e38e474a2c06d08be276cf"
	hash, err := util.Uint160DecodeStringLE(hashLE)
	if err != nil {
		t.Fatalf("decode hash: %v", err)
	}

	bw := io.NewBufBinWriter()
	emit.AppCall(bw.BinWriter, hash, "ping", callflag.All, 1, 2)
	if bw.Err != nil {
		t.Fatalf("build script: %v", bw.Err)
	}
	scriptHex := hex.EncodeToString(bw.Bytes())

	targets, err := ExtractContractCallTargets(scriptHex)
	if err != nil {
		t.Fatalf("ExtractContractCallTargets error: %v", err)
	}
	if len(targets) != 1 {
		t.Fatalf("expected 1 target, got %d", len(targets))
	}
	if targets[0] != hashLE {
		t.Fatalf("expected %s, got %s", hashLE, targets[0])
	}
}

func TestExtractContractCallTargetsIgnoresNonCallSyscall(t *testing.T) {
	bw := io.NewBufBinWriter()
	emit.Syscall(bw.BinWriter, interopnames.SystemRuntimeGetTime)
	if bw.Err != nil {
		t.Fatalf("build script: %v", bw.Err)
	}
	scriptHex := hex.EncodeToString(bw.Bytes())

	targets, err := ExtractContractCallTargets(scriptHex)
	if err != nil {
		t.Fatalf("ExtractContractCallTargets error: %v", err)
	}
	if len(targets) != 0 {
		t.Fatalf("expected no targets, got %d", len(targets))
	}
}
