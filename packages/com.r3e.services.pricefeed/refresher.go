package pricefeed

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/R3E-Network/service_layer/system/framework"
	core "github.com/R3E-Network/service_layer/system/framework/core"
)

var _ interface {
	Name() string
	Start(context.Context) error
	Stop(context.Context) error
	Ready(context.Context) error
} = (*Refresher)(nil)

// Refresher periodically scans configured feeds so downstream refresh logic
// can plug into a consistent lifecycle hook.
type Refresher struct {
	framework.ServiceBase
	service  *Service
	log      *logger.Logger
	interval time.Duration
	fetcher  Fetcher
	tracer   core.Tracer
	hooks    core.ObservationHooks

	mu      sync.Mutex
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	running bool
}

// NewRefresher creates a lifecycle-managed price feed refresher.
func NewRefresher(service *Service, log *logger.Logger) *Refresher {
	if log == nil {
		log = logger.NewDefault("pricefeed-runner")
	}
	ref := &Refresher{
		service:  service,
		log:      log,
		interval: 10 * time.Second,
		tracer:   core.NoopTracer,
		hooks:    core.NoopObservationHooks,
	}
	ref.SetName(ref.Name())
	return ref
}

// WithFetcher assigns the fetcher used to retrieve external prices.
func (r *Refresher) WithFetcher(fetcher Fetcher) {
	r.mu.Lock()
	r.fetcher = fetcher
	r.mu.Unlock()
}

// WithTracer configures span emission for per-feed refresh attempts.
func (r *Refresher) WithTracer(tracer core.Tracer) {
	r.mu.Lock()
	if tracer == nil {
		r.tracer = core.NoopTracer
	} else {
		r.tracer = tracer
	}
	r.mu.Unlock()
}

// WithObservationHooks configures optional callbacks for refresh attempts.
func (r *Refresher) WithObservationHooks(hooks core.ObservationHooks) {
	r.mu.Lock()
	r.hooks = hooks
	r.mu.Unlock()
}

func (r *Refresher) Name() string { return "pricefeed-refresher" }

func (r *Refresher) Start(ctx context.Context) error {
	r.mu.Lock()
	if r.running {
		r.mu.Unlock()
		return nil
	}
	runCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel
	r.running = true
	r.mu.Unlock()

	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		ticker := time.NewTicker(r.interval)
		defer ticker.Stop()

		for {
			select {
			case <-runCtx.Done():
				return
			case <-ticker.C:
				r.tick(runCtx)
			}
		}
	}()

	r.log.Info("price feed refresher started")
	r.MarkReady(true)
	return nil
}

func (r *Refresher) Stop(ctx context.Context) error {
	r.mu.Lock()
	if !r.running {
		r.mu.Unlock()
		return nil
	}
	cancel := r.cancel
	r.running = false
	r.cancel = nil
	r.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		r.wg.Wait()
	}()

	select {
	case <-done:
	case <-ctx.Done():
		return ctx.Err()
	}

	r.MarkReady(false)
	r.log.Info("price feed refresher stopped")
	return nil
}

// Ready reports readiness based on running state.
func (r *Refresher) Ready(ctx context.Context) error {
	if err := r.ServiceBase.Ready(ctx); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.running {
		return fmt.Errorf("price feed refresher not running")
	}
	return nil
}

func (r *Refresher) tick(ctx context.Context) {
	if r.service == nil {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	feeds, err := r.service.ListFeeds(ctx, "")
	if err != nil {
		r.log.WithError(err).Warn("price feed refresher tick failed")
		return
	}

	r.mu.Lock()
	fetcher := r.fetcher
	tracer := r.tracer
	hooks := r.hooks
	r.mu.Unlock()

	if fetcher == nil {
		return
	}

	for _, feed := range feeds {
		if !feed.Active {
			continue
		}
		attrs := map[string]string{"feed_id": feed.ID}
		if feed.AccountID != "" {
			attrs["account_id"] = feed.AccountID
		}
		spanCtx, finishSpan := tracer.StartSpan(ctx, "pricefeed.refresh", attrs)
		finishObs := core.StartObservation(spanCtx, hooks, attrs)
		price, source, err := fetcher.Fetch(spanCtx, feed)
		if err != nil {
			r.log.WithError(err).
				WithField("feed_id", feed.ID).
				Warn("price fetch failed")
			finishObs(err)
			finishSpan(err)
			continue
		}
		if _, err := r.service.RecordSnapshot(spanCtx, feed.ID, price, source, time.Now()); err != nil {
			r.log.WithError(err).
				WithField("feed_id", feed.ID).
				Warn("record price snapshot failed")
			finishObs(err)
			finishSpan(err)
			continue
		}
		finishObs(nil)
		finishSpan(nil)
	}
}
