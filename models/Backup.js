const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['sales', 'communications', 'manual', 'rollback', 'pre-restore', 'test'],
    default: 'manual'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  recordCount: {
    type: Number,
    required: true,
    min: 0
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    originalTimestamp: String,
    backupVersion: {
      type: String,
      default: '1.0'
    },
    compression: {
      type: String,
      default: 'none'
    }
  }
}, {
  timestamps: true
});

// Index'ler
backupSchema.index({ type: 1, createdAt: -1 });
backupSchema.index({ createdBy: 1, createdAt: -1 });
backupSchema.index({ isActive: 1, createdAt: -1 });

// Virtual: Dosya boyutu formatı
backupSchema.virtual('formattedSize').get(function() {
  if (this.fileSize === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileSize) / Math.log(k));
  return parseFloat((this.fileSize / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual: Yaş (gün)
backupSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.createdAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method: Yedek verilerini al
backupSchema.methods.getBackupData = function() {
  return {
    filename: this.filename,
    type: this.type,
    description: this.description,
    recordCount: this.recordCount,
    fileSize: this.fileSize,
    formattedSize: this.formattedSize,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
    ageInDays: this.ageInDays,
    metadata: this.metadata
  };
};

// Method: Yedek verilerini JSON olarak döndür (eski format uyumluluğu için)
backupSchema.methods.toBackupFormat = function() {
  return {
    timestamp: this.metadata.originalTimestamp || this.createdAt.toISOString(),
    type: this.type,
    count: this.recordCount,
    data: this.data
  };
};

// Static: Aktif yedekleri listele
backupSchema.statics.getActiveBackups = function(options = {}) {
  const query = { isActive: true };
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.createdBy) {
    query.createdBy = options.createdBy;
  }
  
  return this.find(query)
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

// Static: Eski yedekleri temizle
backupSchema.statics.cleanOldBackups = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    { 
      createdAt: { $lt: cutoffDate },
      isActive: true 
    },
    { 
      isActive: false 
    }
  );
};

module.exports = mongoose.model('Backup', backupSchema);
