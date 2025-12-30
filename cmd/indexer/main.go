package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/R3E-Network/service_layer/services/indexer"
	"github.com/sirupsen/logrus"
)

func main() {
	log := logrus.WithField("app", "neo-indexer")

	cfg, err := indexer.LoadFromEnv()
	if err != nil {
		log.WithError(err).Fatal("load config")
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

	log.Info("shutting down")
	svc.Stop()
}
