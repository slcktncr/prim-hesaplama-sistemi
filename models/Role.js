const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  permissions: {
    // Genel Yetkiler
    canViewDashboard: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: true },
    canExportData: { type: Boolean, default: false },
    
    // Satış Yetkileri
    canViewSales: { type: Boolean, default: true },
    canCreateSales: { type: Boolean, default: true },
    canEditSales: { type: Boolean, default: false },
    canDeleteSales: { type: Boolean, default: false },
    canViewAllSales: { type: Boolean, default: false }, // Tüm temsilcilerin satışlarını görebilir
    canTransferSales: { type: Boolean, default: false },
    canCancelSales: { type: Boolean, default: false },
    canModifySales: { type: Boolean, default: false },
    canImportSales: { type: Boolean, default: false },
    
    // Prim Yetkileri
    canViewPrims: { type: Boolean, default: true },
    canManagePrimPeriods: { type: Boolean, default: false },
    canEditPrimRates: { type: Boolean, default: false },
    canProcessPayments: { type: Boolean, default: false },
    canViewAllEarnings: { type: Boolean, default: false }, // Tüm temsilcilerin primlerini görebilir
    
    // İletişim Yetkileri
    canViewCommunications: { type: Boolean, default: true },
    canEditCommunications: { type: Boolean, default: true },
    canViewAllCommunications: { type: Boolean, default: false }, // Tüm temsilcilerin iletişimlerini görebilir
    
    // Kullanıcı Yönetimi
    canViewUsers: { type: Boolean, default: false },
    canCreateUsers: { type: Boolean, default: false },
    canEditUsers: { type: Boolean, default: false },
    canDeleteUsers: { type: Boolean, default: false },
    canManageRoles: { type: Boolean, default: false },
    
    // Sistem Yönetimi
    canAccessSystemSettings: { type: Boolean, default: false },
    canManageBackups: { type: Boolean, default: false },
    canViewSystemLogs: { type: Boolean, default: false },
    canManageAnnouncements: { type: Boolean, default: false },
    
    // Özel Yetkiler
    canViewPenalties: { type: Boolean, default: false },
    canApplyPenalties: { type: Boolean, default: false },
    canOverrideValidations: { type: Boolean, default: false }
  },
  isSystemRole: {
    type: Boolean,
    default: false // Sistem rolleri (admin, user) silinemez
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Güncelleme zamanını otomatik ayarla
roleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Sistem rollerinin silinmesini engelle
roleSchema.pre('deleteOne', { document: true, query: false }, function(next) {
  if (this.isSystemRole) {
    return next(new Error('Sistem rolleri silinemez'));
  }
  next();
});

module.exports = mongoose.model('Role', roleSchema);
