import api from './api';

const oracleService = {
  // List all oracle data sources
  listDataSources: async (params = {}) => {
    const response = await api.get('/api/v1/oracle/sources', { params });
    return response.data;
  },

  // Get data source by ID
  getDataSource: async (id) => {
    const response = await api.get(`/api/v1/oracle/sources/${id}`);
    return response.data;
  },

  // Create a new data source
  createDataSource: async (dataSourceData) => {
    const response = await api.post('/api/v1/oracle/sources', dataSourceData);
    return response.data;
  },

  // Update an existing data source
  updateDataSource: async (id, dataSourceData) => {
    const response = await api.put(`/api/v1/oracle/sources/${id}`, dataSourceData);
    return response.data;
  },

  // Delete a data source
  deleteDataSource: async (id) => {
    const response = await api.delete(`/api/v1/oracle/sources/${id}`);
    return response.data;
  },

  // Test a data source
  testDataSource: async (id, testData = {}) => {
    const response = await api.post(`/api/v1/oracle/sources/${id}/test`, testData);
    return response.data;
  },

  // List all oracle requests
  listRequests: async (params = {}) => {
    const response = await api.get('/api/v1/oracle/requests', { params });
    return response.data;
  },

  // Get request by ID
  getRequest: async (id) => {
    const response = await api.get(`/api/v1/oracle/requests/${id}`);
    return response.data;
  },

  // Create a new oracle request
  createRequest: async (requestData) => {
    const response = await api.post('/api/v1/oracle/requests', requestData);
    return response.data;
  },

  // Get the results of an oracle request
  getRequestResults: async (id) => {
    const response = await api.get(`/api/v1/oracle/requests/${id}/results`);
    return response.data;
  },

  // Get the status of an oracle request
  getRequestStatus: async (id) => {
    const response = await api.get(`/api/v1/oracle/requests/${id}/status`);
    return response.data;
  },

  // Get statistics about oracle requests
  getOracleStats: async () => {
    const response = await api.get('/api/v1/oracle/stats');
    return response.data;
  },

  // Get contract integration examples
  getContractIntegrationExamples: async () => {
    const response = await api.get('/api/v1/oracle/examples');
    return response.data;
  }
};

export default oracleService; 