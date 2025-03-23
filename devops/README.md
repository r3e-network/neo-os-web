# DevOps Infrastructure

This directory contains the DevOps infrastructure for the Neo N3 Service Layer project.

## Directory Structure

- `helm/` - Helm charts for Kubernetes deployment
- `terraform/` - Terraform configurations for cloud infrastructure
- `kubernetes/` - Kubernetes manifests
- `init-scripts/` - Initialization scripts
- `grafana/` - Grafana dashboards
- `prometheus/` - Prometheus configuration

## Environments

The infrastructure supports multiple environments:

1. **Development** - For local development
2. **Staging** - For testing and integration
3. **Production** - For production deployment

## Infrastructure Setup

### Terraform

The Terraform configuration in `terraform/azure/` provisions the following resources in Azure:

- Virtual Network with subnets
- AKS (Azure Kubernetes Service) cluster
- Node pools (including confidential computing nodes with TEE/SGX support)
- Azure Container Registry
- Azure Key Vault
- PostgreSQL database
- Azure Attestation Provider
- Log Analytics workspace

To deploy the infrastructure:

```bash
cd devops/terraform/azure
terraform init
terraform plan -var-file=environments/staging.tfvars -out=plan.tfplan
terraform apply plan.tfplan
```

### Helm Deployment

The Helm charts in `helm/service-layer/` deploy the service to Kubernetes.

To install/upgrade the Helm chart:

```bash
cd devops/helm
helm upgrade --install service-layer ./service-layer \
  --namespace service-layer \
  --create-namespace \
  --values service-layer/values.yaml \
  --values service-layer/environments/staging.yaml
```

## CI/CD Pipeline

The CI/CD pipeline is managed via GitHub Actions in `.github/workflows/ci-cd.yml`. The pipeline:

1. Builds the application
2. Runs tests
3. Performs security scans
4. Packages the Helm chart
5. Builds and pushes Docker images
6. Deploys to staging or production

## Monitoring

Monitoring is set up using:

- Prometheus for metrics collection
- Grafana for dashboards and visualization

The dashboards are available in the `grafana/dashboards/` directory. 