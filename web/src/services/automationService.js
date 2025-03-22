import api from './api';

const automationService = {
  // List all triggers
  listTriggers: async (params = {}) => {
    const response = await api.get('/api/v1/automation/triggers', { params });
    return response.data;
  },

  // Get a specific trigger
  getTrigger: async (id) => {
    const response = await api.get(`/api/v1/automation/triggers/${id}`);
    return response.data;
  },

  // Create a new trigger
  createTrigger: async (triggerData) => {
    const response = await api.post('/api/v1/automation/triggers', triggerData);
    return response.data;
  },

  // Update an existing trigger
  updateTrigger: async (id, triggerData) => {
    const response = await api.put(`/api/v1/automation/triggers/${id}`, triggerData);
    return response.data;
  },

  // Delete a trigger
  deleteTrigger: async (id) => {
    const response = await api.delete(`/api/v1/automation/triggers/${id}`);
    return response.data;
  },

  // Execute a trigger manually
  executeTrigger: async (id) => {
    const response = await api.post(`/api/v1/automation/triggers/${id}/execute`);
    return response.data;
  },

  // Get trigger execution history
  getTriggerHistory: async (id, params = {}) => {
    const response = await api.get(`/api/v1/automation/triggers/${id}/history`, { params });
    return response.data;
  },

  // Get trigger types
  getTriggerTypes: async () => {
    const response = await api.get('/api/v1/automation/trigger-types');
    return response.data;
  },

  // Get supported conditions 
  getConditionTypes: async () => {
    const response = await api.get('/api/v1/automation/condition-types');
    return response.data;
  },

  // Get statistics about automation triggers
  getAutomationStats: async () => {
    const response = await api.get('/api/v1/automation/stats');
    return response.data;
  },

  // Register a contract for automation
  registerContract: async (contractData) => {
    const response = await api.post('/api/v1/automation/contracts', contractData);
    return response.data;
  },

  // Get registered contracts
  getRegisteredContracts: async () => {
    const response = await api.get('/api/v1/automation/contracts');
    return response.data;
  },

  // Get contract integration examples
  getContractIntegrationExamples: async () => {
    const response = await api.get('/api/v1/automation/examples');
    return response.data;
  }
};

export default automationService; 