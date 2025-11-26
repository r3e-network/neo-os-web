package cre

import appcre "github.com/R3E-Network/service_layer/internal/app/domain/cre"

type (
	StepType   = appcre.StepType
	RunStatus  = appcre.RunStatus
	Step       = appcre.Step
	Playbook   = appcre.Playbook
	Run        = appcre.Run
	StepResult = appcre.StepResult
	Executor   = appcre.Executor
)

const (
	StepTypeFunctionCall StepType = appcre.StepTypeFunctionCall
	StepTypeAutomation   StepType = appcre.StepTypeAutomation
	StepTypeHTTPRequest  StepType = appcre.StepTypeHTTPRequest

	RunStatusPending   RunStatus = appcre.RunStatusPending
	RunStatusRunning   RunStatus = appcre.RunStatusRunning
	RunStatusSucceeded RunStatus = appcre.RunStatusSucceeded
	RunStatusFailed    RunStatus = appcre.RunStatusFailed
	RunStatusCanceled  RunStatus = appcre.RunStatusCanceled
)
