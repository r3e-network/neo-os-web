package secret

import appsec "github.com/R3E-Network/service_layer/internal/app/domain/secret"

type (
	ACL      = appsec.ACL
	Secret   = appsec.Secret
	Metadata = appsec.Metadata
)

const (
	ACLNone             = appsec.ACLNone
	ACLOracleAccess     = appsec.ACLOracleAccess
	ACLAutomationAccess = appsec.ACLAutomationAccess
	ACLFunctionAccess   = appsec.ACLFunctionAccess
	ACLJAMAccess        = appsec.ACLJAMAccess
)
