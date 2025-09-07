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
  
  // Aylık veriler (sadece geçmiş yıllar için)
  monthlyData: {
    type: Map,
    of: {
      // Her ay için temsilci verileri: { userId: { whatsapp: 100, ... } }
      type: Map,
      of: {
        whatsappIncoming: { type: Number, default: 0 },
        callIncoming: { type: Number, default: 0 },
        callOutgoing: { type: Number, default: 0 },
        meetingNewCustomer: { type: Number, default: 0 },
        meetingAfterSale: { type: Number, default: 0 },
        totalMeetings: { type: Number, default: 0 },
        totalCommunication: { type: Number, default: 0 }
      }
    },
    default: new Map()
  },

  // Yıllık satış verileri (sadece geçmiş yıllar için)
  yearlySalesData: {
    type: Map,
    of: {
      // Her temsilci için yıllık toplam satış verileri
      totalSales: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      totalPrim: { type: Number, default: 0 },
      cancellations: { type: Number, default: 0 },
      cancellationAmount: { type: Number, default: 0 }
    },
    default: new Map()
  },

  // Geçmiş temsilciler (artık sistemde olmayan)
  historicalUsers: [{
    _id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    isHistorical: {
      type: Boolean,
      default: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
