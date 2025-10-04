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
  
  // İletişim verileri (Legacy - geriye uyumluluk için)
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
  
  // Dinamik iletişim türleri için genel alan
  // Bu alanlar CommunicationType.code değerlerine göre dinamik olarak eklenir
  // Örnek: { WHATSAPP_IN: 5, CALL_OUT: 3, MEETING_NEW: 2 }
  
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
}, {
  strict: false, // Dinamik alanları destekle
  collection: 'communicationrecords' // Collection adını belirt
});

// Toplam değerleri hesaplama middleware (Dinamik + Legacy uyumlu)
communicationRecordSchema.pre('save', async function(next) {
  try {
    // Legacy alanları hesapla
    const legacyMeetings = (this.meetingNewCustomer || 0) + (this.meetingAfterSale || 0);
    const legacyCommunication = (this.whatsappIncoming || 0) + (this.callIncoming || 0) + (this.callOutgoing || 0) + legacyMeetings;
    
    // Dinamik alanları hesapla
    let dynamicMeetings = 0;
    let dynamicCommunication = 0;
    
    // CommunicationType'ları al ve dinamik hesaplamaları yap
    const CommunicationType = require('./CommunicationType');
    const communicationTypes = await CommunicationType.find({ isActive: true });
    
    for (const type of communicationTypes) {
      const value = this[type.code] || 0;
      dynamicCommunication += value;
      
      if (type.category === 'meeting') {
        dynamicMeetings += value;
      }
    }
    
    // Toplam değerleri güncelle
    this.totalMeetings = legacyMeetings + dynamicMeetings;
    this.totalCommunication = legacyCommunication + dynamicCommunication;
    this.updatedAt = Date.now();
    
    next();
  } catch (error) {
    console.error('Communication record pre-save error:', error);
    // Hata durumunda legacy hesaplamayı kullan
    this.totalMeetings = (this.meetingNewCustomer || 0) + (this.meetingAfterSale || 0);
    this.totalCommunication = (this.whatsappIncoming || 0) + (this.callIncoming || 0) + (this.callOutgoing || 0) + this.totalMeetings;
    this.updatedAt = Date.now();
    next();
  }
});

// Benzersiz indeks: Bir temsilci için günde sadece bir kayıt
communicationRecordSchema.index({ salesperson: 1, date: 1 }, { unique: true });

// Yıl ve ay bazlı indeksler
communicationRecordSchema.index({ year: 1, month: 1 });
communicationRecordSchema.index({ salesperson: 1, year: 1, month: 1 });

module.exports = mongoose.model('CommunicationRecord', communicationRecordSchema);
