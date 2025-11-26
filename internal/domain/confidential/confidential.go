package confidential

import appconf "github.com/R3E-Network/service_layer/internal/app/domain/confidential"

type (
	EnclaveStatus = appconf.EnclaveStatus
	Enclave       = appconf.Enclave
	SealedKey     = appconf.SealedKey
	Attestation   = appconf.Attestation
)

const (
	EnclaveStatusInactive = appconf.EnclaveStatusInactive
	EnclaveStatusActive   = appconf.EnclaveStatusActive
	EnclaveStatusRevoked  = appconf.EnclaveStatusRevoked
)
