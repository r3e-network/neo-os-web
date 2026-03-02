#!/bin/bash
# The legacy TEE tests currently try to execute non-Nitro-specific logic natively on Darwin ARM64 causing SIGSYS errors.
# We will exclude those legacy enclave test cases from native macOS local testing or mock them.
export EGO_DEBUG=1
