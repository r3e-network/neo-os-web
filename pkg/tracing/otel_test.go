package tracing

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/sdk/trace"
)

func TestOTelTracer_StartSpan(t *testing.T) {
	provider := trace.NewTracerProvider()
	otel.SetTracerProvider(provider)

	tracer := NewOTelTracer(provider, "test")
	ctx, finish := tracer.StartSpan(context.Background(), "operation", map[string]string{
		"key": "value",
	})
	if ctx == nil {
		t.Fatal("expected context from StartSpan")
	}
	finish(nil)
}

func TestConvertAttrs(t *testing.T) {
	attrs := convertAttrs(map[string]string{" foo ": "bar"})
	if len(attrs) != 1 || attrs[0] != attribute.String("foo", "bar") {
		t.Fatalf("unexpected attrs: %#v", attrs)
	}
}
