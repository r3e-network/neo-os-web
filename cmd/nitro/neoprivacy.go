package main

import (
	neoprivacy "github.com/r3e-network/neo-miniapp-platform/services/neoprivacy/nitro"
)

func newNeoPrivacy(ctx *serviceContext) (ServiceRunner, error) {
	return neoprivacy.New(neoprivacy.Config{
		Nitro:         ctx.m,
		DB:             ctx.db,
		ChainClient:    ctx.chainClient,
		TxProxyInvoker: ctx.txProxyInvoker,
	})
}
