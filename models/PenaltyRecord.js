const mongoose = require('mongoose');

const penaltyRecordSchema = new mongoose.Schema({
  // Temsilci bilgisi
  salesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Yıl bilgisi
  year: {
    type: Number,
    required: true,
    index: true
  },
  
  // Ceza puanı bilgileri
  totalPenaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Hesap durumu
  isAccountActive: {
    type: Boolean,
    default: true
  },
  
  // Hesap pasife alınma bilgileri
  deactivatedAt: {
    type: Date
  },
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  deactivationReason: {
    type: String,
    default: 'Ceza puanı limitini aştı'
  },
  
  // Hesap aktifleştirme bilgileri
  reactivatedAt: {
    type: Date
  },
  reactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reactivationReason: {
    type: String
  },
  
  // Ceza geçmişi
  penaltyHistory: [{
    date: {
      type: Date,
      required: true
    },
    points: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true
    },
    appliedBy: {
      type: String,
      default: 'system'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Sistem bilgileri
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Benzersiz indeks: Bir temsilci için yılda sadece bir kayıt
penaltyRecordSchema.index({ salesperson: 1, year: 1 }, { unique: true });

// Güncelleme middleware
penaltyRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Ceza puanı ekleme metodu
penaltyRecordSchema.methods.addPenalty = function(points, reason, maxPoints = 100) {
  this.totalPenaltyPoints += points;
  
  this.penaltyHistory.push({
    date: new Date(),
    points: points,
    reason: reason,
    appliedBy: 'system'
  });
  
  // Maksimum puana ulaştıysa hesabı pasife al
  if (this.totalPenaltyPoints >= maxPoints && this.isAccountActive) {
    this.isAccountActive = false;
    this.deactivatedAt = new Date();
    this.deactivationReason = `Ceza puanı limitini aştı (${this.totalPenaltyPoints}/${maxPoints})`;
  }
  
  return this.save();
};

// Hesabı aktifleştirme metodu
penaltyRecordSchema.methods.reactivateAccount = function(adminId, reason = 'Admin tarafından aktifleştirildi') {
  this.isAccountActive = true;
  this.reactivatedAt = new Date();
  this.reactivatedBy = adminId;
  this.reactivationReason = reason;
  
  return this.save();
};

module.exports = mongoose.model('PenaltyRecord', penaltyRecordSchema);
