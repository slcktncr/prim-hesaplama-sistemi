const mongoose = require('mongoose');

const paymentTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: [50, 'Ödeme tipi adı 50 karakterden uzun olamaz']
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
paymentTypeSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } }, 
      { isDefault: false }
    );
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PaymentType', paymentTypeSchema);
