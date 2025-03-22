import api from './api';

const priceFeedService = {
  // Get all price feeds
  listPriceFeeds: async (params = {}) => {
    const response = await api.get('/api/v1/price-feeds', { params });
    return response.data;
  },

  // Get a specific price feed by ID
  getPriceFeed: async (id) => {
    const response = await api.get(`/api/v1/price-feeds/${id}`);
    return response.data;
  },

  // Create a new price feed
  createPriceFeed: async (priceFeedData) => {
    const response = await api.post('/api/v1/price-feeds', priceFeedData);
    return response.data;
  },

  // Update an existing price feed
  updatePriceFeed: async (id, priceFeedData) => {
    const response = await api.put(`/api/v1/price-feeds/${id}`, priceFeedData);
    return response.data;
  },

  // Delete a price feed
  deletePriceFeed: async (id) => {
    const response = await api.delete(`/api/v1/price-feeds/${id}`);
    return response.data;
  },

  // Get historical price data for a feed
  getPriceFeedHistory: async (id, params = {}) => {
    const response = await api.get(`/api/v1/price-feeds/${id}/history`, { params });
    return response.data;
  },

  // Get current price for a token/asset
  getCurrentPrice: async (symbol) => {
    const response = await api.get(`/api/v1/price-feeds/current/${symbol}`);
    return response.data;
  },

  // Get all supported sources
  getSources: async () => {
    const response = await api.get('/api/v1/price-feeds/sources');
    return response.data;
  },

  // Get all supported assets
  getAssets: async () => {
    const response = await api.get('/api/v1/price-feeds/assets');
    return response.data;
  },

  // Trigger a manual update for a price feed
  triggerUpdate: async (id) => {
    const response = await api.post(`/api/v1/price-feeds/${id}/update`);
    return response.data;
  }
};

export default priceFeedService; 