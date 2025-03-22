import api from './api';
import { useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { EVENT_TYPES } from './websocketService';

const transactionService = {
  // Transaction operations
  createTransaction: async (transactionData) => {
    const response = await api.post('/api/v1/transactions', transactionData);
    return response.data;
  },

  getTransaction: async (id) => {
    const response = await api.get(`/api/v1/transactions/${id}`);
    return response.data;
  },

  listTransactions: async (params = {}) => {
    const response = await api.get('/api/v1/transactions', { params });
    return response.data;
  },

  retryTransaction: async (id) => {
    const response = await api.post(`/api/v1/transactions/${id}/retry`);
    return response.data;
  },

  cancelTransaction: async (id) => {
    const response = await api.post(`/api/v1/transactions/${id}/cancel`);
    return response.data;
  },

  getTransactionEvents: async (id) => {
    const response = await api.get(`/api/v1/transactions/${id}/events`);
    return response.data;
  },

  // Wallet operations
  createServiceWallet: async (service) => {
    const response = await api.post('/api/v1/transactions/wallets', { service });
    return response.data;
  },

  getServiceWallet: async (service) => {
    const response = await api.get(`/api/v1/transactions/wallets/${service}`);
    return response.data;
  },

  listServiceWallets: async (service) => {
    const response = await api.get(`/api/v1/transactions/wallets/${service}/all`);
    return response.data;
  },
  
  // Real-time transaction hooks
  
  // Hook to track a single transaction in real time
  useTransactionTracking: (transactionId, onUpdate) => {
    const { subscribeToTransactionUpdates } = useWebSocket();
    
    useEffect(() => {
      if (!transactionId) return;
      
      // Subscribe to transaction updates
      const unsubscribe = subscribeToTransactionUpdates((data) => {
        if (data.id === transactionId) {
          onUpdate(data);
        }
      });
      
      return unsubscribe;
    }, [transactionId, onUpdate, subscribeToTransactionUpdates]);
  },
  
  // Hook to track all transactions in real time
  useTransactionsLiveUpdates: (onTransactionUpdate) => {
    const { subscribeToTransactionUpdates } = useWebSocket();
    
    useEffect(() => {
      // Subscribe to all transaction updates
      const unsubscribe = subscribeToTransactionUpdates(onTransactionUpdate);
      
      return unsubscribe;
    }, [onTransactionUpdate, subscribeToTransactionUpdates]);
  }
};

export default transactionService; 