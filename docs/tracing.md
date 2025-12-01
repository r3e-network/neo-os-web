# Tracing (OTLP / OpenTelemetry)

Service Layer emits distributed traces for service operations (dispatcher spans, bus calls, etc.) so you can visualize request lifecycles and measure latency across the engine. Tracing is disabled by default; enable it by pointing the engine at an OTLP collector (Jaeger, Tempo, OTEL Collector, etc.).

## Configuration

Tracing is configured via `config.tracing` (YAML/JSON) or environment variables / CLI flags.

| Option | ENV / Flag | Description |
|--------|------------|-------------|
| `tracing.endpoint` | `TRACING_OTLP_ENDPOINT`, `--otlp-endpoint` | OTLP gRPC endpoint (host:port). Required to enable tracing. |
| `tracing.insecure` | `TRACING_OTLP_INSECURE`, `--otlp-insecure` | Use plaintext/insecure gRPC (default false). |
| `tracing.service_name` | `TRACING_SERVICE_NAME`, `--otlp-service-name` | Overrides the service name reported to OTLP. Defaults to `service-layer`. |
| `tracing.resource_attributes` | `TRACING_OTLP_ATTRIBUTES`, `--otlp-attrs` | Comma-separated resource attributes (`key=value,key2=value2`). |

Example:

```yaml
tracing:
  endpoint: otel-collector:4317
  insecure: true
  service_name: service-layer
  resource_attributes:
    env: prod
    region: us-east-1
```

Environment variables:

```bash
TRACING_OTLP_ENDPOINT=otel-collector:4317
TRACING_OTLP_INSECURE=true
TRACING_SERVICE_NAME=service-layer
TRACING_OTLP_ATTRIBUTES=env=prod,region=us-east-1
```

Command-line overrides (`cmd/appserver`):

```bash
go run ./cmd/appserver \
  --otlp-endpoint otel-collector:4317 \
  --otlp-insecure \
  --otlp-service-name service-layer \
  --otlp-attrs env=prod,region=us-east-1
```

## How it works

1. `cmd/appserver` loads tracing config and passes it to `applications.EngineAppConfig`.
2. `NewEngineApplication` creates an OTLP exporter (`pkg/tracing/otlp.go`) when no tracer is supplied, installs it globally, and ensures the exporter shuts down gracefully.
3. The engine propagates the tracer into every package runtime so services can call `svc.Tracer()` or rely on dispatcher helpers.
4. Service packages (contracts, datalink, ccip, vrf, etc.) automatically pick up the environment tracer and emit spans for dispatch operations. They can still override tracing with `WithTracer`.

## Verifying traces

Once configured, trigger some Service Layer operations (e.g., create a datalink channel or VRF request) and inspect your OTEL backend. You should see spans named after dispatcher operations (`ccip.dispatch`, `datalink.delivery`, etc.) with resource attributes set as configured.
