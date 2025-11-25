package services

import (
	"context"

	"github.com/R3E-Network/service_layer/internal/services/accounts"
	"github.com/R3E-Network/service_layer/internal/services/automation"
	automationsvc "github.com/R3E-Network/service_layer/internal/services/automation"
	ccipsvc "github.com/R3E-Network/service_layer/internal/services/ccip"
	confsvc "github.com/R3E-Network/service_layer/internal/services/confidential"
	cresvc "github.com/R3E-Network/service_layer/internal/services/cre"
	datafeedsvc "github.com/R3E-Network/service_layer/internal/services/datafeeds"
	datalinksvc "github.com/R3E-Network/service_layer/internal/services/datalink"
	datastreamsvc "github.com/R3E-Network/service_layer/internal/services/datastreams"
	dtasvc "github.com/R3E-Network/service_layer/internal/services/dta"
	"github.com/R3E-Network/service_layer/internal/services/functions"
	gasbanksvc "github.com/R3E-Network/service_layer/internal/services/gasbank"
	oraclesvc "github.com/R3E-Network/service_layer/internal/services/oracle"
	pricefeedsvc "github.com/R3E-Network/service_layer/internal/services/pricefeed"
	randomsvc "github.com/R3E-Network/service_layer/internal/services/random"
	"github.com/R3E-Network/service_layer/internal/services/secrets"
	triggerssvc "github.com/R3E-Network/service_layer/internal/services/triggers"
	vrfsvc "github.com/R3E-Network/service_layer/internal/services/vrf"
)

// lifecycleService mirrors the OS lifecycle contract without tying to legacy packages.
type lifecycleService interface {
	Name() string
	Start(context.Context) error
	Stop(context.Context) error
	Ready(context.Context) error
}

// Compile-time lifecycle conformance assertions for domain services and runners.
var (
	_ lifecycleService = (*accounts.Service)(nil)
	_ lifecycleService = (*automation.Service)(nil)
	_ lifecycleService = (*automationsvc.Scheduler)(nil)
	_ lifecycleService = (*ccipsvc.Service)(nil)
	_ lifecycleService = (*confsvc.Service)(nil)
	_ lifecycleService = (*cresvc.Service)(nil)
	_ lifecycleService = (*datafeedsvc.Service)(nil)
	_ lifecycleService = (*datalinksvc.Service)(nil)
	_ lifecycleService = (*datastreamsvc.Service)(nil)
	_ lifecycleService = (*dtasvc.Service)(nil)
	_ lifecycleService = (*functions.Service)(nil)
	_ lifecycleService = (*gasbanksvc.Service)(nil)
	_ lifecycleService = (*gasbanksvc.SettlementPoller)(nil)
	_ lifecycleService = (*oraclesvc.Service)(nil)
	_ lifecycleService = (*oraclesvc.Dispatcher)(nil)
	_ lifecycleService = (*pricefeedsvc.Service)(nil)
	_ lifecycleService = (*pricefeedsvc.Refresher)(nil)
	_ lifecycleService = (*randomsvc.Service)(nil)
	_ lifecycleService = (*secrets.Service)(nil)
	_ lifecycleService = (*triggerssvc.Service)(nil)
	_ lifecycleService = (*vrfsvc.Service)(nil)
)
