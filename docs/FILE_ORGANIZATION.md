# File Organization

This document outlines the organization of files in the Service Layer project, particularly focusing on the recent reorganization of misplaced files.

## Directory Structure

The project follows this directory structure for different types of files:

```
service_layer/
├── api/                      # API specifications
│   └── swagger/              # OpenAPI/Swagger specification files
├── code_examples/            # Code examples for reference
│   └── wrapper/              # Examples for the wrapper pattern implementation
├── devops/                   # DevOps and deployment configuration
│   ├── helm/                 # Helm charts for Kubernetes
│   ├── kubernetes/           # Kubernetes manifests
│   ├── terraform/            # Infrastructure as code
│   ├── prometheus/           # Monitoring configuration
│   └── grafana/              # Dashboard configurations
├── docs/                     # Documentation
│   ├── architecture/         # Architecture documentation
│   ├── implementation_status/ # Implementation status documents
│   ├── performance/          # Performance documentation
│   ├── testing/              # Testing documentation
│   └── ...                   # Other documentation categories
└── internal/                 # Internal code
    ├── api/                  # API handlers
    ├── core/                 # Core business logic
    ├── ...                   # Other internal packages
```

## Key Directory Purposes

### `api/`
The `api` directory is kept separate at the root level because:
- It defines the contract between the service and its clients
- It's a core part of the service definition, not just a deployment concern
- It's used by developers implementing and consuming the API
- It serves as the source of truth for API documentation

### `devops/`
The `devops` directory contains infrastructure and operational concerns:
- Deployment configurations (Kubernetes, Helm)
- Infrastructure as code (Terraform)
- Monitoring and observability setup (Prometheus, Grafana)
- Container definitions (Dockerfile, docker-compose)

These are kept separate from API specifications as they serve different purposes and are used by different personas (operations engineers vs application developers).

## Recent File Moves

The following files were moved to more appropriate locations:

| Original Location | New Location | Description |
|-------------------|--------------|-------------|
| `docs/examples/PRICEFEED_WRAPPER_EXAMPLE.go` | `code_examples/wrapper/pricefeed_wrapper_example.go` | Example implementation of the PriceFeed wrapper pattern |
| `docs/api/*.yaml` | `api/swagger/` | OpenAPI/Swagger specification files for all service endpoints |

## File Type Guidelines

To maintain organization, please follow these guidelines:

1. **Code Files** (.go, .js, etc.):
   - Should be placed in appropriate code directories (`internal/`, `pkg/`, `cmd/`, `code_examples/`)
   - Should NOT be placed in `docs/`

2. **API Specifications** (.yaml, .json for OpenAPI/Swagger):
   - Should be placed in `api/swagger/`
   - These files are used to generate API documentation and clients
   - Should NOT be placed in `devops/` as they define the API contract, not deployment

3. **DevOps Files**:
   - Infrastructure as code, deployment configurations, monitoring setup
   - Should be placed in `devops/` with appropriate subdirectories
   - Examples: Terraform files, Kubernetes manifests, Helm charts

4. **Documentation** (.md):
   - Should be placed in `docs/` with appropriate subdirectories
   - Use meaningful filenames with `.md` extension
   - Use consistent formatting (prefer lowercase filenames with underscores)

5. **Configuration Files** (.yaml, .json, .toml):
   - Should be placed in `config/` or the appropriate service directory
   - Should NOT be placed in `docs/`

## Best Practices

1. **Keep Documentation Separate from Code**:
   - Documentation should describe functionality, not contain it
   - Code examples referenced in documentation should be in appropriate code directories

2. **Use Documentation for Documentation**:
   - Use Markdown for documentation
   - Reference code examples rather than embedding large code blocks
   - Keep documentation up-to-date with code changes

3. **Organize API Specifications**:
   - Keep all API specifications in `api/swagger/`
   - These files are the source of truth for API documentation
   - They should be versioned alongside the code

4. **Centralize DevOps Configurations**:
   - Keep all deployment and infrastructure configurations in `devops/`
   - Organize by tool or purpose (Kubernetes, Terraform, monitoring)
   - Include README files explaining usage