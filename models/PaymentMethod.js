const mongoose = require('mongoose');

const PaymentMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Ödeme yöntemi adı gereklidir'],
    unique: true,
    trim: true,
    maxlength: [50, 'Ödeme yöntemi adı 50 karakterden uzun olamaz']
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
  sortOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Sadece bir tane default ödeme yöntemi olabilir
PaymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// İndeksler
PaymentMethodSchema.index({ name: 1 });
PaymentMethodSchema.index({ isActive: 1 });
PaymentMethodSchema.index({ sortOrder: 1 });

module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);
