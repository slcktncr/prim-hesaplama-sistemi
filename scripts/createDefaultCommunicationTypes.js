const mongoose = require('mongoose');
require('dotenv').config();

// Database bağlantısı
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/primhesaplama', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB bağlantısı başarılı');
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error);
    process.exit(1);
  }
};

// CommunicationType model'ini import et
const CommunicationType = require('../models/CommunicationType');
const User = require('../models/User');

// Varsayılan iletişim türleri
const defaultTypes = [
  {
    name: 'WhatsApp Gelen Mesaj',
    code: 'WHATSAPP_INCOMING',
    description: 'WhatsApp üzerinden gelen mesajlar',
    category: 'incoming',
    color: '#25D366',
    icon: 'FiMessageCircle',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 1
  },
  {
    name: 'Telefon Gelen Arama',
    code: 'CALL_INCOMING',
    description: 'Telefon üzerinden gelen aramalar',
    category: 'incoming',
    color: '#28a745',
    icon: 'FiPhone',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 2
  },
  {
    name: 'Telefon Giden Arama',
    code: 'CALL_OUTGOING',
    description: 'Telefon üzerinden yapılan aramalar',
    category: 'outgoing',
    color: '#007bff',
    icon: 'FiPhone',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 3
  },
  {
    name: 'Yeni Müşteri Toplantısı',
    code: 'MEETING_NEW_CUSTOMER',
    description: 'Yeni müşterilerle yapılan toplantılar',
    category: 'meeting',
    color: '#ffc107',
    icon: 'FiUsers',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 4
  },
  {
    name: 'Satış Sonrası Toplantı',
    code: 'MEETING_AFTER_SALE',
    description: 'Satış sonrası müşteri takip toplantıları',
    category: 'meeting',
    color: '#fd7e14',
    icon: 'FiUserCheck',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 5
  },
  {
    name: 'E-posta Gelen',
    code: 'EMAIL_INCOMING',
    description: 'E-posta üzerinden gelen mesajlar',
    category: 'incoming',
    color: '#6c757d',
    icon: 'FiMail',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 6
  },
  {
    name: 'E-posta Giden',
    code: 'EMAIL_OUTGOING',
    description: 'E-posta üzerinden gönderilen mesajlar',
    category: 'outgoing',
    color: '#17a2b8',
    icon: 'FiMail',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 7
  },
  {
    name: 'Video Konferans',
    code: 'VIDEO_CALL',
    description: 'Video konferans toplantıları',
    category: 'meeting',
    color: '#e83e8c',
    icon: 'FiVideo',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 8
  },
  {
    name: 'Saha Ziyareti',
    code: 'FIELD_VISIT',
    description: 'Müşteri ziyaretleri ve saha çalışmaları',
    category: 'meeting',
    color: '#20c997',
    icon: 'FiMapPin',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 9
  },
  {
    name: 'Sosyal Medya Mesajı',
    code: 'SOCIAL_MEDIA',
    description: 'Sosyal medya platformlarından gelen mesajlar',
    category: 'incoming',
    color: '#6f42c1',
    icon: 'FiMessageCircle',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 10
  }
];

// Ana fonksiyon
const createDefaultTypes = async () => {
  try {
    console.log('🚀 Varsayılan iletişim türleri oluşturuluyor...');
    
    // Admin kullanıcısını bul
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ Admin kullanıcı bulunamadı');
      return;
    }
    
    console.log(`👤 Admin kullanıcı bulundu: ${adminUser.name}`);
    
    // Mevcut türleri kontrol et
    const existingTypes = await CommunicationType.find({});
    console.log(`📊 Mevcut iletişim türü sayısı: ${existingTypes.length}`);
    
    if (existingTypes.length > 0) {
      console.log('⚠️  Zaten iletişim türleri mevcut. Mevcut türler:');
      existingTypes.forEach(type => {
        console.log(`   - ${type.name} (${type.code})`);
      });
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('Mevcut türleri silip yenilerini oluşturmak istiyor musunuz? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ İşlem iptal edildi');
        return;
      }
      
      // Mevcut türleri sil
      await CommunicationType.deleteMany({});
      console.log('🗑️  Mevcut türler silindi');
    }
    
    // Yeni türleri oluştur
    const createdTypes = [];
    for (const typeData of defaultTypes) {
      const newType = new CommunicationType({
        ...typeData,
        createdBy: adminUser._id
      });
      
      await newType.save();
      createdTypes.push(newType);
      console.log(`✅ ${newType.name} oluşturuldu`);
    }
    
    console.log(`\n🎉 ${createdTypes.length} iletişim türü başarıyla oluşturuldu!`);
    console.log('\n📋 Oluşturulan türler:');
    createdTypes.forEach((type, index) => {
      console.log(`   ${index + 1}. ${type.name} (${type.code}) - ${type.category}`);
    });
    
  } catch (error) {
    console.error('❌ Hata oluştu:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Veritabanı bağlantısı kapatıldı');
  }
};

// Script'i çalıştır
if (require.main === module) {
  connectDB().then(() => {
    createDefaultTypes();
  });
}

module.exports = createDefaultTypes;
