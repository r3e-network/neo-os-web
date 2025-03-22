# TEE Deployment Guide

This document outlines the process for deploying the TEE (Trusted Execution Environment) components of the Neo N3 Service Layer on Azure Confidential Computing.

## Prerequisites

- Azure account with subscription that supports Confidential Computing
- Azure CLI installed and configured
- Docker installed and configured
- Access to the Azure portal

## Azure Setup

### 1. Enable Confidential Computing features

```bash
# Register the Confidential Computing provider
az feature register --namespace Microsoft.Compute --name DCsv3-Series

# Check registration status
az feature show --namespace Microsoft.Compute --name DCsv3-Series

# Once the status is "Registered", refresh the compute provider
az provider register --namespace Microsoft.Compute
```

### 2. Create a Resource Group

```bash
# Create a resource group for the TEE resources
az group create --name neo-service-tee --location eastus
```

### 3. Create a Virtual Network

```bash
# Create a virtual network for the TEE resources
az network vnet create \
  --resource-group neo-service-tee \
  --name tee-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name tee-subnet \
  --subnet-prefix 10.0.0.0/24
```

### 4. Create a Network Security Group

```bash
# Create a network security group for the TEE resources
az network nsg create \
  --resource-group neo-service-tee \
  --name tee-nsg

# Allow inbound on port 8000 (TEE API)
az network nsg rule create \
  --resource-group neo-service-tee \
  --nsg-name tee-nsg \
  --name allow-tee-api \
  --priority 1000 \
  --destination-port-ranges 8000 \
  --protocol tcp
```

### 5. Create an SGX-enabled Virtual Machine

```bash
# Create a DCsv3-series VM with SGX support
az vm create \
  --resource-group neo-service-tee \
  --name tee-vm \
  --image Canonical:UbuntuServer:18.04-LTS:latest \
  --size Standard_DC4s_v3 \
  --vnet-name tee-vnet \
  --subnet tee-subnet \
  --nsg tee-nsg \
  --public-ip-address tee-ip \
  --authentication-type password \
  --admin-username neoadmin \
  --admin-password "SecureP@ssw0rd"
```

## SGX Setup on the VM

### 1. Connect to the VM

```bash
# SSH into the VM
ssh neoadmin@<VM_PUBLIC_IP>
```

### 2. Install SGX Driver and SDK

```bash
# Update packages
sudo apt update
sudo apt upgrade -y

# Install prerequisites
sudo apt install -y build-essential python

# Download and install the SGX driver
wget https://download.01.org/intel-sgx/sgx-linux/2.14/distro/ubuntu18.04-server/sgx_linux_x64_driver_2.11.0_2d2b795.bin
chmod +x sgx_linux_x64_driver_2.11.0_2d2b795.bin
sudo ./sgx_linux_x64_driver_2.11.0_2d2b795.bin

# Install the SGX SDK
wget https://download.01.org/intel-sgx/sgx-linux/2.14/distro/ubuntu18.04-server/sgx_linux_x64_sdk_2.14.100.2.bin
chmod +x sgx_linux_x64_sdk_2.14.100.2.bin
sudo ./sgx_linux_x64_sdk_2.14.100.2.bin --prefix=/opt/intel

# Install the SGX PSW
echo 'deb [arch=amd64] https://download.01.org/intel-sgx/sgx_repo/ubuntu bionic main' | sudo tee /etc/apt/sources.list.d/intel-sgx.list
wget -qO - https://download.01.org/intel-sgx/sgx_repo/ubuntu/intel-sgx-deb.key | sudo apt-key add -
sudo apt update
sudo apt install -y libsgx-enclave-common libsgx-urts libsgx-uae-service libsgx-dcap-ql
```

### 3. Install Docker

```bash
# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce

# Add user to Docker group
sudo usermod -aG docker neoadmin
newgrp docker
```

## Deploying the TEE Container

### 1. Create a Configuration Directory

```bash
# Create a configuration directory
mkdir -p ~/tee-config
```

### 2. Create Configuration Files

Create a `.env` file in the `~/tee-config` directory:

```bash
cat > ~/tee-config/.env << EOF
# TEE Configuration
TEE_PROVIDER=azure
SGX_ENABLED=1
ATTESTATION_URL=https://shareduks.uks.attest.azure.net
ATTESTATION_INSTANCE=neo-service
ATTESTATION_REGION=eastus
ATTESTATION_SCOPE=https://attest.azure.net/.default

# Runtime Configuration
JS_MEMORY_LIMIT=256
EXECUTION_TIMEOUT=30

# Service Configuration
TEE_API_PORT=8000
EOF
```

### 3. Create a Docker Compose File

```bash
cat > ~/tee-config/docker-compose.yml << EOF
version: '3.4'
services:
  tee-service:
    image: neoservice/tee-runtime:latest
    devices:
      - /dev/sgx_enclave:/dev/sgx_enclave
      - /dev/sgx_provision:/dev/sgx_provision
    environment:
      - SGX_ENABLED=1
      - ATTESTATION_URL=\${ATTESTATION_URL}
      - ATTESTATION_INSTANCE=\${ATTESTATION_INSTANCE}
      - ATTESTATION_REGION=\${ATTESTATION_REGION}
      - ATTESTATION_SCOPE=\${ATTESTATION_SCOPE}
      - JS_MEMORY_LIMIT=\${JS_MEMORY_LIMIT}
      - EXECUTION_TIMEOUT=\${EXECUTION_TIMEOUT}
    volumes:
      - ./config:/app/config
    ports:
      - "\${TEE_API_PORT}:8000"
    restart: unless-stopped
EOF
```

### 4. Build the TEE Container

Create a Dockerfile for the TEE container in the same directory:

```bash
cat > ~/tee-config/Dockerfile << EOF
FROM ubuntu:20.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libcurl4-openssl-dev \
    libprotobuf-dev \
    libssl-dev \
    pkg-config \
    python3 \
    wget \
    && apt-get clean

# Install Go
RUN wget https://golang.org/dl/go1.17.2.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.17.2.linux-amd64.tar.gz \
    && rm go1.17.2.linux-amd64.tar.gz
ENV PATH=$PATH:/usr/local/go/bin

# Install SGX SDK
RUN mkdir -p /opt/intel
WORKDIR /opt/intel
RUN wget https://download.01.org/intel-sgx/sgx-linux/2.14/distro/ubuntu20.04-server/sgx_linux_x64_sdk_2.14.100.2.bin \
    && chmod +x sgx_linux_x64_sdk_2.14.100.2.bin \
    && echo 'yes' | ./sgx_linux_x64_sdk_2.14.100.2.bin \
    && rm sgx_linux_x64_sdk_2.14.100.2.bin
ENV SGX_SDK=/opt/intel/sgxsdk
ENV PATH=$PATH:$SGX_SDK/bin:$SGX_SDK/bin/x64
ENV PKG_CONFIG_PATH=$PKG_CONFIG_PATH:$SGX_SDK/pkgconfig
ENV LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$SGX_SDK/sdk_libs

# Create app directory
WORKDIR /app

# Copy application files
COPY . .

# Build the application
RUN cd /app && go build -o tee-service ./cmd/tee

# Expose port
EXPOSE 8000

# Set the entry point
ENTRYPOINT ["/app/tee-service"]
EOF
```

### 5. Build and Push the Container

On your development machine, build and push the Docker image:

```bash
# Build the Docker image
docker build -t neoservice/tee-runtime:latest .

# Push the image to a container registry
docker push neoservice/tee-runtime:latest
```

### 6. Pull and Run the Container on the VM

```bash
# Pull the Docker image
docker pull neoservice/tee-runtime:latest

# Run the container using Docker Compose
cd ~/tee-config
docker-compose up -d
```

## Azure Attestation Service Setup

### 1. Create an Attestation Provider

```bash
# Create an attestation provider
az attestation provider create \
  --resource-group neo-service-tee \
  --name neo-service \
  --location eastus
```

### 2. Get the Attestation URL

```bash
# Get the attestation URL
az attestation provider show \
  --resource-group neo-service-tee \
  --name neo-service \
  --query attestUri \
  --output tsv
```

## Integration with Main Service

### 1. Configure the Service Layer

Update the main service configuration to point to the TEE service:

```yaml
tee:
  provider: azure
  azure:
    url: http://<TEE_VM_IP>:8000
    attestation:
      instance: neo-service
      region: eastus
      scope: https://attest.azure.net/.default
    runtime:
      jsMemoryLimit: 256
      executionTimeout: 30
```

### 2. Test the Integration

Use the following command to test the integration:

```bash
curl -X POST http://<MAIN_SERVICE_IP>/api/v1/tee/status
```

The response should include the attestation status, indicating if the TEE is valid and secure.

## Monitoring and Management

### 1. View TEE Container Logs

```bash
# View the logs of the TEE container
docker logs -f tee-config_tee-service_1
```

### 2. Update the TEE Container

```bash
# Pull the latest version of the container
docker pull neoservice/tee-runtime:latest

# Restart the container
cd ~/tee-config
docker-compose down
docker-compose up -d
```

### 3. Monitor the TEE Service

```bash
# Check the status of the TEE service
curl -X GET http://localhost:8000/status
```

## Security Considerations

1. **Access Control**: Limit SSH access to the VM to authorized IPs only.
2. **Network Security**: Use Azure Network Security Groups to restrict traffic to the TEE VM.
3. **Regular Updates**: Keep the SGX driver, SDK, and TEE service up to date.
4. **Attestation Validation**: Regularly validate the attestation of the TEE service.
5. **Key Management**: Use Azure Key Vault to manage encryption keys.
6. **Secrets Management**: Use Azure Managed Identity for secure access to Azure resources.

## Troubleshooting

### 1. SGX Device Not Found

If the SGX device files are not found, ensure the SGX driver is installed correctly:

```bash
# Check if SGX device files exist
ls -la /dev/sgx*

# If not found, reinstall the SGX driver
sudo ./sgx_linux_x64_driver_2.11.0_2d2b795.bin
```

### 2. Attestation Failures

If attestation fails, check the attestation provider configuration:

```bash
# Verify the attestation provider exists
az attestation provider show \
  --resource-group neo-service-tee \
  --name neo-service
```

### 3. Container Fails to Start

If the container fails to start, check for permission issues:

```bash
# Check if the container has permission to access SGX devices
docker run --rm \
  --device /dev/sgx_enclave:/dev/sgx_enclave \
  --device /dev/sgx_provision:/dev/sgx_provision \
  -e SGX_ENABLED=1 \
  neoservice/tee-runtime:latest \
  ls -la /dev/sgx*
```

## References

- [Azure Confidential Computing Documentation](https://docs.microsoft.com/en-us/azure/confidential-computing/)
- [Intel SGX Documentation](https://software.intel.com/content/www/us/en/develop/topics/software-guard-extensions.html)
- [Azure Attestation Service Documentation](https://docs.microsoft.com/en-us/azure/attestation/) 