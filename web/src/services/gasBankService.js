import api from './api';

const gasBankService = {
  // Get account balance
  getBalance: async () => {
    const response = await api.get('/api/v1/gas-bank/balance');
    return response.data;
  },

  // Deposit GAS
  deposit: async (depositData) => {
    const response = await api.post('/api/v1/gas-bank/deposit', depositData);
    return response.data;
  },

  // Withdraw GAS
  withdraw: async (withdrawData) => {
    const response = await api.post('/api/v1/gas-bank/withdraw', withdrawData);
    return response.data;
  },

  // Get transaction history
  getTransactions: async (params = {}) => {
    const response = await api.get('/api/v1/gas-bank/transactions', { params });
    return response.data;
  },

  // Get a specific transaction
  getTransaction: async (id) => {
    const response = await api.get(`/api/v1/gas-bank/transactions/${id}`);
    return response.data;
  },

  // Get gas usage by service
  getServiceUsage: async (params = {}) => {
    const response = await api.get('/api/v1/gas-bank/usage', { params });
    return response.data;
  },

  // Get gas usage estimates for operations
  getOperationEstimates: async () => {
    const response = await api.get('/api/v1/gas-bank/estimates');
    return response.data;
  },

  // Get deposit address
  getDepositAddress: async () => {
    const response = await api.get('/api/v1/gas-bank/deposit-address');
    return response.data;
  },

  // Get gas bank statistics
  getStats: async () => {
    const response = await api.get('/api/v1/gas-bank/stats');
    return response.data;
  }
};

export default gasBankService; 