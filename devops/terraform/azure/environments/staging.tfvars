prefix              = "neon3sl-staging"
location            = "East US"
kubernetes_version  = "1.25.5"
node_count          = 2
node_count_min      = 2
node_count_max      = 5
vm_size             = "Standard_DS2_v2"

confidential_node_count     = 1
confidential_node_count_min = 1
confidential_node_count_max = 3
confidential_vm_size        = "Standard_DC2s_v2"

tags = {
  environment = "staging"
  project     = "neo-n3-service-layer"
  managed-by  = "terraform"
} 