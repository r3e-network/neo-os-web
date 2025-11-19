output "resource_group_name" {
  description = "The name of the resource group"
  value       = azurerm_resource_group.rg.name
}

output "kubernetes_cluster_name" {
  description = "The name of the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.name
}

output "kubernetes_cluster_id" {
  description = "The ID of the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.id
}

output "kubernetes_cluster_fqdn" {
  description = "The FQDN of the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.fqdn
}

output "client_certificate" {
  description = "The client certificate for the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.kube_config.0.client_certificate
  sensitive   = true
}

output "client_key" {
  description = "The client key for the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.kube_config.0.client_key
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "The cluster CA certificate for the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.kube_config.0.cluster_ca_certificate
  sensitive   = true
}

output "kube_config" {
  description = "The kube config for the Kubernetes cluster"
  value       = azurerm_kubernetes_cluster.aks.kube_config_raw
  sensitive   = true
}

output "host" {
  description = "The Kubernetes cluster server host"
  value       = azurerm_kubernetes_cluster.aks.kube_config.0.host
  sensitive   = true
}

output "container_registry_name" {
  description = "The name of the container registry"
  value       = azurerm_container_registry.acr.name
}

output "container_registry_login_server" {
  description = "The login server URL for the container registry"
  value       = azurerm_container_registry.acr.login_server
}

output "attestation_provider_name" {
  description = "The name of the attestation provider"
  value       = azurerm_attestation_provider.attestation.name
}

output "attestation_provider_attestation_uri" {
  description = "The attestation URI for the attestation provider"
  value       = azurerm_attestation_provider.attestation.attestation_uri
}

output "key_vault_name" {
  description = "The name of the Key Vault"
  value       = azurerm_key_vault.kv.name
}

output "key_vault_uri" {
  description = "The URI of the Key Vault"
  value       = azurerm_key_vault.kv.vault_uri
}

output "postgresql_server_name" {
  description = "The name of the PostgreSQL server"
  value       = azurerm_postgresql_server.db.name
}

output "postgresql_server_fqdn" {
  description = "The FQDN of the PostgreSQL server"
  value       = azurerm_postgresql_server.db.fqdn
}

output "database_name" {
  description = "The name of the PostgreSQL database"
  value       = azurerm_postgresql_database.service.name
}

output "confidential_node_pool_name" {
  description = "The name of the confidential node pool"
  value       = azurerm_kubernetes_cluster_node_pool.confidential.name
} 