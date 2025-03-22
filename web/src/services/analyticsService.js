import api from './api';

const analyticsService = {
  // Dashboard analytics
  getDashboardAnalytics: async () => {
    const response = await api.get('/api/v1/analytics/dashboard');
    return response.data;
  },
  
  // Transaction analytics
  getTransactionAnalytics: async (params = {}) => {
    const response = await api.get('/api/v1/analytics/transactions', { params });
    return response.data;
  },
  
  // Service usage analytics
  getServiceUsageAnalytics: async (service, params = {}) => {
    const response = await api.get(`/api/v1/analytics/services/${service}/usage`, { params });
    return response.data;
  },
  
  // Gas usage analytics
  getGasUsageAnalytics: async (params = {}) => {
    const response = await api.get('/api/v1/analytics/gas-usage', { params });
    return response.data;
  },
  
  // User activity analytics
  getUserActivityAnalytics: async (params = {}) => {
    const response = await api.get('/api/v1/analytics/user-activity', { params });
    return response.data;
  },
  
  // API usage analytics
  getApiUsageAnalytics: async (params = {}) => {
    const response = await api.get('/api/v1/analytics/api-usage', { params });
    return response.data;
  },
  
  // Service performance analytics
  getServicePerformanceAnalytics: async (service, params = {}) => {
    const response = await api.get(`/api/v1/analytics/services/${service}/performance`, { params });
    return response.data;
  },
  
  // Cost analytics
  getCostAnalytics: async (params = {}) => {
    const response = await api.get('/api/v1/analytics/costs', { params });
    return response.data;
  },
  
  // Error analytics
  getErrorAnalytics: async (params = {}) => {
    const response = await api.get('/api/v1/analytics/errors', { params });
    return response.data;
  },
  
  // Custom query analytics
  getCustomAnalytics: async (query) => {
    const response = await api.post('/api/v1/analytics/custom', { query });
    return response.data;
  },
  
  // Download analytics report
  downloadAnalyticsReport: async (reportType, params = {}) => {
    const response = await api.get(`/api/v1/analytics/reports/${reportType}`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
};

export default analyticsService; 