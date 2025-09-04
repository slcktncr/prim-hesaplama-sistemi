const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Müşteri bilgileri
  customerName: {
    type: String,
    required: [true, 'Müşteri adı soyadı gereklidir'],
    trim: true
  },
  blockNo: {
    type: String,
    required: [true, 'Blok no gereklidir'],
    trim: true
  },
  apartmentNo: {
    type: String,
    required: [true, 'Daire no gereklidir'],
    trim: true
  },
  periodNo: {
    type: String,
    required: [true, 'Dönem no gereklidir'],
    trim: true
  },
  
  // Satış bilgileri
  saleType: {
    type: String,
    enum: ['kapora', 'satis'],
    default: 'satis',
    required: true
  },
  saleDate: {
    type: Date,
    required: function() {
      return this.saleType === 'satis';
    }
  },
  kaporaDate: {
    type: Date,
    required: function() {
      return this.saleType === 'kapora';
    }
  },
  contractNo: {
    type: String,
    required: [true, 'Sözleşme no gereklidir'],
    unique: true,
    trim: true
  },
  listPrice: {
    type: Number,
    required: function() {
      return this.saleType === 'satis';
    },
    min: 0
  },
  discountRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    validate: {
      validator: function(v) {
        return v >= 0 && v <= 100;
      },
      message: 'İndirim oranı 0-100 arasında olmalıdır'
    }
  },
  discountedListPrice: {
    type: Number,
    min: 0
  },
  originalListPrice: {
    type: Number, // İndirim öncesi orijinal liste fiyatı
    required: function() {
      return this.saleType === 'satis' && this.discountRate > 0;
    }
  },
  activitySalePrice: {
    type: Number,
    required: function() {
      return this.saleType === 'satis';
    },
    min: 0
  },
  paymentType: {
    type: String,
    required: function() {
      return this.saleType === 'satis';
    },
    enum: ['Nakit', 'Kredi', 'Taksit', 'Diğer']
  },
  
  // Giriş-çıkış tarihleri (gün/ay formatında)
  entryDate: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opsiyonel alan
        return /^([0-2][0-9]|3[01])\/([0][1-9]|1[0-2])$/.test(v);
      },
      message: 'Giriş tarihi GG/AA formatında olmalıdır'
    }
  },
  exitDate: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opsiyonel alan
        return /^([0-2][0-9]|3[01])\/([0][1-9]|1[0-2])$/.test(v);
      },
      message: 'Çıkış tarihi GG/AA formatında olmalıdır'
    }
  },
  
  // Notlar sistemi
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  notesAddedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notesAddedAt: {
    type: Date
  },
  notesUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notesUpdatedAt: {
    type: Date
  },
  
  // Prim hesaplama bilgileri
  primAmount: {
    type: Number,
    default: 0
  },
  primRate: {
    type: Number,
    required: function() {
      return this.saleType === 'satis';
    }
  },
  basePrimPrice: {
    type: Number, // Liste fiyatı ve aktivite satış fiyatından düşük olan
    required: function() {
      return this.saleType === 'satis';
    }
  },
  
  // Durum bilgileri
  status: {
    type: String,
    enum: ['aktif', 'iptal'],
    default: 'aktif'
  },
  primStatus: {
    type: String,
    enum: ['ödenmedi', 'ödendi'],
    default: 'ödenmedi'
  },
  
  // İlişkiler
  salesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  primPeriod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrimPeriod',
    required: true
  },
  
  // Tarihler
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Transfer bilgileri
  transferredFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  transferredAt: {
    type: Date
  },
  transferredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Prim hesaplama middleware
saleSchema.pre('save', function(next) {
  // En düşük fiyatı bul
  this.basePrimPrice = Math.min(this.listPrice, this.activitySalePrice);
  // Prim tutarını hesapla
  this.primAmount = this.basePrimPrice * this.primRate;
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
