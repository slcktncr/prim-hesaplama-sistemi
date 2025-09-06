const mongoose = require('mongoose');

const communicationRecordSchema = new mongoose.Schema({
  // Tarih bilgisi
  date: {
    type: Date,
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  
  // Temsilci bilgisi
  salesperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // İletişim verileri
  whatsappIncoming: {
    type: Number,
    default: 0,
    min: 0
  },
  callIncoming: {
    type: Number,
    default: 0,
    min: 0
  },
  callOutgoing: {
    type: Number,
    default: 0,
    min: 0
  },
  meetingNewCustomer: {
    type: Number,
    default: 0,
    min: 0
  },
  meetingAfterSale: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Toplam hesaplanan değerler
  totalMeetings: {
    type: Number,
    default: 0
  },
  totalCommunication: {
    type: Number,
    default: 0
  },
  
  // Veri girişi bilgileri
  isEntered: {
    type: Boolean,
    default: false
  },
  enteredAt: {
    type: Date
  },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Ceza puanı bilgisi
  penaltyApplied: {
    type: Boolean,
    default: false
  },
  penaltyDate: {
    type: Date
  },
  
  // Notlar
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Sistem bilgileri
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Toplam değerleri hesaplama middleware
communicationRecordSchema.pre('save', function(next) {
  this.totalMeetings = (this.meetingNewCustomer || 0) + (this.meetingAfterSale || 0);
  this.totalCommunication = (this.whatsappIncoming || 0) + (this.callIncoming || 0) + (this.callOutgoing || 0) + this.totalMeetings;
  this.updatedAt = Date.now();
  next();
});

// Benzersiz indeks: Bir temsilci için günde sadece bir kayıt
communicationRecordSchema.index({ salesperson: 1, date: 1 }, { unique: true });

// Yıl ve ay bazlı indeksler
communicationRecordSchema.index({ year: 1, month: 1 });
communicationRecordSchema.index({ salesperson: 1, year: 1, month: 1 });

module.exports = mongoose.model('CommunicationRecord', communicationRecordSchema);
