const mongoose = require('mongoose');

const penaltyRecordSchema = new mongoose.Schema({
  // Ceza alan kullanıcı
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Ceza puanı
  points: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  
  // Ceza sebebi
  reason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // Ceza tarihi
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Ceza türü
  type: {
    type: String,
    enum: ['missed_entry', 'manual', 'late_entry', 'invalid_entry'],
    default: 'missed_entry',
    index: true
  },
  
  // Durum bilgileri
  isCancelled: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // İptal bilgileri
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  cancelledAt: {
    type: Date
  },
  
  cancelReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Çözüm bilgileri
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  resolvedAt: {
    type: Date
  },
  
  resolveReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Kim tarafından oluşturuldu
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Otomatik çözülme tarihi (opsiyonel)
  autoResolveAt: {
    type: Date
  },
  
  // Notlar
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// İndeksler
penaltyRecordSchema.index({ user: 1, date: -1 });
penaltyRecordSchema.index({ type: 1, isCancelled: 1 });
penaltyRecordSchema.index({ createdAt: -1 });

// Sanal alanlar
penaltyRecordSchema.virtual('isActive').get(function() {
  return !this.isCancelled && !this.isResolved;
});

// JSON'a çevirirken sanal alanları dahil et
penaltyRecordSchema.set('toJSON', { virtuals: true });

// Ceza iptal etme metodu
penaltyRecordSchema.methods.cancel = function(adminId, reason) {
  this.isCancelled = true;
  this.cancelledBy = adminId;
  this.cancelledAt = new Date();
  this.cancelReason = reason;
  
  return this.save();
};

// Ceza çözme metodu
penaltyRecordSchema.methods.resolve = function(adminId, reason) {
  this.isResolved = true;
  this.resolvedBy = adminId;
  this.resolvedAt = new Date();
  this.resolveReason = reason;
  
  return this.save();
};

// Statics - Kullanıcının aktif ceza puanlarını hesapla
penaltyRecordSchema.statics.getUserActivePenalties = function(userId) {
  return this.find({
    user: userId,
    isCancelled: false,
    isResolved: false
  });
};

penaltyRecordSchema.statics.getUserTotalActivePoints = async function(userId) {
  const penalties = await this.getUserActivePenalties(userId);
  return penalties.reduce((total, penalty) => total + penalty.points, 0);
};

module.exports = mongoose.model('PenaltyRecord', penaltyRecordSchema);
