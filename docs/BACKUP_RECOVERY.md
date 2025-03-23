# Backup and Disaster Recovery Plan

This document outlines the backup and disaster recovery procedures for the Neo N3 Service Layer.

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Disaster Recovery Procedures](#disaster-recovery-procedures)
3. [Recovery Testing](#recovery-testing)
4. [Business Continuity](#business-continuity)

## Backup Strategy

The Service Layer implements a comprehensive backup strategy to ensure data durability and system recoverability.

### Database Backups

#### PostgreSQL Automated Backups

- **Frequency**: Daily full backups, hourly transaction log backups
- **Retention**: 7 days for daily backups, 24 hours for transaction logs
- **Storage**: Azure Storage with geo-replication
- **Encryption**: Data encrypted at rest and in transit
- **Automation**: Managed by Azure PostgreSQL service

Configuration in Terraform (`devops/terraform/azure/main.tf`):
```hcl
resource "azurerm_postgresql_server" "db" {
  # ... other configuration ...
  backup_retention_days = 7
  geo_redundant_backup_enabled = false  # Enable for production
  # ... other configuration ...
}
```

#### Manual Backup Procedures

For critical operations, manual backups should be performed:

1. **Pre-Deployment Backups**:
   ```bash
   # Backup before deployment
   pg_dump -U postgres -d service_layer > pre_deploy_backup_$(date +%Y%m%d).sql
   ```

2. **Data Migration Backups**:
   ```bash
   # Backup before schema changes
   pg_dump -U postgres -d service_layer --schema-only > schema_backup_$(date +%Y%m%d).sql
   ```

### Configuration Backups

All configuration is stored in version control, with specific environment configurations stored securely:

1. **Kubernetes Secrets**: Backed up using `kubectl`:
   ```bash
   kubectl get secret -n service-layer --export -o yaml > k8s_secrets_backup_$(date +%Y%m%d).yaml
   ```

2. **Azure Key Vault**: Backed up using Azure CLI:
   ```bash
   az keyvault backup start --vault-name ${KEY_VAULT_NAME} --storage-account-name ${STORAGE_ACCOUNT} --container-name backups
   ```

### State Backups

Terraform state is backed up to ensure infrastructure can be recovered:

1. **Remote State**: Stored in Azure Storage with versioning enabled
2. **State Backups**: Automated backups performed by CI/CD pipeline

## Disaster Recovery Procedures

The Service Layer implements a tiered disaster recovery strategy based on the severity of the incident.

### Tier 1: Service Disruption

For minor service disruptions with no data loss:

1. **Pod Recovery**:
   ```bash
   kubectl rollout restart deployment/service-layer -n service-layer
   ```

2. **Node Recovery**:
   ```bash
   # Drain affected node
   kubectl drain ${NODE_NAME} --ignore-daemonsets
   
   # Delete and recreate pod(s)
   kubectl delete pod ${POD_NAME} -n service-layer
   ```

### Tier 2: Data Corruption

For incidents involving data corruption:

1. **Database Point-in-Time Recovery**:
   ```bash
   # Using Azure Portal or Azure CLI
   az postgres server restore --resource-group myResourceGroup --name ${TARGET_SERVER_NAME} --source-server ${SOURCE_SERVER_NAME} --restore-point-in-time "2023-04-20T13:10:00Z"
   ```

2. **Update Application Configuration**:
   ```bash
   # Update database connection in Kubernetes ConfigMap
   kubectl edit configmap service-layer-config -n service-layer
   ```

### Tier 3: Complete Environment Failure

For catastrophic failures requiring full environment recovery:

1. **Infrastructure Restoration**:
   ```bash
   # Re-apply Terraform configuration
   cd devops/terraform/azure
   terraform init
   terraform apply -var-file=environments/production.tfvars
   ```

2. **Database Restoration**:
   ```bash
   # Restore from latest backup
   az postgres server restore --resource-group myResourceGroup --name ${TARGET_SERVER_NAME} --source-server ${SOURCE_SERVER_NAME} --restore-point-in-time "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
   ```

3. **Application Deployment**:
   ```bash
   # Redeploy application using Helm
   helm upgrade --install service-layer ./service-layer \
     --namespace service-layer \
     --create-namespace \
     --values service-layer/values.yaml \
     --values service-layer/environments/production.yaml
   ```

### Tier 4: Multi-Region Failover

For region-wide failures (future implementation):

1. **Traffic Redirection**:
   - Update DNS to point to secondary region
   - Activate global load balancer failover

2. **Database Failover**:
   - Trigger PostgreSQL replication failover to secondary region
   - Verify data consistency in secondary region

3. **Application Activation**:
   - Scale up application pods in secondary region
   - Verify functionality in secondary region

## Recovery Testing

Regular testing of disaster recovery procedures is essential to ensure they work when needed.

### Testing Schedule

- **Tier 1 Recovery**: Monthly testing
- **Tier 2 Recovery**: Quarterly testing
- **Tier 3 Recovery**: Semi-annual testing
- **Tier 4 Recovery**: Annual testing (when implemented)

### Testing Procedures

1. **Documentation Review**:
   - Review recovery documentation
   - Verify all procedures are up-to-date
   - Ensure access to all required tools and systems

2. **Tabletop Exercises**:
   - Walk through recovery scenarios
   - Identify potential gaps in procedures
   - Update documentation as needed

3. **Simulated Recovery**:
   - In staging environment, simulate disaster scenarios
   - Practice recovery procedures
   - Measure recovery time objectives (RTO) and recovery point objectives (RPO)

4. **Live Recovery Drills**:
   - In production-like environment, perform actual recovery
   - Verify functionality after recovery
   - Document lessons learned

## Business Continuity

Beyond technical recovery, these measures ensure business continuity:

### Communication Plan

1. **Internal Notification**:
   - Notify on-call engineers via PagerDuty
   - Escalate according to severity and SLA
   - Update internal status page

2. **External Communication**:
   - Update status page for external users
   - Provide estimated resolution time
   - Send regular updates as recovery progresses

### SLA Commitments

- **Tier 1 Incidents**: Recovery within 30 minutes
- **Tier 2 Incidents**: Recovery within 2 hours
- **Tier 3 Incidents**: Recovery within 8 hours
- **Tier 4 Incidents**: Recovery within 24 hours

### Documentation and Improvement

After any recovery operation:

1. Document the incident and response
2. Conduct post-mortem analysis
3. Update recovery procedures based on lessons learned
4. Implement preventive measures to avoid similar incidents