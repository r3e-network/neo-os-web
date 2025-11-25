package httpapi

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	app "github.com/R3E-Network/service_layer/internal/app"
	"github.com/R3E-Network/service_layer/internal/app/jam"
)

func TestServiceStartFailsWhenPortInUse(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen for test: %v", err)
	}
	defer ln.Close()

	addr := ln.Addr().String()
	application, err := app.New(app.Stores{}, nil)
	if err != nil {
		t.Fatalf("new app: %v", err)
	}
	svc := NewService(application, addr, nil, jam.Config{}, nil, nil, nil, nil)

	if err := svc.Start(context.Background()); err == nil {
		t.Fatalf("expected start to fail when port is occupied")
	}
}

func TestServiceRecordsBoundAddress(t *testing.T) {
	application, err := app.New(app.Stores{}, nil)
	if err != nil {
		t.Fatalf("new app: %v", err)
	}
	svc := NewService(application, "127.0.0.1:0", nil, jam.Config{}, nil, nil, nil, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := svc.Start(ctx); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer func() {
		stopCtx, stopCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer stopCancel()
		_ = svc.Stop(stopCtx)
	}()

	bound := svc.Addr()
	if bound == "" || bound == "127.0.0.1:0" || !strings.HasPrefix(bound, "127.0.0.1:") {
		t.Fatalf("expected bound addr resolved, got %q", bound)
	}
}
