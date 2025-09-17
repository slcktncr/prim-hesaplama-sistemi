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
  // Tek rol sistemi - sadece Role modeli referansı
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true // Artık zorunlu - her kullanıcının bir rolü olmalı
  },
  // Kullanıcıya özel yetki override'ları (rol yetkilerinin üzerine yazar)
  individualPermissions: {
    // Genel Yetkiler
    canViewAllSales: { type: Boolean, default: null }, // null = rol yetkisini kullan
    canViewAllReports: { type: Boolean, default: null },
    canViewAllEarnings: { type: Boolean, default: null },
    canViewDashboard: { type: Boolean, default: null },
    canCreateSales: { type: Boolean, default: null },
    canEditSales: { type: Boolean, default: null },
    canDeleteSales: { type: Boolean, default: null }
    // Gerektiğinde daha fazla eklenebilir
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
  
  // Virtual user fields (for legacy data)
  isVirtual: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true
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
}, {
  timestamps: true // Bu, createdAt ve updatedAt'i otomatik ekler
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
  
  // Artık rol-based permissions kullanıyoruz, burada özel ayar yok
  
  next();
});

// Şifre kontrolü
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
