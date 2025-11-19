# DevOps Infrastructure

Everything related to infrastructure lives in this directory. Treat the
[`Neo Service Layer Specification`](../docs/requirements.md) as the canonical
reference for operational requirements (regions, security postures, runbooks)
and use these files to implement those expectations. The directory is organised
so you can jump straight to the tooling you need:

## Directory Structure

- `terraform/` - Infrastructure as code (Azure by default). Each environment has
  a dedicated `environments/*.tfvars` file; update the spec first before adding
  or modifying inputs.
- `helm/` - Helm charts for Kubernetes deployment (appserver, dashboard, jobs).
- `kubernetes/` - Standalone manifests that complement Helm (e.g., secrets,
  ingress, or bootstrap jobs that do not warrant templating yet).
- `docker-compose.yml` / `Dockerfile` - Local orchestration to mirror staging.
- `grafana/` - Dashboards referenced by the observability section of the spec.
- `prometheus/` - Alerting and scrape configs kept in sync with Grafana boards.

## Environments

The infrastructure supports multiple environments:

1. **Development** - For local development
2. **Staging** - For testing and integration
3. **Production** - For production deployment

## Infrastructure Workflow

1. Describe changes in [`docs/requirements.md`](../docs/requirements.md) under the
   relevant infrastructure/operations sections.
2. Update Terraform variables (`devops/terraform/azure/environments/*`) if new
   inputs or secrets are required.
3. Apply Terraform so cluster foundations, Key Vault, and databases exist.
4. Deploy/upgrade the Helm chart and supporting manifests.
5. Import or update Grafana/Prometheus assets so dashboards and alerting match
   the documented runbooks.

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

## Monitoring & Alerting

- Prometheus scrapes the runtime plus supporting jobs. Update targets/alerts by
  editing `prometheus/`.
- Grafana dashboards live under `grafana/dashboards/`. Keep dashboards,
  Prometheus alerts, and the specification's SLO appendix in sync.
