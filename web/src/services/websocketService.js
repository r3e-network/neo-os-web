import { createContext, useContext, useEffect, useState } from 'react';

// WebSocket connection states
export const WS_STATUS = {
  CONNECTING: 'connecting',
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed',
};

// WebSocket event types
export const EVENT_TYPES = {
  TRANSACTION_UPDATED: 'transaction_updated',
  SERVICE_STATUS_UPDATED: 'service_status_updated',
  PRICE_UPDATED: 'price_updated',
  ORACLE_REQUEST_COMPLETED: 'oracle_request_completed',
  RANDOM_NUMBER_GENERATED: 'random_number_generated',
  FUNCTION_EXECUTED: 'function_executed',
  TRIGGER_FIRED: 'trigger_fired',
};

// Create WebSocket service
const websocketService = {
  socket: null,
  listeners: {},
  status: WS_STATUS.CLOSED,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000, // 3 seconds

  // Connect to WebSocket server
  connect: function() {
    if (this.socket && (this.status === WS_STATUS.OPEN || this.status === WS_STATUS.CONNECTING)) {
      console.log('WebSocket is already connected or connecting');
      return;
    }

    this.status = WS_STATUS.CONNECTING;
    
    // Get WebSocket URL from environment or use default
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.REACT_APP_WS_HOST || window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/ws`;

    try {
      this.socket = new WebSocket(wsUrl);

      // WebSocket event handlers
      this.socket.onopen = this._onOpen.bind(this);
      this.socket.onmessage = this._onMessage.bind(this);
      this.socket.onclose = this._onClose.bind(this);
      this.socket.onerror = this._onError.bind(this);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this._scheduleReconnect();
    }
  },

  // Disconnect from WebSocket server
  disconnect: function() {
    if (this.socket) {
      this.status = WS_STATUS.CLOSING;
      this.socket.close();
    }
  },

  // Add event listener
  addEventListener: function(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);

    // Connect if not already connected
    if (this.status === WS_STATUS.CLOSED) {
      this.connect();
    }

    // Return a function to remove the listener
    return () => {
      this.removeEventListener(eventType, callback);
    };
  },

  // Remove event listener
  removeEventListener: function(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
      
      // If no more listeners for any event type, disconnect
      const hasListeners = Object.values(this.listeners).some(listeners => listeners.length > 0);
      if (!hasListeners) {
        this.disconnect();
      }
    }
  },

  // Internal: Handle WebSocket open event
  _onOpen: function() {
    console.log('WebSocket connected');
    this.status = WS_STATUS.OPEN;
    this.reconnectAttempts = 0;
    
    // Notify status listeners
    this._notifyListeners('status', { status: this.status });
  },

  // Internal: Handle WebSocket message event
  _onMessage: function(event) {
    try {
      const data = JSON.parse(event.data);
      
      if (data && data.type) {
        // Notify event listeners
        this._notifyListeners(data.type, data.payload);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  },

  // Internal: Handle WebSocket close event
  _onClose: function(event) {
    this.status = WS_STATUS.CLOSED;
    console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
    
    // Notify status listeners
    this._notifyListeners('status', { status: this.status });
    
    // Schedule reconnect if not intentionally closed
    if (event.code !== 1000) {
      this._scheduleReconnect();
    }
  },

  // Internal: Handle WebSocket error event
  _onError: function(error) {
    console.error('WebSocket error:', error);
    
    // Notify error listeners
    this._notifyListeners('error', { error });
  },

  // Internal: Notify listeners of an event
  _notifyListeners: function(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} listener:`, error);
        }
      });
    }
  },

  // Internal: Schedule a reconnect attempt
  _scheduleReconnect: function() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        if (this.status === WS_STATUS.CLOSED) {
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          this.connect();
        }
      }, delay);
    } else {
      console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`);
    }
  },

  // Get current status
  getStatus: function() {
    return this.status;
  }
};

export default websocketService; 