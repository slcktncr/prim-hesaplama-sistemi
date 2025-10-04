const mongoose = require('mongoose');

const communicationTypeSchema = new mongoose.Schema({
  // İletişim türü adı
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 50
  },
  
  // İletişim türü kodu (API'de kullanılacak)
  code: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    uppercase: true,
    maxlength: 20
  },
  
  // Açıklama
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  // İletişim türü kategorisi
  category: {
    type: String,
    enum: ['incoming', 'outgoing', 'meeting', 'other'],
    required: true
  },
  
  // Aktif mi?
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Sıralama
  sortOrder: {
    type: Number,
    default: 0
  },
  
  // Renk kodu (UI'da gösterim için)
  color: {
    type: String,
    default: '#007bff',
    validate: {
      validator: function(v) {
        return /^#[0-9A-F]{6}$/i.test(v);
      },
      message: 'Renk kodu geçerli hex formatında olmalıdır (#RRGGBB)'
    }
  },
  
  // İkon (react-icons kodu)
  icon: {
    type: String,
    default: 'FiMessageCircle'
  },
  
  // Minimum değer
  minValue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Maksimum değer (0 = sınırsız)
  maxValue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Zorunlu mu?
  isRequired: {
    type: Boolean,
    default: false
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
    ref: 'User',
    required: true
  }
});

// Güncelleme middleware
communicationTypeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index'ler
communicationTypeSchema.index({ code: 1 });
communicationTypeSchema.index({ isActive: 1 });
communicationTypeSchema.index({ category: 1 });
communicationTypeSchema.index({ sortOrder: 1 });

module.exports = mongoose.model('CommunicationType', communicationTypeSchema);
