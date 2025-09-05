const mongoose = require('mongoose');

const saleTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: [50, 'Satış türü adı 50 karakterden uzun olamaz']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Açıklama 200 karakterden uzun olamaz']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: 'success', // Bootstrap color classes: primary, secondary, success, danger, warning, info, light, dark
    enum: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']
  },
  sortOrder: {
    type: Number,
    default: 0
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
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Sadece bir tane default olabilir
saleTypeSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } }, 
      { isDefault: false }
    );
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SaleType', saleTypeSchema);
