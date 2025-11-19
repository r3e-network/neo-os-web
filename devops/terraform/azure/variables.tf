variable "prefix" {
  description = "Prefix for all resources"
  type        = string
  default     = "neon3sl"
}

variable "location" {
  description = "Azure region to deploy resources"
  type        = string
  default     = "East US"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    environment = "production"
    project     = "neo-n3-service-layer"
    managed-by  = "terraform"
  }
}

variable "kubernetes_version" {
  description = "Kubernetes version to use"
  type        = string
  default     = "1.25.5"
}

variable "node_count" {
  description = "Initial node count for the default node pool"
  type        = number
  default     = 3
}

variable "node_count_min" {
  description = "Minimum node count for the default node pool"
  type        = number
  default     = 3
}

variable "node_count_max" {
  description = "Maximum node count for the default node pool"
  type        = number
  default     = 10
}

variable "vm_size" {
  description = "VM size for the default node pool"
  type        = string
  default     = "Standard_DS3_v2"
}

variable "confidential_node_count" {
  description = "Initial node count for the confidential node pool"
  type        = number
  default     = 2
}

variable "confidential_node_count_min" {
  description = "Minimum node count for the confidential node pool"
  type        = number
  default     = 2
}

variable "confidential_node_count_max" {
  description = "Maximum node count for the confidential node pool"
  type        = number
  default     = 5
}

variable "confidential_vm_size" {
  description = "VM size for the confidential node pool"
  type        = string
  default     = "Standard_DC2s_v2"  # Confidential computing VM size with SGX support
}

variable "db_admin_username" {
  description = "Admin username for the PostgreSQL server"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "db_admin_password" {
  description = "Admin password for the PostgreSQL server"
  type        = string
  sensitive   = true
} 