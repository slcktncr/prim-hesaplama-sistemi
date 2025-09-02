const mongoose = require('mongoose');

const primPeriodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true // "Eylül 2025" gibi
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PrimPeriod', primPeriodSchema);
