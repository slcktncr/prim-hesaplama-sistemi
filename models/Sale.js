const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Müşteri bilgileri
  customerName: {
    type: String,
    required: [true, 'Müşteri adı soyadı gereklidir'],
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [15, 'Telefon numarası 15 karakterden uzun olamaz'],
    validate: {
      validator: function(v) {
        if (!v) return true; // Opsiyonel alan
        // Basit telefon numarası formatı kontrolü
        return /^[\d\s\-\+\(\)]+$/.test(v);
      },
      message: 'Geçerli bir telefon numarası giriniz'
    }
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
    required: true,
    default: 'satis',
    trim: true,
    maxlength: [50, 'Satış türü 50 karakterden uzun olamaz']
  },
  saleDate: {
    type: Date,
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
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
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
    },
    trim: true,
    default: null // Kapora için null değer
  },
  listPrice: {
    type: Number,
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
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
      return this.saleType !== 'kapora' && this.discountRate > 0; // Kapora değilse ve indirim varsa gerekli
    }
  },
  activitySalePrice: {
    type: Number,
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
    },
    min: 0
  },
  paymentType: {
    type: String,
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
    },
    trim: true,
    maxlength: [50, 'Ödeme tipi 50 karakterden uzun olamaz']
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
  primRate: {
    type: Number,
    min: 0,
    max: 100,
    validate: {
      validator: function(v) {
        return v == null || (v >= 0 && v <= 100);
      },
      message: 'Prim oranı 0-100 arasında olmalıdır'
    }
  },
  primAmount: {
    type: Number,
    default: 0
  },
  basePrimPrice: {
    type: Number, // Liste fiyatı ve aktivite satış fiyatından düşük olan
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
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
  primStatusUpdatedAt: {
    type: Date
  },
  primStatusUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
    required: function() {
      return this.saleType !== 'kapora'; // Sadece kapora değilse gerekli
    }
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
  },
  
  // Değişiklik geçmişi
  isModified: {
    type: Boolean,
    default: false
  },
  modificationHistory: [{
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      trim: true
    },
    previousData: {
      blockNo: String,
      apartmentNo: String,
      periodNo: String,
      listPrice: Number,
      discountRate: Number,
      activitySalePrice: Number,
      contractNo: String,
      saleDate: Date,
      kaporaDate: Date,
      entryDate: String,
      exitDate: String,
      basePrimPrice: Number,
      primAmount: Number
    },
    newData: {
      blockNo: String,
      apartmentNo: String,
      periodNo: String,
      listPrice: Number,
      discountRate: Number,
      activitySalePrice: Number,
      contractNo: String,
      saleDate: Date,
      kaporaDate: Date,
      entryDate: String,
      exitDate: String,
      basePrimPrice: Number,
      primAmount: Number
    }
  }],
  
  // Import tracking fields
  isImported: {
    type: Boolean,
    default: false
  },
  originalSalesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Prim hesaplama middleware
saleSchema.pre('save', function(next) {
  // Sadece kapora değilse prim hesapla
  if (this.saleType !== 'kapora') {
    // İndirimli liste fiyatını hesapla
    const discountedListPrice = this.discountRate ? 
      this.listPrice * (1 - this.discountRate / 100) : 
      this.listPrice;
    
    // En düşük fiyatı bul (indirimli liste fiyatı vs aktivite satış fiyatı)
    this.basePrimPrice = Math.min(discountedListPrice, this.activitySalePrice || discountedListPrice);
    
    // Prim tutarını hesapla  
    // primRate yüzde değeri olarak saklanıyor (1 = %1)
    this.primAmount = this.basePrimPrice * (this.primRate / 100);
  }
  
  this.updatedAt = Date.now();
  next();
});

// ContractNo için sparse unique index
saleSchema.index({ contractNo: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Sale', saleSchema);
