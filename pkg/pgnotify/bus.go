// Package pgnotify provides PostgreSQL NOTIFY/LISTEN based event bus.
// This replaces the custom in-memory event bus with a scalable, persistent solution.
// It also provides real-time table change subscriptions (similar to Supabase Realtime).
package pgnotify

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/lib/pq"
)

// ============================================================================
// Event Bus Types
// ============================================================================

// Event represents a published event.
type Event struct {
	Channel   string          `json:"channel"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp time.Time       `json:"timestamp"`
}

// Handler is called when an event is received.
type Handler func(ctx context.Context, event Event) error

// ============================================================================
// Table Change Types (Realtime)
// ============================================================================

// ChangeType represents the type of database change.
type ChangeType string

const (
	ChangeInsert ChangeType = "INSERT"
	ChangeUpdate ChangeType = "UPDATE"
	ChangeDelete ChangeType = "DELETE"
)

// Change represents a database change event.
type Change struct {
	Type      ChangeType             `json:"type"`
	Table     string                 `json:"table"`
	Schema    string                 `json:"schema"`
	Old       map[string]interface{} `json:"old,omitempty"`
	New       map[string]interface{} `json:"new,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// ChangeHandler is called when a table change event occurs.
type ChangeHandler func(ctx context.Context, change Change) error

// TableSubscription represents an active table subscription.
type TableSubscription struct {
	ID      string
	Table   string
	Handler ChangeHandler
}

// Bus is a PostgreSQL NOTIFY/LISTEN based event bus.
// It supports both generic pub/sub and table change subscriptions.
type Bus struct {
	db       *sql.DB
	listener *pq.Listener
	dsn      string

	mu       sync.RWMutex
	handlers map[string][]Handler

	// Table change subscriptions
	tableSubs     map[string]*TableSubscription
	tableChannels map[string]string // table -> channel mapping

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// New creates a new PostgreSQL event bus.
func New(dsn string) (*Bus, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("pgnotify: open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("pgnotify: ping: %w", err)
	}

	return NewWithDB(db, dsn)
}

// NewWithDB creates a new PostgreSQL event bus with an existing connection.
func NewWithDB(db *sql.DB, dsn string) (*Bus, error) {
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			fmt.Printf("pgnotify: listener error: %v\n", err)
		}
	}

	listener := pq.NewListener(dsn, 10*time.Second, time.Minute, reportProblem)

	ctx, cancel := context.WithCancel(context.Background())

	b := &Bus{
		db:            db,
		listener:      listener,
		dsn:           dsn,
		handlers:      make(map[string][]Handler),
		tableSubs:     make(map[string]*TableSubscription),
		tableChannels: make(map[string]string),
		ctx:           ctx,
		cancel:        cancel,
	}

	// Start the listener goroutine
	b.wg.Add(1)
	go b.listen()

	return b, nil
}

// Publish sends an event to a channel.
func (b *Bus) Publish(ctx context.Context, channel string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("pgnotify: marshal payload: %w", err)
	}

	// Create event envelope
	envelope := Event{
		Channel:   channel,
		Payload:   data,
		Timestamp: time.Now().UTC(),
	}

	envelopeData, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("pgnotify: marshal envelope: %w", err)
	}

	// Use pg_notify to send the event
	_, err = b.db.ExecContext(ctx, "SELECT pg_notify($1, $2)", channel, string(envelopeData))
	if err != nil {
		return fmt.Errorf("pgnotify: notify: %w", err)
	}

	return nil
}

// Subscribe registers a handler for a channel.
func (b *Bus) Subscribe(channel string, handler Handler) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Check if we need to LISTEN on this channel
	if len(b.handlers[channel]) == 0 {
		if err := b.listener.Listen(channel); err != nil {
			return fmt.Errorf("pgnotify: listen: %w", err)
		}
	}

	b.handlers[channel] = append(b.handlers[channel], handler)
	return nil
}

// Unsubscribe removes a handler for a channel.
// Note: This removes ALL handlers for the channel due to function comparison limitations.
func (b *Bus) Unsubscribe(channel string) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	delete(b.handlers, channel)

	if err := b.listener.Unlisten(channel); err != nil {
		return fmt.Errorf("pgnotify: unlisten: %w", err)
	}

	return nil
}

// Close shuts down the event bus.
func (b *Bus) Close() error {
	b.cancel()
	b.wg.Wait()

	if err := b.listener.Close(); err != nil {
		return err
	}

	return nil
}

func (b *Bus) listen() {
	defer b.wg.Done()

	for {
		select {
		case <-b.ctx.Done():
			return

		case notification := <-b.listener.Notify:
			if notification == nil {
				// Connection lost, listener will reconnect
				continue
			}

			// Check if this is a table change notification (realtime:* channel)
			if b.isTableChannel(notification.Channel) {
				b.handleTableChange(notification)
				continue
			}

			// Parse the event
			var event Event
			if err := json.Unmarshal([]byte(notification.Extra), &event); err != nil {
				// Try to create a basic event if parsing fails
				event = Event{
					Channel:   notification.Channel,
					Payload:   json.RawMessage(notification.Extra),
					Timestamp: time.Now().UTC(),
				}
			}

			// Get handlers
			b.mu.RLock()
			handlers := make([]Handler, len(b.handlers[notification.Channel]))
			copy(handlers, b.handlers[notification.Channel])
			b.mu.RUnlock()

			// Call handlers concurrently
			for _, h := range handlers {
				b.invokeHandler(h, event)
			}

		case <-time.After(90 * time.Second):
			// Ping to keep connection alive
			b.ping()
		}
	}
}

func (b *Bus) isTableChannel(channel string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.tableChannels {
		if ch == channel {
			return true
		}
	}
	return false
}

func (b *Bus) handleTableChange(notification *pq.Notification) {
	var change Change
	if err := json.Unmarshal([]byte(notification.Extra), &change); err != nil {
		fmt.Printf("pgnotify: parse table change error: %v\n", err)
		return
	}

	// Find and call handlers
	b.mu.RLock()
	var handlers []ChangeHandler
	for _, sub := range b.tableSubs {
		if sub.Table == change.Table {
			handlers = append(handlers, sub.Handler)
		}
	}
	b.mu.RUnlock()

	for _, h := range handlers {
		b.invokeChangeHandler(h, change)
	}
}

func (b *Bus) invokeHandler(handler Handler, event Event) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := handler(ctx, event); err != nil {
			fmt.Printf("pgnotify: handler error: %v\n", err)
		}
	}()
}

func (b *Bus) invokeChangeHandler(handler ChangeHandler, change Change) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := handler(ctx, change); err != nil {
			fmt.Printf("pgnotify: change handler error: %v\n", err)
		}
	}()
}

func (b *Bus) ping() {
	go func() {
		if err := b.listener.Ping(); err != nil {
			fmt.Printf("pgnotify: ping error: %v\n", err)
		}
	}()
}

// Channels returns all subscribed channels.
func (b *Bus) Channels() []string {
	b.mu.RLock()
	defer b.mu.RUnlock()

	channels := make([]string, 0, len(b.handlers))
	for ch := range b.handlers {
		channels = append(channels, ch)
	}
	return channels
}

// ============================================================================
// Table Change Subscriptions (Realtime)
// ============================================================================

// SubscribeTable subscribes to changes on a database table.
// It automatically creates triggers to capture INSERT/UPDATE/DELETE events.
func (b *Bus) SubscribeTable(table string, handler ChangeHandler) (*TableSubscription, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	channel := fmt.Sprintf("realtime:%s", table)

	// Create trigger if this is the first subscription for this table
	if _, exists := b.tableChannels[table]; !exists {
		if err := b.createTableTrigger(table, channel); err != nil {
			return nil, err
		}
		b.tableChannels[table] = channel

		if err := b.listener.Listen(channel); err != nil {
			return nil, fmt.Errorf("pgnotify: listen table: %w", err)
		}
	}

	subID := fmt.Sprintf("%s-%d", table, time.Now().UnixNano())
	sub := &TableSubscription{
		ID:      subID,
		Table:   table,
		Handler: handler,
	}
	b.tableSubs[subID] = sub

	return sub, nil
}

// UnsubscribeTable removes a table subscription.
func (b *Bus) UnsubscribeTable(sub *TableSubscription) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	delete(b.tableSubs, sub.ID)

	// Check if there are any remaining subscriptions for this table
	hasOther := false
	for _, s := range b.tableSubs {
		if s.Table == sub.Table {
			hasOther = true
			break
		}
	}

	// If no other subscriptions, unlisten
	if !hasOther {
		if channel, ok := b.tableChannels[sub.Table]; ok {
			if err := b.listener.Unlisten(channel); err != nil {
				return err
			}
			delete(b.tableChannels, sub.Table)
		}
	}

	return nil
}

// OnInsert subscribes to INSERT events on a table.
func (b *Bus) OnInsert(table string, handler func(ctx context.Context, newRow map[string]interface{}) error) (*TableSubscription, error) {
	return b.SubscribeTable(table, func(ctx context.Context, change Change) error {
		if change.Type == ChangeInsert {
			return handler(ctx, change.New)
		}
		return nil
	})
}

// OnUpdate subscribes to UPDATE events on a table.
func (b *Bus) OnUpdate(table string, handler func(ctx context.Context, oldRow, newRow map[string]interface{}) error) (*TableSubscription, error) {
	return b.SubscribeTable(table, func(ctx context.Context, change Change) error {
		if change.Type == ChangeUpdate {
			return handler(ctx, change.Old, change.New)
		}
		return nil
	})
}

// OnDelete subscribes to DELETE events on a table.
func (b *Bus) OnDelete(table string, handler func(ctx context.Context, oldRow map[string]interface{}) error) (*TableSubscription, error) {
	return b.SubscribeTable(table, func(ctx context.Context, change Change) error {
		if change.Type == ChangeDelete {
			return handler(ctx, change.Old)
		}
		return nil
	})
}

func (b *Bus) createTableTrigger(table, channel string) error {
	// Create the trigger function
	funcSQL := fmt.Sprintf(`
		CREATE OR REPLACE FUNCTION pgnotify_trigger_%s()
		RETURNS TRIGGER AS $$
		DECLARE
			payload JSON;
		BEGIN
			IF TG_OP = 'DELETE' THEN
				payload = json_build_object(
					'type', TG_OP,
					'table', TG_TABLE_NAME,
					'schema', TG_TABLE_SCHEMA,
					'old', row_to_json(OLD),
					'timestamp', NOW()
				);
			ELSIF TG_OP = 'UPDATE' THEN
				payload = json_build_object(
					'type', TG_OP,
					'table', TG_TABLE_NAME,
					'schema', TG_TABLE_SCHEMA,
					'old', row_to_json(OLD),
					'new', row_to_json(NEW),
					'timestamp', NOW()
				);
			ELSE
				payload = json_build_object(
					'type', TG_OP,
					'table', TG_TABLE_NAME,
					'schema', TG_TABLE_SCHEMA,
					'new', row_to_json(NEW),
					'timestamp', NOW()
				);
			END IF;
			PERFORM pg_notify('%s', payload::text);
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`, table, channel)

	if _, err := b.db.Exec(funcSQL); err != nil {
		return fmt.Errorf("pgnotify: create trigger function: %w", err)
	}

	// Create the trigger
	triggerSQL := fmt.Sprintf(`
		DROP TRIGGER IF EXISTS pgnotify_trigger_%s ON %s;
		CREATE TRIGGER pgnotify_trigger_%s
		AFTER INSERT OR UPDATE OR DELETE ON %s
		FOR EACH ROW EXECUTE FUNCTION pgnotify_trigger_%s();
	`, table, table, table, table, table)

	if _, err := b.db.Exec(triggerSQL); err != nil {
		return fmt.Errorf("pgnotify: create trigger: %w", err)
	}

	return nil
}
