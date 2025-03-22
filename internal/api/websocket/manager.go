package websocket

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

// EventType represents the type of event being sent over the websocket
type EventType string

// Event types
const (
	EventTypePing            EventType = "ping"
	EventTypeServiceStatus   EventType = "service_status"
	EventTypeTransaction     EventType = "transaction"
	EventTypePriceFeed       EventType = "price_feed"
	EventTypeTrigger         EventType = "trigger"
	EventTypeFunction        EventType = "function"
	EventTypeRandomNumber    EventType = "random_number"
	EventTypeOracle          EventType = "oracle"
	EventTypeNotification    EventType = "notification"
	EventTypeError           EventType = "error"
)

// Event represents a message sent over the websocket
type Event struct {
	Type      EventType   `json:"type"`
	Timestamp time.Time   `json:"timestamp"`
	ID        string      `json:"id"`
	Data      interface{} `json:"data"`
}

// Client represents a connected websocket client
type Client struct {
	ID           string
	Connection   *websocket.Conn
	UserID       string
	Subscribed   map[EventType]bool
	Send         chan Event
	LastActivity time.Time
	mu           sync.Mutex
}

// Manager handles websocket connections and broadcasts
type Manager struct {
	clients      map[string]*Client
	broadcast    chan Event
	register     chan *Client
	unregister   chan *Client
	authenticate chan *Client
	clientsMu    sync.RWMutex
	closed       bool
}

// NewManager creates a new websocket manager
func NewManager() *Manager {
	return &Manager{
		clients:      make(map[string]*Client),
		broadcast:    make(chan Event),
		register:     make(chan *Client),
		unregister:   make(chan *Client),
		authenticate: make(chan *Client),
		closed:       false,
	}
}

// Start begins the manager's goroutines
func (m *Manager) Start() {
	go m.run()
	go m.pingClients()
	log.Info().Msg("WebSocket manager started")
}

// Stop closes all connections and stops the manager
func (m *Manager) Stop() {
	m.closed = true
	m.clientsMu.Lock()
	defer m.clientsMu.Unlock()

	for _, client := range m.clients {
		m.closeClient(client)
	}

	log.Info().Msg("WebSocket manager stopped")
}

// Register adds a new client
func (m *Manager) Register(client *Client) {
	if m.closed {
		return
	}
	m.register <- client
}

// Unregister removes a client
func (m *Manager) Unregister(client *Client) {
	if m.closed {
		return
	}
	m.unregister <- client
}

// Authenticate marks a client as authenticated
func (m *Manager) Authenticate(client *Client, userID string) {
	client.mu.Lock()
	client.UserID = userID
	client.LastActivity = time.Now()
	client.mu.Unlock()
	
	if m.closed {
		return
	}
	m.authenticate <- client
}

// Broadcast sends an event to all clients
func (m *Manager) Broadcast(eventType EventType, data interface{}) {
	if m.closed {
		return
	}
	
	event := Event{
		Type:      eventType,
		Timestamp: time.Now(),
		ID:        uuid.New().String(),
		Data:      data,
	}
	
	m.broadcast <- event
}

// SendToUser sends an event to a specific user
func (m *Manager) SendToUser(userID string, eventType EventType, data interface{}) {
	if m.closed {
		return
	}
	
	event := Event{
		Type:      eventType,
		Timestamp: time.Now(),
		ID:        uuid.New().String(),
		Data:      data,
	}
	
	m.clientsMu.RLock()
	defer m.clientsMu.RUnlock()
	
	for _, client := range m.clients {
		if client.UserID == userID && client.Subscribed[eventType] {
			select {
			case client.Send <- event:
				// Event sent
			default:
				// Send buffer full, client might be slow to consume
				go m.closeClient(client)
			}
		}
	}
}

// GetConnectedClientsCount returns the number of currently connected clients
func (m *Manager) GetConnectedClientsCount() int {
	m.clientsMu.RLock()
	defer m.clientsMu.RUnlock()
	return len(m.clients)
}

// run manages client connections and broadcasts
func (m *Manager) run() {
	for {
		select {
		case client := <-m.register:
			m.clientsMu.Lock()
			m.clients[client.ID] = client
			m.clientsMu.Unlock()
			log.Info().Str("clientID", client.ID).Msg("Client registered")
			
		case client := <-m.unregister:
			m.clientsMu.Lock()
			if _, ok := m.clients[client.ID]; ok {
				m.closeClient(client)
				delete(m.clients, client.ID)
				log.Info().Str("clientID", client.ID).Msg("Client unregistered")
			}
			m.clientsMu.Unlock()
			
		case client := <-m.authenticate:
			log.Info().Str("clientID", client.ID).Str("userID", client.UserID).Msg("Client authenticated")
			
		case event := <-m.broadcast:
			m.clientsMu.RLock()
			for _, client := range m.clients {
				if client.Subscribed[event.Type] {
					select {
					case client.Send <- event:
						// Event sent
					default:
						// Send buffer full
						go func(c *Client) {
							m.clientsMu.Lock()
							m.closeClient(c)
							delete(m.clients, c.ID)
							m.clientsMu.Unlock()
						}(client)
					}
				}
			}
			m.clientsMu.RUnlock()
		}
	}
}

// pingClients periodically sends ping events to keep connections alive
func (m *Manager) pingClients() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		<-ticker.C
		
		if m.closed {
			return
		}
		
		pingEvent := Event{
			Type:      EventTypePing,
			Timestamp: time.Now(),
			ID:        uuid.New().String(),
			Data:      map[string]interface{}{"message": "ping"},
		}
		
		inactiveTimeout := 5 * time.Minute
		
		m.clientsMu.Lock()
		for id, client := range m.clients {
			// Check for inactive clients
			client.mu.Lock()
			if time.Since(client.LastActivity) > inactiveTimeout {
				log.Info().Str("clientID", client.ID).Msg("Closing inactive client")
				m.closeClient(client)
				delete(m.clients, id)
				client.mu.Unlock()
				continue
			}
			client.mu.Unlock()
			
			// Send ping to active clients
			select {
			case client.Send <- pingEvent:
				// Ping sent
			default:
				// Send buffer full
				m.closeClient(client)
				delete(m.clients, id)
			}
		}
		m.clientsMu.Unlock()
	}
}

// closeClient closes a client connection and cleans up resources
func (m *Manager) closeClient(client *Client) {
	client.mu.Lock()
	defer client.mu.Unlock()
	
	// Close send channel
	close(client.Send)
	
	// Close websocket connection
	if client.Connection != nil {
		client.Connection.Close()
		client.Connection = nil
	}
}

// ReadPump pumps messages from the websocket connection to the manager
func (client *Client) ReadPump(manager *Manager) {
	defer func() {
		manager.Unregister(client)
	}()
	
	// Configure read deadline
	client.Connection.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.Connection.SetPongHandler(func(string) error {
		client.mu.Lock()
		client.LastActivity = time.Now()
		client.mu.Unlock()
		client.Connection.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	
	for {
		_, message, err := client.Connection.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error().Err(err).Str("clientID", client.ID).Msg("Unexpected close error")
			}
			break
		}
		
		client.mu.Lock()
		client.LastActivity = time.Now()
		client.mu.Unlock()
		
		// Process incoming message
		var clientMsg struct {
			Action string      `json:"action"`
			Data   interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(message, &clientMsg); err != nil {
			log.Error().Err(err).Str("clientID", client.ID).Msg("Failed to unmarshal client message")
			continue
		}
		
		switch clientMsg.Action {
		case "subscribe":
			if data, ok := clientMsg.Data.(map[string]interface{}); ok {
				if eventTypes, ok := data["eventTypes"].([]interface{}); ok {
					client.mu.Lock()
					for _, et := range eventTypes {
						if eventType, ok := et.(string); ok {
							client.Subscribed[EventType(eventType)] = true
						}
					}
					client.mu.Unlock()
					log.Debug().Str("clientID", client.ID).Interface("subscriptions", client.Subscribed).Msg("Client subscribed to events")
				}
			}
			
		case "unsubscribe":
			if data, ok := clientMsg.Data.(map[string]interface{}); ok {
				if eventTypes, ok := data["eventTypes"].([]interface{}); ok {
					client.mu.Lock()
					for _, et := range eventTypes {
						if eventType, ok := et.(string); ok {
							delete(client.Subscribed, EventType(eventType))
						}
					}
					client.mu.Unlock()
					log.Debug().Str("clientID", client.ID).Interface("subscriptions", client.Subscribed).Msg("Client unsubscribed from events")
				}
			}
			
		case "ping":
			// Client sent ping, respond with pong
			pongEvent := Event{
				Type:      EventTypePing,
				Timestamp: time.Now(),
				ID:        uuid.New().String(),
				Data:      map[string]interface{}{"message": "pong"},
			}
			client.Send <- pongEvent
			
		default:
			log.Debug().Str("clientID", client.ID).Str("action", clientMsg.Action).Msg("Unknown client action")
		}
	}
}

// WritePump pumps messages from the manager to the websocket connection
func (client *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		if client.Connection != nil {
			client.Connection.Close()
		}
	}()
	
	for {
		select {
		case event, ok := <-client.Send:
			client.Connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Channel closed
				client.Connection.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			w, err := client.Connection.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			
			// Encode and send the event
			encoder := json.NewEncoder(w)
			if err := encoder.Encode(event); err != nil {
				log.Error().Err(err).Str("clientID", client.ID).Msg("Failed to encode event")
			}
			
			// Add queued messages
			n := len(client.Send)
			for i := 0; i < n; i++ {
				event := <-client.Send
				if err := encoder.Encode(event); err != nil {
					log.Error().Err(err).Str("clientID", client.ID).Msg("Failed to encode queued event")
				}
			}
			
			if err := w.Close(); err != nil {
				return
			}
			
		case <-ticker.C:
			client.Connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.Connection.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
} 