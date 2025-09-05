const mongoose = require('mongoose');

const primRateSchema = new mongoose.Schema({
  rate: {
    type: Number,
    required: true,
    default: 1, // %1
    min: 0,
    max: 100
  },
  effectiveDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PrimRate', primRateSchema);
