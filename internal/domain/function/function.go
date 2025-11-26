package function

import appfunc "github.com/R3E-Network/service_layer/internal/app/domain/function"

type (
	Definition      = appfunc.Definition
	Execution       = appfunc.Execution
	ExecutionResult = appfunc.ExecutionResult
	Action          = appfunc.Action
	ActionResult    = appfunc.ActionResult
	ExecutionStatus = appfunc.ExecutionStatus
	ActionStatus    = appfunc.ActionStatus
)

const (
	ExecutionStatusSucceeded = appfunc.ExecutionStatusSucceeded
	ExecutionStatusFailed    = appfunc.ExecutionStatusFailed

	ActionStatusPending   = appfunc.ActionStatusPending
	ActionStatusSucceeded = appfunc.ActionStatusSucceeded
	ActionStatusFailed    = appfunc.ActionStatusFailed

	ActionTypeGasBankEnsureAccount = appfunc.ActionTypeGasBankEnsureAccount
	ActionTypeGasBankWithdraw      = appfunc.ActionTypeGasBankWithdraw
	ActionTypeGasBankBalance       = appfunc.ActionTypeGasBankBalance
	ActionTypeGasBankListTx        = appfunc.ActionTypeGasBankListTx
	ActionTypeOracleCreateRequest  = appfunc.ActionTypeOracleCreateRequest
	ActionTypePriceFeedSnapshot    = appfunc.ActionTypePriceFeedSnapshot
	ActionTypeRandomGenerate       = appfunc.ActionTypeRandomGenerate
	ActionTypeDataFeedSubmit       = appfunc.ActionTypeDataFeedSubmit
	ActionTypeDatastreamPublish    = appfunc.ActionTypeDatastreamPublish
	ActionTypeDatalinkDeliver      = appfunc.ActionTypeDatalinkDeliver
	ActionTypeTriggerRegister      = appfunc.ActionTypeTriggerRegister
	ActionTypeAutomationSchedule   = appfunc.ActionTypeAutomationSchedule
)
