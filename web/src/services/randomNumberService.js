import api from './api';

const randomNumberService = {
  // Generate a new random number
  generateRandomNumber: async (requestData) => {
    const response = await api.post('/api/v1/random', requestData);
    return response.data;
  },

  // Get random number request by ID
  getRandomNumberRequest: async (id) => {
    const response = await api.get(`/api/v1/random/${id}`);
    return response.data;
  },

  // List all random number requests with optional filtering
  listRandomNumberRequests: async (params = {}) => {
    const response = await api.get('/api/v1/random', { params });
    return response.data;
  },

  // Verify a random number
  verifyRandomNumber: async (id, verificationData) => {
    const response = await api.post(`/api/v1/random/${id}/verify`, verificationData);
    return response.data;
  },

  // Get the status of a random number request
  getRandomNumberStatus: async (id) => {
    const response = await api.get(`/api/v1/random/${id}/status`);
    return response.data;
  },

  // Get the proof for a random number
  getRandomNumberProof: async (id) => {
    const response = await api.get(`/api/v1/random/${id}/proof`);
    return response.data;
  },

  // Get statistics about random number generation
  getRandomNumberStats: async () => {
    const response = await api.get('/api/v1/random/stats');
    return response.data;
  },

  // Get contract integration examples
  getContractIntegrationExamples: async () => {
    const response = await api.get('/api/v1/random/examples');
    return response.data;
  }
};

export default randomNumberService; 