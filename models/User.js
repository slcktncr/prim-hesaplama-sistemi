const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Ad gereklidir'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Soyad gereklidir'],
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email gereklidir'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Şifre gereklidir'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'salesperson', 'visitor'],
    default: 'salesperson'
  },
  // Yetkilendirme sistemi
  permissions: {
    canViewAllSales: { type: Boolean, default: false },
    canViewAllReports: { type: Boolean, default: false },
    canViewAllPrims: { type: Boolean, default: false },
    canViewDashboard: { type: Boolean, default: true },
    canManageOwnSales: { type: Boolean, default: true },
    canViewOwnReports: { type: Boolean, default: true },
    canViewOwnPrims: { type: Boolean, default: true }
  },
  isActive: {
    type: Boolean,
    default: false // Varsayılan olarak pasif, admin onayı bekler
  },
  isApproved: {
    type: Boolean,
    default: false // Admin onayı
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  
  // Ceza puanı sistemi
  isPenaltyDeactivated: {
    type: Boolean,
    default: false // Ceza puanı nedeniyle pasifleştirilmiş mi?
  },
  penaltyDeactivatedAt: {
    type: Date
  },
  
  // İletişim kayıt sistemi
  requiresCommunicationEntry: {
    type: Boolean,
    default: true // İletişim kaydı girme zorunluluğu var mı?
  },
  communicationExemptReason: {
    type: String,
    trim: true // Muafiyet sebebi
  },
  communicationExemptBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Muafiyeti kim verdi?
  },
  communicationExemptAt: {
    type: Date // Muafiyet tarihi
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Name field'ini otomatik oluştur
userSchema.pre('save', function(next) {
  if (this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`;
  }
  next();
});

// Şifre hashleme ve rol bazlı izin ayarlama
userSchema.pre('save', async function(next) {
  // Şifre hashleme
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Ziyaretçi rolü için özel ayarlar
  if (this.role === 'visitor') {
    this.requiresCommunicationEntry = false; // İletişim kaydı girme zorunluluğu yok
    this.permissions = {
      canViewAllSales: true,        // Tüm satışları görüntüleyebilir
      canViewAllReports: true,      // Tüm raporları görüntüleyebilir
      canViewAllPrims: true,        // Tüm primleri görüntüleyebilir
      canViewDashboard: true,       // Dashboard'u görüntüleyebilir
      canManageOwnSales: false,     // Kendi satışlarını yönetemez
      canViewOwnReports: false,     // Kendi raporları yok
      canViewOwnPrims: false        // Kendi primleri yok
    };
  }
  
  next();
});

// Şifre kontrolü
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
