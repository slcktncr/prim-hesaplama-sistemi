import axios from 'axios';

// API base configuration
const API = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api',
  timeout: 300000, // 5 dakika timeout (büyük dosyalar için)
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
  updateProfile: (userData) => API.put('/auth/profile', userData),
};

// Sales API calls
export const salesAPI = {
  getSales: (params) => API.get('/sales', { params }),
  getSaleById: (id) => API.get(`/sales/${id}`),
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
  modifySale: (id, modificationData) => API.put(`/sales/${id}/modify`, modificationData),
  updateTransactionPeriod: (transactionId, newPeriodId) => 
    API.put(`/sales/transaction/${transactionId}/period`, { newPeriodId }),
  getUpcomingEntries: (days = 7) => API.get(`/sales/upcoming-entries?days=${days}`),
  bulkUpdatePrimStatus: (primStatus, filters) => API.put('/sales/bulk-prim-status', { primStatus, filters }),
  previewBulkPrimStatus: (primStatus, filters) => API.post('/sales/bulk-prim-status/preview', { primStatus, filters })
};

// Prims API calls
export const primsAPI = {
  getRate: () => API.get('/prims/rate'),
  updateRate: (rate) => API.post('/prims/rate', { rate }),
  getPeriods: () => API.get('/prims/periods'),
  createPeriod: (periodData) => API.post('/prims/periods', periodData),
  createBulkPeriods: (periodsData) => API.post('/prims/periods/bulk', periodsData),
  getTransactions: (params) => API.get('/prims/transactions', { params }),
  getEarnings: (params) => API.get('/prims/earnings', { params }),
  getDeductions: (params) => API.get('/prims/deductions', { params }),
  updateSalePeriod: (id, primPeriod) => API.put(`/prims/sales/${id}/period`, { primPeriod }),
  cleanupDuplicateDeductions: () => API.post('/prims/cleanup-duplicate-deductions'),
  approveDeduction: (id) => API.put(`/prims/deductions/${id}/approve`),
  cancelDeduction: (id) => API.put(`/prims/deductions/${id}/cancel`),
};

// Reports API calls
export const reportsAPI = {
  getDashboard: (params = {}) => API.get('/reports/dashboard', { params }),
  getSalesSummary: (params) => API.get('/reports/sales-summary', { params }),
  getSalespersonPerformance: (params) => API.get('/reports/salesperson-performance', { params }),
  getPeriodComparison: () => API.get('/reports/period-comparison'),
  getTopPerformers: (params) => API.get('/reports/top-performers', { params }),
  getCancellationPerformance: (params) => API.get('/reports/cancellation-performance', { params }),
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
  getUsersForFilters: () => API.get('/users/for-filters'),
  changeRole: (id, role, customRole = null) => API.put(`/users/${id}/role`, { role, customRole }),
  updatePermissions: (id, permissions) => API.put(`/users/${id}/permissions`, { permissions }),
  updateUser: (id, userData) => API.put(`/users/${id}`, userData),
  updateCommunicationRequirement: (id, data) => API.put(`/users/${id}/communication-requirement`, data),
  getCommunicationSettings: () => API.get('/users/communication-settings')
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

// System Settings API calls
export const systemSettingsAPI = {
  // Sale Types
  getSaleTypes: () => API.get('/system-settings/sale-types'),
  createSaleType: (data) => API.post('/system-settings/sale-types', data),
  updateSaleType: (id, data) => API.put(`/system-settings/sale-types/${id}`, data),
  deleteSaleType: (id) => API.delete(`/system-settings/sale-types/${id}`),
  
  // Payment Types
  getPaymentTypes: () => API.get('/system-settings/payment-types'),
  createPaymentType: (data) => API.post('/system-settings/payment-types', data),
  updatePaymentType: (id, data) => API.put(`/system-settings/payment-types/${id}`, data),
  deletePaymentType: (id) => API.delete(`/system-settings/payment-types/${id}`)
};

// Communications API calls
export const communicationsAPI = {
  getToday: () => API.get('/communications/today'),
  saveDaily: (data) => API.post('/communications/daily', data),
  getRecords: (params) => API.get('/communications/records', { params }),
  getReport: (params) => API.get('/communications/report', { params }),
  getPeriodReport: (params) => API.get('/communications/period-report', { params }),
  getDailyReport: (params) => API.get('/communications/daily-report', { params }),
  createYear: (data) => API.post('/communications/years', data),
  updateYear: (id, data) => API.put(`/communications/years/${id}`, data),
  deleteYear: (id) => API.delete(`/communications/years/${id}`)
};

// Penalties API calls
export const penaltiesAPI = {
  getMyStatus: () => API.get('/penalties/my-status'),
  getAllUsers: (params) => API.get('/penalties/all-users', { params }),
  reactivateUser: (userId, data) => API.post(`/penalties/reactivate/${userId}`, data),
  checkDaily: (data) => API.post('/penalties/check-daily', data),
  addManualPenalty: (data) => API.post('/penalties/manual-penalty', data)
};

// Daily Status API calls
export const dailyStatusAPI = {
  getMyStatus: () => API.get('/daily-status/my-status'),
  setStatus: (status, statusNote) => API.post('/daily-status/set-status', { status, statusNote }),
  getTeamStatus: () => API.get('/daily-status/team-status'),
  getHistory: (params) => API.get('/daily-status/history', { params }),
  adminSetStatus: (userId, status, statusNote, date) => API.post(`/daily-status/admin/set-status/${userId}`, { status, statusNote, date }),
  adminGetAllStatuses: (date) => API.get('/daily-status/admin/all-statuses', { params: { date } })
};

// Announcements API
export const announcementsAPI = {
  getAll: (includeRead = false) => API.get(`/announcements?includeRead=${includeRead}`),
  getUnreadCount: () => API.get('/announcements/unread-count'),
  markAsRead: (id) => API.post(`/announcements/${id}/read`),
  getAdminAll: () => API.get('/announcements/admin'),
  create: (data) => API.post('/announcements', data),
  update: (id, data) => API.put(`/announcements/${id}`, data),
  delete: (id) => API.delete(`/announcements/${id}`)
};

// Activities API
export const activitiesAPI = {
  getAll: (limit = 20, unreadOnly = false) => API.get(`/activities?limit=${limit}&unreadOnly=${unreadOnly}`),
  getUnreadCount: () => API.get('/activities/unread-count'),
  markAsRead: (id) => API.post(`/activities/${id}/read`),
  markAllAsRead: () => API.post('/activities/mark-all-read'),
  getSystemActivities: (limit = 50, severity, action) => {
    let url = `/activities/system?limit=${limit}`;
    if (severity) url += `&severity=${severity}`;
    if (action) url += `&action=${action}`;
    return API.get(url);
  },
  getStats: (days = 7) => API.get(`/activities/stats?days=${days}`)
};

// Migration API
export const migrationAPI = {
  getHistoricalYears: () => API.get('/migration/historical-years'),
  migrateHistoricalToDaily: (data) => API.post('/migration/historical-to-daily', data),
  createLegacyUser: () => API.post('/migration/create-legacy-user'),
  assignSalesToLegacy: (data) => API.put('/migration/assign-sales-to-legacy', data)
};

// Sales Import API
export const salesImportAPI = {
  uploadFile: (formData) => API.post('/sales-import/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 600000, // 10 dakika timeout (büyük Excel dosyaları için)
  }),
  downloadTemplate: () => API.get('/sales-import/template', { responseType: 'blob' }),
  rollbackImports: (options = {}) => {
    const { hours, startDate, endDate } = options;
    return API.delete('/sales-import/rollback', { 
      data: { hours, startDate, endDate },
      timeout: 300000, // 5 dakika timeout
    });
  },
  // Backup Management
  getBackups: () => API.get('/sales-import/backups'),
  restoreFromBackup: (filename, confirmRestore = true) => API.post(`/sales-import/restore/${filename}`, { confirmRestore }),
  createManualBackup: (type, description) => API.post('/sales-import/create-backup', { type, description }),
  downloadBackup: (filename) => API.get(`/sales-import/download/${filename}`, { responseType: 'blob' })
};

// Roles API
export const rolesAPI = {
  getAllRoles: () => API.get('/roles'),
  getRoleById: (id) => API.get(`/roles/${id}`),
  createRole: (roleData) => API.post('/roles', roleData),
  updateRole: (id, roleData) => API.put(`/roles/${id}`, roleData),
  deleteRole: (id) => API.delete(`/roles/${id}`),
  getPermissionsList: () => API.get('/roles/permissions/list'),
  toggleRoleStatus: (id) => API.post(`/roles/${id}/toggle-status`)
};

export default API;
