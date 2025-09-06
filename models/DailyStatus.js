const mongoose = require('mongoose');

const dailyStatusSchema = new mongoose.Schema({
  // Temel bilgiler
  salesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  
  // Durum bilgileri
  status: {
    type: String,
    enum: ['mesaide', 'izinli', 'hastalik', 'resmi_tatil'],
    default: 'mesaide',
    required: true
  },
  statusNote: {
    type: String,
    trim: true,
    maxlength: 200 // İzin sebebi, hastalık durumu vb.
  },
  
  // Zaman bilgileri
  statusSetAt: {
    type: Date,
    default: Date.now // Durum ne zaman ayarlandı
  },
  statusSetBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Durumu kim ayarladı (kendisi veya admin)
  },
  
  // Otomatik durum tespiti
  isAutoSet: {
    type: Boolean,
    default: false // Sistem tarafından otomatik mi ayarlandı
  },
  autoSetReason: {
    type: String,
    trim: true // Otomatik ayarlama sebebi
  },
  
  // Ceza muafiyeti
  isPenaltyExempt: {
    type: Boolean,
    default: false // Bu gün için ceza muafiyeti var mı
  },
  exemptReason: {
    type: String,
    trim: true // Muafiyet sebebi
  },
  
  // Geçmiş takibi
  statusHistory: [{
    previousStatus: {
      type: String,
      enum: ['mesaide', 'izinli', 'hastalik', 'resmi_tatil']
    },
    newStatus: {
      type: String,
      enum: ['mesaide', 'izinli', 'hastalik', 'resmi_tatil']
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changeReason: {
      type: String,
      trim: true
    }
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// İndeksler
dailyStatusSchema.index({ salesperson: 1, date: 1 }, { unique: true });
dailyStatusSchema.index({ date: 1 });
dailyStatusSchema.index({ year: 1, month: 1 });
dailyStatusSchema.index({ status: 1 });
dailyStatusSchema.index({ salesperson: 1, year: 1, month: 1 });

// Middleware - updatedAt otomatik güncelleme
dailyStatusSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual - Durum açıklaması
dailyStatusSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'mesaide': 'Mesaide',
    'izinli': 'İzinli',
    'hastalik': 'Hastalık İzni',
    'resmi_tatil': 'Resmi Tatil'
  };
  return statusMap[this.status] || this.status;
});

// Virtual - Ceza muafiyeti durumu
dailyStatusSchema.virtual('shouldGetPenalty').get(function() {
  // İzinli, hastalık veya resmi tatilde ise ceza almamalı
  return !['izinli', 'hastalik', 'resmi_tatil'].includes(this.status) && !this.isPenaltyExempt;
});

// Static method - Bugünkü durumu getir
dailyStatusSchema.statics.getTodayStatus = async function(salespersonId) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return await this.findOne({
    salesperson: salespersonId,
    date: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  }).populate('statusSetBy', 'name');
};

// Static method - Belirli tarih için durumu getir
dailyStatusSchema.statics.getStatusForDate = async function(salespersonId, date) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return await this.findOne({
    salesperson: salespersonId,
    date: {
      $gte: startOfDay,
      $lt: endOfDay
    }
  }).populate('statusSetBy', 'name');
};

// Static method - Durum istatistikleri
dailyStatusSchema.statics.getStatusStats = async function(date) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
        date: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        users: { $push: '$salesperson' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'users',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        users: {
          $map: {
            input: '$userDetails',
            as: 'user',
            in: {
              _id: '$$user._id',
              name: '$$user.name',
              email: '$$user.email'
            }
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('DailyStatus', dailyStatusSchema);
