const mongoose = require('mongoose');

const primTransactionSchema = new mongoose.Schema({
  salesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  primPeriod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrimPeriod',
    required: true
  },
  
  // İşlem tipi
  transactionType: {
    type: String,
    enum: ['kazanç', 'kesinti', 'transfer_gelen', 'transfer_giden'],
    required: true
  },
  
  // Tutarlar
  amount: {
    type: Number,
    required: true
  },
  
  // Açıklama
  description: {
    type: String,
    required: true
  },
  
  // İşlem durumu
  status: {
    type: String,
    enum: ['beklemede', 'onaylandı', 'iptal'],
    default: 'onaylandı'
  },
  
  // İlgili işlemler
  relatedTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrimTransaction'
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

module.exports = mongoose.model('PrimTransaction', primTransactionSchema);
