import axios from 'axios';

// API base configuration
const API = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api',
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
  login: (credentials) => API.post('/auth/login', credentials),
  register: (userData) => API.post('/auth/register', userData),
  getProfile: () => API.get('/auth/me'),
};

// Sales API calls
export const salesAPI = {
  getSales: (params) => API.get('/sales', { params }),
  createSale: (saleData) => API.post('/sales', saleData),
  updateSale: (id, saleData) => API.put(`/sales/${id}`, saleData),
  cancelSale: (id) => API.put(`/sales/${id}/cancel`),
  restoreSale: (id) => API.put(`/sales/${id}/restore`),
  transferSale: (id, transferData) => API.put(`/sales/${id}/transfer`, transferData),
  updatePrimStatus: (id, primStatus) => API.put(`/sales/${id}/prim-status`, { primStatus }),
  deleteSale: (id) => API.delete(`/sales/${id}`),
  updateNotes: (id, notes) => API.put(`/sales/${id}/notes`, { notes }),
  deleteNotes: (id) => API.delete(`/sales/${id}/notes`),
  convertToSale: (id, saleData) => API.put(`/sales/${id}/convert-to-sale`, saleData),
};

// Prims API calls
export const primsAPI = {
  getRate: () => API.get('/prims/rate'),
  updateRate: (rate) => API.post('/prims/rate', { rate }),
  getPeriods: () => API.get('/prims/periods'),
  createPeriod: (periodData) => API.post('/prims/periods', periodData),
  getTransactions: (params) => API.get('/prims/transactions', { params }),
  getEarnings: (params) => API.get('/prims/earnings', { params }),
  updateSalePeriod: (id, primPeriod) => API.put(`/prims/sales/${id}/period`, { primPeriod }),
};

// Reports API calls
export const reportsAPI = {
  getDashboard: () => API.get('/reports/dashboard'),
  getSalesSummary: (params) => API.get('/reports/sales-summary', { params }),
  getSalespersonPerformance: (params) => API.get('/reports/salesperson-performance', { params }),
  getPeriodComparison: () => API.get('/reports/period-comparison'),
  getTopPerformers: (params) => API.get('/reports/top-performers', { params }),
  getDetailedReport: (params) => API.get('/reports/detailed-report', { params }),
  exportReport: (data) => API.post('/reports/export', data),
  exportExcel: (data) => API.post('/reports/export', data, { responseType: 'blob' }),
  exportPDF: (data) => API.post('/reports/export', data, { responseType: 'blob' })
};

// Users API calls
export const usersAPI = {
  getPendingUsers: () => API.get('/users/pending'),
  approveUser: (id) => API.put(`/users/${id}/approve`),
  rejectUser: (id) => API.delete(`/users/${id}/reject`),
  getSalespeople: () => API.get('/users/salespeople'),
  getAllUsers: () => API.get('/users/all-users'),
  changeRole: (id, role) => API.put(`/users/${id}/role`, { role }),
  updatePermissions: (id, permissions) => API.put(`/users/${id}/permissions`, { permissions }),
};

// Payment Methods API calls
export const paymentMethodsAPI = {
  getAll: (includeInactive) => API.get('/payment-methods', { params: { includeInactive } }),
  getActive: () => API.get('/payment-methods/active'),
  create: (data) => API.post('/payment-methods', data),
  update: (id, data) => API.put(`/payment-methods/${id}`, data),
  delete: (id) => API.delete(`/payment-methods/${id}`),
  toggleStatus: (id) => API.put(`/payment-methods/${id}/toggle-status`)
};

export default API;
