# Trusted Execution Environment (TEE) Implementation

## Overview

The Neo N3 Service Layer utilizes Azure Confidential Computing to provide Trusted Execution Environment (TEE) capabilities. This document outlines the implementation details of the TEE components within the service.

## Azure Confidential Computing

Azure Confidential Computing (ACC) provides hardware-based TEE capabilities that ensure:

- Code and data are protected while in use
- Code execution is verifiable via attestation
- Secrets can be securely managed within the TEE

We leverage Azure's DCsv3-series virtual machines which feature Intel SGX (Software Guard Extensions) technology.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Host OS                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 TEE Container                        │    │
│  │                                                      │    │
│  │  ┌────────────────┐   ┌───────────────────────────┐ │    │
│  │  │                │   │                           │ │    │
│  │  │ JS Runtime     │   │ Secure Secret Storage     │ │    │
│  │  │                │   │                           │ │    │
│  │  └────────────────┘   └───────────────────────────┘ │    │
│  │                                                      │    │
│  │  ┌────────────────┐   ┌───────────────────────────┐ │    │
│  │  │                │   │                           │ │    │
│  │  │ Attestation    │   │ Secure Network Interface  │ │    │
│  │  │ Service        │   │                           │ │    │
│  │  └────────────────┘   └───────────────────────────┘ │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. TEE Container

A Docker container running in the SGX-enabled VM that provides the TEE environment. The container is configured to leverage Intel SGX enclaves.

### 2. JavaScript Runtime

A secure JavaScript execution environment running within the TEE:

- V8 JavaScript engine with SGX support
- Sandboxed execution environment
- Limited standard library access
- Resource usage monitoring and limitations

### 3. Secure Secret Storage

A system for securely managing user secrets within the TEE:

- Secrets are encrypted at rest using keys only available in the TEE
- Secrets are only decrypted within the TEE memory during function execution
- Access control ensures only authorized functions can access specific secrets

### 4. Attestation Service

A service that provides cryptographic proof that:

- The TEE is genuine and running on trusted hardware
- The correct code is running within the TEE
- The TEE has not been tampered with

### 5. Secure Network Interface

A component that handles secure communication between:

- The TEE and external services
- The TEE and the Neo N3 blockchain
- The TEE and the rest of the service layer

## Implementation Details

### TEE Initialization

1. The TEE container is launched on an SGX-enabled VM
2. The container initializes the SGX enclave
3. The attestation service generates a report proving the TEE's authenticity
4. The main service verifies the attestation report
5. Secure communication channels are established

### Function Execution in TEE

1. The user submits a function for execution
2. The service validates the function and permissions
3. The function source code and parameters are securely transferred to the TEE
4. Required secrets are decrypted within the TEE
5. The JavaScript runtime executes the function in a sandboxed environment
6. Execution results are securely returned to the main service
7. Temporary data is securely wiped from memory

### Secret Management

1. User submits a secret via encrypted channel
2. Service validates user authentication and authorization
3. Secret is transferred to the TEE
4. TEE generates a data encryption key (DEK)
5. Secret is encrypted with the DEK
6. DEK is sealed to the TEE (can only be unsealed within the same TEE)
7. Encrypted secret is stored in the database

### Security Considerations

1. **Memory Protection**
   - All sensitive data within the TEE is protected from external access
   - Memory is securely wiped after use

2. **Side-Channel Protections**
   - Implementation includes mitigations for known side-channel attacks
   - Regular security updates for the TEE components

3. **Network Security**
   - All communication with the TEE uses TLS 1.3
   - Certificate pinning for additional security

4. **Code Integrity**
   - Function code is validated before execution
   - JavaScript runtime is patched against known vulnerabilities

5. **Resource Limitations**
   - Functions have strict memory and CPU limits
   - Timeouts prevent infinite loops or resource exhaustion

## Azure TEE Configuration

### VM Configuration

- VM Size: DC4s_v3 (4 vCPUs, 16 GB memory, 8 GB enclave memory)
- OS: Ubuntu 20.04 LTS
- Region: East US (ensure SGX support in the selected region)

### Container Configuration

```yaml
version: '3.4'
services:
  tee-service:
    image: servicelayer/tee-runtime:latest
    devices:
      - /dev/sgx_enclave:/dev/sgx_enclave
      - /dev/sgx_provision:/dev/sgx_provision
    environment:
      - SGX_ENABLED=1
      - ATTESTATION_URL=https://shareduks.uks.attest.azure.net
    volumes:
      - ./config:/app/config
    ports:
      - "8000:8000"
    restart: unless-stopped
```

## Attestation Process

The attestation process ensures that the TEE is genuine and running the correct code:

1. TEE generates an attestation request
2. Request is sent to the Azure Attestation Service
3. Attestation Service validates the SGX quote
4. Attestation Service returns a token signed with its private key
5. Token is validated by the main service
6. Secure communication is established based on the token

## JavaScript Runtime Security

The JavaScript runtime within the TEE is secured by:

1. Removing unsafe APIs (e.g., `eval`, `Function` constructor)
2. Limiting file system access
3. Restricting network access to whitelisted endpoints
4. Applying resource quotas (memory, CPU)
5. Timing out long-running operations
6. Sanitizing inputs and outputs

## Secret Usage in Functions

Secrets are securely accessed within functions:

```javascript
// Example function using secrets
function fetchPriceData(token) {
  // Access to secrets is provided via a secure API
  const apiKey = secrets.get('exchange_api_key');
  
  // Use the secret to make an authenticated request
  const response = fetch(`https://api.exchange.com/prices/${token}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  
  return response.json();
}
```

The `secrets.get()` API only retrieves secrets that have been explicitly allowed for the function, and the secret value is only accessible within the TEE.

## Monitoring and Auditing

The TEE implementation includes:

1. Secure logging of TEE operations (non-sensitive data only)
2. Performance monitoring of the TEE environment
3. Audit trails for all secret access
4. Health checks for the TEE components
5. Alerting for potential security issues