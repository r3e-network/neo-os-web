import api from './api';

const userService = {
  // User CRUD operations
  getUsers: async (params = {}) => {
    const response = await api.get('/api/v1/users', { params });
    return response.data;
  },
  
  getUser: async (id) => {
    const response = await api.get(`/api/v1/users/${id}`);
    return response.data;
  },
  
  createUser: async (userData) => {
    const response = await api.post('/api/v1/users', userData);
    return response.data;
  },
  
  updateUser: async (id, userData) => {
    const response = await api.put(`/api/v1/users/${id}`, userData);
    return response.data;
  },
  
  deleteUser: async (id) => {
    const response = await api.delete(`/api/v1/users/${id}`);
    return response.data;
  },
  
  // Role operations
  getRoles: async () => {
    const response = await api.get('/api/v1/roles');
    return response.data;
  },
  
  getRole: async (id) => {
    const response = await api.get(`/api/v1/roles/${id}`);
    return response.data;
  },
  
  createRole: async (roleData) => {
    const response = await api.post('/api/v1/roles', roleData);
    return response.data;
  },
  
  updateRole: async (id, roleData) => {
    const response = await api.put(`/api/v1/roles/${id}`, roleData);
    return response.data;
  },
  
  deleteRole: async (id) => {
    const response = await api.delete(`/api/v1/roles/${id}`);
    return response.data;
  },
  
  // User role operations
  assignRole: async (userId, roleId) => {
    const response = await api.post(`/api/v1/users/${userId}/roles/${roleId}`);
    return response.data;
  },
  
  removeRole: async (userId, roleId) => {
    const response = await api.delete(`/api/v1/users/${userId}/roles/${roleId}`);
    return response.data;
  },
  
  // Permission operations
  getUserPermissions: async (userId) => {
    const response = await api.get(`/api/v1/users/${userId}/permissions`);
    return response.data;
  },
  
  getRolePermissions: async (roleId) => {
    const response = await api.get(`/api/v1/roles/${roleId}/permissions`);
    return response.data;
  },
  
  updateRolePermissions: async (roleId, permissions) => {
    const response = await api.put(`/api/v1/roles/${roleId}/permissions`, { permissions });
    return response.data;
  },
  
  // User profile operations
  getCurrentUser: async () => {
    const response = await api.get('/api/v1/users/me');
    return response.data;
  },
  
  updateProfile: async (profileData) => {
    const response = await api.put('/api/v1/users/me', profileData);
    return response.data;
  },
  
  changePassword: async (passwordData) => {
    const response = await api.put('/api/v1/users/me/password', passwordData);
    return response.data;
  },
  
  // API key management
  getApiKeys: async () => {
    const response = await api.get('/api/v1/users/me/api-keys');
    return response.data;
  },
  
  createApiKey: async (name, expiresIn = '30d') => {
    const response = await api.post('/api/v1/users/me/api-keys', { name, expiresIn });
    return response.data;
  },
  
  deleteApiKey: async (keyId) => {
    const response = await api.delete(`/api/v1/users/me/api-keys/${keyId}`);
    return response.data;
  },
  
  // Service-specific permissions
  getServicePermissions: async (service) => {
    const response = await api.get(`/api/v1/services/${service}/permissions`);
    return response.data;
  },
  
  updateUserServicePermissions: async (userId, service, permissions) => {
    const response = await api.put(`/api/v1/users/${userId}/services/${service}/permissions`, { permissions });
    return response.data;
  }
};

export default userService; 