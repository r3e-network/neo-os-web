package contracts

import (
	"context"
	"testing"

	"github.com/R3E-Network/service_layer/system/framework"
	core "github.com/R3E-Network/service_layer/system/framework/core"
)

type stubTracer struct {
	name string
}

func (stubTracer) StartSpan(ctx context.Context, name string, attrs map[string]string) (context.Context, func(error)) {
	return ctx, func(error) {}
}

func TestServiceSetEnvironmentAppliesTracer(t *testing.T) {
	svc := New(nil, nil, nil)
	envTracer := stubTracer{name: "env"}
	svc.SetEnvironment(framework.Environment{Tracer: envTracer})
	if svc.dispatchTracer() != envTracer {
		t.Fatalf("expected dispatch tracer to match environment tracer")
	}
}

func TestServiceWithTracerOverridesEnvironment(t *testing.T) {
	svc := New(nil, nil, nil)
	envTracer := stubTracer{name: "env"}
	svc.SetEnvironment(framework.Environment{Tracer: envTracer})

	custom := stubTracer{name: "custom"}
	svc.WithTracer(custom)
	if svc.dispatchTracer() != custom {
		t.Fatalf("expected custom tracer to be applied")
	}

	// Re-applying environment should not override explicit tracer
	svc.SetEnvironment(framework.Environment{Tracer: stubTracer{name: "env2"}})
	if svc.dispatchTracer() != custom {
		t.Fatalf("expected custom tracer to persist after environment change")
	}

	// Reset to environment tracer when WithTracer(nil) called
	svc.WithTracer(nil)
	if svc.dispatchTracer() == custom {
		t.Fatalf("expected custom tracer to be cleared")
	}
	if svc.dispatchTracer().(stubTracer).name != "env2" {
		t.Fatalf("expected environment tracer to be re-applied")
	}
}

func (s *Service) dispatchTracer() core.Tracer {
	return s.dispatch.Tracer()
}
