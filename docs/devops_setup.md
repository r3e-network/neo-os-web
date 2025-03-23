# DevOps Setup for Service Layer

This document describes the DevOps setup for deploying and maintaining the Service Layer in different environments.

## Docker Setup

The Service Layer uses Docker for containerization, with multi-stage builds to minimize image size and improve security. The Dockerfile is located at `devops/Dockerfile`.

### Building the Docker Image

```bash
# Build the Docker image
docker build -t service_layer:latest -f devops/Dockerfile .

# Run the container
docker run -p 8080:8080 -v $(pwd)/config:/app/config service_layer:latest
```

### Docker Compose for Local Development

For local development, we provide a Docker Compose setup that includes:

- Service Layer API
- PostgreSQL database
- Neo N3 node
- Prometheus for metrics
- Grafana for dashboards

To start the local development environment:

```bash
cd devops
docker-compose up -d
```

This will start all services and expose:
- Service Layer API on port 8080
- PostgreSQL on port 5432
- Prometheus on port 9090
- Grafana on port 3000

## CI/CD Pipeline

The Service Layer uses GitHub Actions for CI/CD. The workflow file is located at `.github/workflows/ci.yml`.

### CI Pipeline

The CI pipeline consists of the following stages:

1. **Lint**: Run golangci-lint to check code quality
2. **Test**: Run unit tests with code coverage
3. **Security Scan**: Run security scans with gosec and trivy
4. **Build**: Build the binary and Docker image
5. **Deploy to Staging**: Deploy to the staging environment
6. **Deploy to Production**: Deploy to the production environment

### CD Pipeline

The CD pipeline automatically deploys to staging when changes are pushed to the main branch. Deployment to production requires manual approval.

## Kubernetes Deployment

The Service Layer is deployed to Kubernetes in staging and production environments. The Kubernetes configuration files are located in `devops/kubernetes/`.

### Kubernetes Resources

The following resources are created:

- **Namespace**: `service-layer`
- **Secrets**: Database credentials, JWT secret, encryption keys
- **ConfigMap**: Service configuration
- **Deployment**: Service Layer API pods
- **Service**: ClusterIP service for internal communication
- **Ingress**: Exposes the API to the internet with TLS
- **PersistentVolumeClaim**: For persistent data storage
- **HorizontalPodAutoscaler**: For auto-scaling based on CPU and memory usage

### Deploying to Kubernetes

```bash
# Apply the Kubernetes configuration
kubectl apply -f devops/kubernetes/deployment.yaml

# Check deployment status
kubectl -n service-layer get deployments
kubectl -n service-layer get pods
kubectl -n service-layer get services
```

## Monitoring and Observability

### Prometheus

Prometheus is used for metrics collection. The configuration file is located at `devops/prometheus/prometheus.yml`.

Key metrics collected:
- API request count and duration
- Function execution count and duration
- Memory usage
- Goroutine count
- Database connection stats

### Grafana

Grafana is used for visualization of metrics. The dashboards are located in `devops/grafana/dashboards/`.

Key dashboards:
- Service Overview: General service metrics
- Function Execution: Detailed function execution metrics
- Database Performance: Database metrics

### Alerting

Alerting rules are defined in `devops/prometheus/rules/service_layer_alerts.yml`. Alerts are sent for:

- High error rates
- Slow response times
- Memory usage spikes
- Too many goroutines
- Database connection issues

## Security Considerations

### Docker Security

- Multi-stage builds to minimize image size
- Non-root user for running the application
- Minimal alpine base image
- Security scanning during CI/CD

### Kubernetes Security

- Secrets for sensitive data
- Resource limits for all containers
- Network policies (to be added)
- Pod Security Policies (to be added)

### Application Security

- JWT tokens for authentication
- API rate limiting
- Input validation
- Secure secret storage

## Environment Configurations

### Development

- Log level: debug
- Log format: console
- Mock blockchain node

### Staging

- Log level: info
- Log format: json
- Test blockchain node

### Production

- Log level: info
- Log format: json
- Production blockchain node
- Higher resource limits
- Multiple replicas with auto-scaling

## Disaster Recovery

### Backup Strategy

- Database: Daily backups, point-in-time recovery
- Configuration: Version controlled in Git
- Wallet data: Encrypted backups

### Recovery Procedures

1. Database restoration from backup
2. Configuration redeployment from Git
3. Wallet data restoration from backups

## Future Improvements

1. Implement GitOps with Flux or ArgoCD
2. Add network policies for enhanced security
3. Implement canary deployments
4. Add distributed tracing with Jaeger or Zipkin
5. Implement chaos engineering for resilience testing