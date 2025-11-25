package httpapi

import (
	"context"
	"reflect"
	"testing"
	"time"

	engine "github.com/R3E-Network/service_layer/internal/engine"
)

func TestBuildModuleStatuses(t *testing.T) {
	start := time.Now().Add(-time.Minute)
	stop := time.Now()
	infos := []engine.ModuleInfo{
		{Name: "svc-one", Domain: "one", Category: "compute", Interfaces: []string{"compute"}, Notes: []string{"collision"}},
		{Name: "svc-two", Domain: "two", Category: "data", Interfaces: []string{"data"}},
	}
	health := []engine.ModuleHealth{
		{Name: "svc-one", Status: "started", ReadyStatus: "ready", StartedAt: &start, StartNanos: 123},
		{Name: "svc-two", Status: "failed", Error: "boom", ReadyStatus: "not-ready", StoppedAt: &stop, StopNanos: 456},
	}

	got := BuildModuleStatuses(infos, health)
	if len(got) != 2 {
		t.Fatalf("expected 2 module statuses, got %d", len(got))
	}
	first := got[0]
	if first.Name != "svc-one" || first.Status != "started" || first.Ready != "ready" || first.StartNanos != 123 || first.StartedAt == nil {
		t.Fatalf("unexpected first status: %+v", first)
	}
	if len(first.Notes) != 1 || first.Notes[0] != "collision" {
		t.Fatalf("expected notes propagated, got %+v", first.Notes)
	}
	second := got[1]
	if second.Name != "svc-two" || second.Status != "failed" || second.Error == "" || second.Ready != "not-ready" || second.StoppedAt == nil || second.StopNanos != 456 {
		t.Fatalf("unexpected second status: %+v", second)
	}
}

func TestEngineModuleProvider(t *testing.T) {
	var probed int
	eng := &stubEngine{
		infos: []engine.ModuleInfo{{Name: "svc-one", Domain: "one", Category: "compute", Interfaces: []string{"compute"}}},
		health: []engine.ModuleHealth{{
			Name:        "svc-one",
			Status:      "started",
			ReadyStatus: "ready",
		}},
		onProbe: func() { probed++ },
	}

	provider := EngineModuleProvider(eng)
	got := provider()
	if probed != 1 {
		t.Fatalf("expected ProbeReadiness called once, got %d", probed)
	}
	expected := []ModuleStatus{{
		Name:       "svc-one",
		Domain:     "one",
		Category:   "compute",
		Interfaces: []string{"compute"},
		Status:     "started",
		Ready:      "ready",
	}}
	if !reflect.DeepEqual(got, expected) {
		t.Fatalf("unexpected module statuses:\nexpected: %+v\ngot:      %+v", expected, got)
	}
}

type stubEngine struct {
	infos   []engine.ModuleInfo
	health  []engine.ModuleHealth
	onProbe func()
}

func (s *stubEngine) ProbeReadiness(ctx context.Context) {
	_ = ctx
	if s.onProbe != nil {
		s.onProbe()
	}
}

func (s *stubEngine) ModulesInfo() []engine.ModuleInfo     { return s.infos }
func (s *stubEngine) ModulesHealth() []engine.ModuleHealth { return s.health }

func TestSummarizeModuleLayers(t *testing.T) {
	input := []ModuleStatus{
		{Name: "svc-a", Layer: "service"},
		{Name: "svc-b", Layer: "runner"},
		{Name: "svc-c", Layer: "infra"},
		{Name: "svc-d", Layer: ""}, // default to service
	}
	got := summarizeModuleLayers(input)
	if len(got["service"]) != 2 || !contains(got["service"], "svc-a") || !contains(got["service"], "svc-d") {
		t.Fatalf("unexpected service layer grouping: %+v", got["service"])
	}
	if len(got["runner"]) != 1 || got["runner"][0] != "svc-b" {
		t.Fatalf("unexpected runner layer grouping: %+v", got["runner"])
	}
	if len(got["infra"]) != 1 || got["infra"][0] != "svc-c" {
		t.Fatalf("unexpected infra layer grouping: %+v", got["infra"])
	}
}

func contains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}
