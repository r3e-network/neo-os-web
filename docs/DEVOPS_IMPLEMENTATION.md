# DevOps Implementation Documentation

This document details the implementation of the DevOps infrastructure for the Neo N3 Service Layer project.

## Table of Contents

1. [CI/CD Pipeline](#cicd-pipeline)
2. [Kubernetes Deployment with Helm](#kubernetes-deployment-with-helm)
3. [Infrastructure as Code with Terraform](#infrastructure-as-code-with-terraform)
4. [Monitoring and Observability](#monitoring-and-observability)
5. [Environment Configuration](#environment-configuration)
6. [Security Practices](#security-practices)

## CI/CD Pipeline

The CI/CD pipeline is implemented using GitHub Actions and is defined in `.github/workflows/ci-cd.yml`. The pipeline automates the build, test, and deployment processes for the Service Layer.

### Pipeline Stages

1. **Setup**: Prepares the environment for building and testing
   - Sets up Go
   - Caches Go modules for faster builds

2. **Lint**: Ensures code quality
   - Runs `golangci-lint` to check Go code
   - Validates Helm charts with `chart-testing`

3. **Build**: Compiles the code
   - Builds the application
   - Creates artifacts for deployment

4. **Tests**: Validates the application
   - Unit tests with code coverage reporting
   - Integration tests with database integration
   - Security scanning with multiple tools
   - Performance testing with k6

5. **Packaging**:
   - Builds Docker images
   - Packages Helm charts

6. **Deployment**:
   - Deploys to staging environment from the `develop` branch
   - Deploys to production environment from the `main` branch
   - Uses Helm for Kubernetes deployments

7. **Notification**:
   - Sends deployment status notifications to Slack

### Automated Workflow Triggers

The pipeline is triggered by:
- Pushes to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual workflow dispatch with environment selection

### Example: Running a Manual Deployment

To manually trigger a deployment:
1. Go to Actions in the GitHub repository
2. Select the "Neo N3 Service Layer CI/CD" workflow
3. Click "Run workflow"
4. Select the target environment (staging or production)
5. Click "Run workflow"

## Kubernetes Deployment with Helm

Helm is used to manage Kubernetes deployments. The Helm chart is located in `devops/helm/service-layer/`.

### Chart Structure

- `Chart.yaml`: Metadata about the chart
- `values.yaml`: Default configuration values
- `templates/`: Kubernetes manifest templates
- `environments/`: Environment-specific values

### Key Components

- **Deployment**: Manages the Service Layer application pods
- **Service**: Exposes the application within the cluster
- **Ingress**: Exposes the application externally
- **ConfigMap**: Stores application configuration
- **Secrets**: Stores sensitive data like passwords and keys
- **PersistentVolumeClaim**: Provides persistent storage

### Dependencies

The chart includes the following dependencies:
- PostgreSQL: Database for the service
- Prometheus: Metrics collection
- Grafana: Dashboards and monitoring

### Deployment Commands

To deploy the application with Helm:

```bash
# Staging deployment
helm upgrade --install service-layer ./service-layer \
  --namespace service-layer \
  --create-namespace \
  --values service-layer/values.yaml \
  --values service-layer/environments/staging.yaml

# Production deployment
helm upgrade --install service-layer ./service-layer \
  --namespace service-layer \
  --create-namespace \
  --values service-layer/values.yaml \
  --values service-layer/environments/production.yaml
```

## Infrastructure as Code with Terraform

Terraform is used to provision the cloud infrastructure. The configuration is located in `devops/terraform/azure/`.

### Resources Provisioned

- **Virtual Network**: Network infrastructure for the services
- **AKS Cluster**: Kubernetes cluster for containerized workloads
- **Confidential Computing Node Pool**: Specialized nodes with TEE/SGX support
- **Azure Container Registry**: Registry for Docker images
- **Azure Key Vault**: Secure storage for secrets and keys
- **PostgreSQL Database**: Managed database service
- **Azure Attestation Provider**: Attestation for confidential computing

### Terraform Modules

The Terraform configuration is organized in the following files:
- `main.tf`: Primary infrastructure resources
- `variables.tf`: Input variables
- `outputs.tf`: Output values
- `environments/`: Environment-specific variable values

### Deployment Commands

To deploy the infrastructure with Terraform:

```bash
# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -var-file=environments/staging.tfvars -out=plan.tfplan

# Apply the changes
terraform apply plan.tfplan
```

## Monitoring and Observability

The Service Layer includes a comprehensive monitoring stack:

### Components

1. **Prometheus**: 
   - Collects metrics from the application and infrastructure
   - Stores time-series data
   - Provides alerting capabilities

2. **Grafana**:
   - Visualizes metrics from Prometheus
   - Provides pre-configured dashboards
   - Enables custom dashboard creation

3. **Custom Dashboards**:
   - `service-layer-overview.json`: General service metrics
   - CPU, memory, and resource utilization
   - API request rates and latencies
   - Function execution metrics

4. **Health Endpoints**:
   - `/health/liveness`: Confirms the service is running
   - `/health/readiness`: Confirms the service is ready to handle requests

### Metrics Collected

- HTTP request counts and latencies
- Function execution counts and durations
- Resource utilization (CPU, memory)
- Database connection metrics
- Custom business metrics

## Environment Configuration

The Service Layer supports multiple deployment environments with distinct configurations:

### Development

- Local development environment
- Minimal resource requirements
- Debugging enabled
- No auto-scaling
- Local or containerized database

### Staging

- Pre-production environment
- Moderate resource allocation
- Debugging enabled
- Basic auto-scaling
- Full monitoring setup
- Isolated database instances

### Production

- Production environment
- High resource allocation
- Production-level logging
- Advanced auto-scaling
- Redundancy for high availability
- Database replication enabled

### Configuration Management

Configuration is managed through:
1. **Base values.yaml**: Default configuration
2. **Environment-specific values**: Override defaults
3. **Kubernetes ConfigMaps**: Application configuration
4. **Kubernetes Secrets**: Sensitive information

## Security Practices

Security is integrated throughout the DevOps pipeline:

### Security Scanning

1. **Static Analysis**: 
   - `gosec` for Go code security issues
   - `golangci-lint` for code quality

2. **Dependency Scanning**:
   - `nancy` for vulnerability scanning in dependencies
   - Dependabot for automated dependency updates

3. **Secret Detection**:
   - `gitleaks` for detecting secrets in the codebase
   - Prevents accidental secret commits

4. **Container Scanning**:
   - `trivy` for Docker image vulnerability scanning
   - Identifies vulnerabilities in images before deployment

### Secure Configuration

1. **Secrets Management**:
   - Kubernetes Secrets for sensitive data
   - Azure Key Vault for long-term secret storage
   - Environment variables for runtime configuration

2. **Network Security**:
   - Network policies for pod-to-pod communication
   - Ingress controllers with TLS termination
   - Service mesh for advanced networking (planned)

3. **Identity and Access Management**:
   - RBAC for Kubernetes access control
   - Service principals for Azure resources
   - Managed identities for authentication

4. **Secure Build and Deployment**:
   - Image signing and verification
   - Immutable container images
   - Rolling updates for zero-downtime deployments 