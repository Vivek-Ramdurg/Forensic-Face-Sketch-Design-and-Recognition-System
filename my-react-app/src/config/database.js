// This is a placeholder for PostgreSQL client-side configuration
// In a real application, you wouldn't expose database credentials on the client
// All database operations should go through your backend API

const API_BASE_URL = 'http://localhost:3001/api';

export const makeApiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('auth_token');
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: defaultHeaders,
    ...options
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
};

export default {
  auth: {
    login: (email, password) => makeApiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
    register: (userData) => makeApiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    getMe: () => makeApiRequest('/auth/me')
  },
  sketches: {
    create: (sketchData) => makeApiRequest('/sketches', {
      method: 'POST',
      body: JSON.stringify(sketchData)
    }),
    getAll: () => makeApiRequest('/sketches'),
    getById: (id) => makeApiRequest(`/sketches/${id}`),
    match: (id, features) => makeApiRequest(`/sketches/${id}/match`, {
      method: 'POST',
      body: JSON.stringify({ features })
    }),
    getMatches: (id) => makeApiRequest(`/sketches/${id}/matches`)
  },
  suspects: {
    getAll: (params = {}) => {
      const queryString = new URLSearchParams(params).toString();
      return makeApiRequest(`/suspects?${queryString}`);
    },
    getById: (id) => makeApiRequest(`/suspects/${id}`),
    create: (suspectData) => makeApiRequest('/suspects', {
      method: 'POST',
      body: JSON.stringify(suspectData)
    })
  },
  dashboard: {
    getStats: () => makeApiRequest('/dashboard/stats')
  }
};