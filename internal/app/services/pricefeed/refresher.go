package pricefeed

import (
	"context"
	"sync"
	"time"

	core "github.com/R3E-Network/service_layer/internal/app/core/service"
	"github.com/R3E-Network/service_layer/internal/app/system"
	"github.com/R3E-Network/service_layer/pkg/logger"
)

var _ system.Service = (*Refresher)(nil)

// Refresher periodically scans configured feeds so downstream refresh logic
// can plug into a consistent lifecycle hook.
type Refresher struct {
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
	return &Refresher{
		service:  service,
		log:      log,
		interval: 10 * time.Second,
		tracer:   core.NoopTracer,
		hooks:    core.NoopObservationHooks,
	}
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

	r.log.Info("price feed refresher stopped")
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
