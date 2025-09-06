const mongoose = require('mongoose');

const communicationYearSchema = new mongoose.Schema({
  // Yıl bilgisi
  year: {
    type: Number,
    required: true,
    unique: true,
    min: 2021,
    max: 2030
  },
  
  // Yıl türü
  type: {
    type: String,
    enum: ['historical', 'active'],
    required: true
  },
  
  // Yıl durumu
  isActive: {
    type: Boolean,
    default: false
  },
  
  // Ayarlar
  settings: {
    // Günlük veri girişi zorunlu mu?
    dailyEntryRequired: {
      type: Boolean,
      default: true
    },
    
    // Ceza puanı sistemi aktif mi?
    penaltySystemActive: {
      type: Boolean,
      default: true
    },
    
    // Günlük ceza puanı
    dailyPenaltyPoints: {
      type: Number,
      default: 10,
      min: 0
    },
    
    // Maksimum ceza puanı (hesap pasife alınma)
    maxPenaltyPoints: {
      type: Number,
      default: 100,
      min: 0
    },
    
    // Veri girişi son saati
    entryDeadlineHour: {
      type: Number,
      default: 23,
      min: 0,
      max: 23
    }
  },
  
  // İstatistikler (sadece geçmiş yıllar için)
  statistics: {
    totalCommunication: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    },
    totalCancellations: {
      type: Number,
      default: 0
    },
    totalModifications: {
      type: Number,
      default: 0
    }
  },
  
  // Sistem bilgileri
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Güncelleme middleware
communicationYearSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CommunicationYear', communicationYearSchema);
