import axios from 'axios';

// API base configuration
const API = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000',
  timeout: 10000,
});

// Request interceptor to add auth token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: (credentials) => API.post('/api/auth/login', credentials),
  register: (userData) => API.post('/api/auth/register', userData),
  getProfile: () => API.get('/api/auth/me'),
};

// Sales API calls
export const salesAPI = {
  getSales: (params) => API.get('/api/sales', { params }),
  createSale: (saleData) => API.post('/api/sales', saleData),
  updateSale: (id, saleData) => API.put(`/api/sales/${id}`, saleData),
  cancelSale: (id) => API.put(`/api/sales/${id}/cancel`),
  restoreSale: (id) => API.put(`/api/sales/${id}/restore`),
  transferSale: (id, newSalesperson) => API.put(`/api/sales/${id}/transfer`, { newSalesperson }),
  updatePrimStatus: (id, primStatus) => API.put(`/api/sales/${id}/prim-status`, { primStatus }),
};

// Prims API calls
export const primsAPI = {
  getRate: () => API.get('/api/prims/rate'),
  updateRate: (rate) => API.post('/api/prims/rate', { rate }),
  getPeriods: () => API.get('/api/prims/periods'),
  createPeriod: (periodData) => API.post('/api/prims/periods', periodData),
  getTransactions: (params) => API.get('/api/prims/transactions', { params }),
  getEarnings: (params) => API.get('/api/prims/earnings', { params }),
  updateSalePeriod: (id, primPeriod) => API.put(`/api/prims/sales/${id}/period`, { primPeriod }),
};

// Reports API calls
export const reportsAPI = {
  getDashboard: () => API.get('/api/reports/dashboard'),
  getSalesSummary: (params) => API.get('/api/reports/sales-summary', { params }),
  getSalespersonPerformance: (params) => API.get('/api/reports/salesperson-performance', { params }),
  getPeriodComparison: () => API.get('/api/reports/period-comparison'),
  getTopPerformers: (params) => API.get('/api/reports/top-performers', { params }),
  getDetailedReport: (params) => API.get('/api/reports/detailed-report', { params }),
};

export default API;
