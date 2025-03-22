import React, { createContext, useContext, useEffect, useState } from 'react';
import websocketService, { EVENT_TYPES, WS_STATUS } from '../services/websocketService';
import { useAuth } from './AuthContext';

// Create WebSocket context
const WebSocketContext = createContext();

// WebSocket provider component
export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState(websocketService.getStatus());
  const [isConnected, setIsConnected] = useState(status === WS_STATUS.OPEN);
  
  // Connect to WebSocket when authenticated, disconnect when not
  useEffect(() => {
    // Don't connect if not authenticated
    if (!isAuthenticated) {
      websocketService.disconnect();
      return;
    }
    
    // Subscribe to WebSocket status updates
    const unsubscribe = websocketService.addEventListener('status', (data) => {
      setStatus(data.status);
      setIsConnected(data.status === WS_STATUS.OPEN);
    });
    
    // Connect to WebSocket
    websocketService.connect();
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [isAuthenticated]);
  
  // Subscribe to a specific event type
  const subscribe = (eventType, callback) => {
    return websocketService.addEventListener(eventType, callback);
  };
  
  // Helper for subscribing to transaction updates
  const subscribeToTransactionUpdates = (callback) => {
    return subscribe(EVENT_TYPES.TRANSACTION_UPDATED, callback);
  };
  
  // Helper for subscribing to service status updates
  const subscribeToServiceStatusUpdates = (callback) => {
    return subscribe(EVENT_TYPES.SERVICE_STATUS_UPDATED, callback);
  };
  
  // Helper for subscribing to price updates
  const subscribeToPriceUpdates = (callback) => {
    return subscribe(EVENT_TYPES.PRICE_UPDATED, callback);
  };
  
  // Helper for subscribing to oracle request completions
  const subscribeToOracleRequestCompletions = (callback) => {
    return subscribe(EVENT_TYPES.ORACLE_REQUEST_COMPLETED, callback);
  };
  
  // Helper for subscribing to random number generations
  const subscribeToRandomNumberGenerations = (callback) => {
    return subscribe(EVENT_TYPES.RANDOM_NUMBER_GENERATED, callback);
  };
  
  // Helper for subscribing to function executions
  const subscribeToFunctionExecutions = (callback) => {
    return subscribe(EVENT_TYPES.FUNCTION_EXECUTED, callback);
  };
  
  // Helper for subscribing to trigger firing
  const subscribeToTriggerFirings = (callback) => {
    return subscribe(EVENT_TYPES.TRIGGER_FIRED, callback);
  };
  
  // Context value
  const value = {
    status,
    isConnected,
    subscribe,
    subscribeToTransactionUpdates,
    subscribeToServiceStatusUpdates,
    subscribeToPriceUpdates,
    subscribeToOracleRequestCompletions,
    subscribeToRandomNumberGenerations,
    subscribeToFunctionExecutions,
    subscribeToTriggerFirings,
  };
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook for using WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext; 