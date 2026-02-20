package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/logging"
	"github.com/r3e-network/neo-miniapp-platform/services/indexer"
)

func main() {
	log := logging.NewFromEnv("neo-indexer")

	cfg, err := indexer.LoadFromEnv()
	if err != nil {
		log.WithError(err).Fatal("load config")
	}
	if validateErr := cfg.Validate(); validateErr != nil {
		log.WithError(validateErr).Fatal("validate config")
	}

	svc, err := indexer.NewService(cfg)
	if err != nil {
		log.WithError(err).Fatal("create service")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := svc.Start(ctx); err != nil {
		log.WithError(err).Fatal("start service")
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Info(context.Background(), "shutting down", nil)
	cancel()
	if stopErr := svc.Stop(); stopErr != nil {
		log.WithError(stopErr).Error("stop service")
	}
}
