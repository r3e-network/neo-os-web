package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	app "github.com/R3E-Network/service_layer/internal/app"
	"github.com/R3E-Network/service_layer/internal/app/jam"
	core "github.com/R3E-Network/service_layer/internal/services/core"
)

func TestSystemDescriptorsIncludeEngineModules(t *testing.T) {
	application, err := app.New(app.Stores{}, nil)
	if err != nil {
		t.Fatalf("new application: %v", err)
	}

	modules := func() []ModuleStatus {
		return []ModuleStatus{
			{
				Name:         "svc-neo-node",
				Domain:       "neo",
				Layer:        "infra",
				Capabilities: []string{"neo-ledger"},
				RequiresAPIs: []string{"rpc"},
				DependsOn:    []string{"store-postgres"},
			},
		}
	}

	handler := NewHandler(application, jam.Config{}, []string{}, nil, newAuditLog(10, nil), nil, modules)

	req := httptest.NewRequest(http.MethodGet, "/system/descriptors", nil)
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}

	var descr []core.Descriptor
	if err := json.Unmarshal(resp.Body.Bytes(), &descr); err != nil {
		t.Fatalf("unmarshal descriptors: %v", err)
	}
	var found bool
	for _, d := range descr {
		if d.Name == "svc-neo-node" {
			found = true
			if d.Layer != core.LayerInfra {
				t.Fatalf("expected infra layer, got %s", d.Layer)
			}
			if len(d.RequiresAPIs) == 0 || d.RequiresAPIs[0] != "rpc" {
				t.Fatalf("expected requires api rpc, got %+v", d.RequiresAPIs)
			}
			if len(d.DependsOn) == 0 || d.DependsOn[0] != "store-postgres" {
				t.Fatalf("expected depends_on propagated, got %+v", d.DependsOn)
			}
		}
	}
	if !found {
		t.Fatalf("expected module descriptors to include engine module")
	}
}
