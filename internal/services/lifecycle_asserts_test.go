package services

import (
	"context"
	"testing"

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

// Compile-time lifecycle conformance assertions.
func TestLifecycleContracts(t *testing.T) {
	var _ lifecycleService = (*accounts.Service)(nil)
	var _ lifecycleService = (*automation.Service)(nil)
	var _ lifecycleService = (*automationsvc.Scheduler)(nil)
	var _ lifecycleService = (*ccipsvc.Service)(nil)
	var _ lifecycleService = (*confsvc.Service)(nil)
	var _ lifecycleService = (*cresvc.Service)(nil)
	var _ lifecycleService = (*datafeedsvc.Service)(nil)
	var _ lifecycleService = (*datalinksvc.Service)(nil)
	var _ lifecycleService = (*datastreamsvc.Service)(nil)
	var _ lifecycleService = (*dtasvc.Service)(nil)
	var _ lifecycleService = (*functions.Service)(nil)
	var _ lifecycleService = (*gasbanksvc.Service)(nil)
	var _ lifecycleService = (*gasbanksvc.SettlementPoller)(nil)
	var _ lifecycleService = (*oraclesvc.Service)(nil)
	var _ lifecycleService = (*oraclesvc.Dispatcher)(nil)
	var _ lifecycleService = (*pricefeedsvc.Service)(nil)
	var _ lifecycleService = (*pricefeedsvc.Refresher)(nil)
	var _ lifecycleService = (*randomsvc.Service)(nil)
	var _ lifecycleService = (*secrets.Service)(nil)
	var _ lifecycleService = (*triggerssvc.Service)(nil)
	var _ lifecycleService = (*vrfsvc.Service)(nil)

	_ = context.Background()
}
