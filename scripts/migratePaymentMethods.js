const mongoose = require('mongoose');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');

// MongoDB bağlantısı
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Varsayılan ödeme yöntemlerini ekle
const migratePaymentMethods = async () => {
  try {
    console.log('🔄 Ödeme yöntemleri migration başlatılıyor...');
    
    // Mevcut ödeme yöntemlerini kontrol et
    const existingMethods = await PaymentMethod.find({});
    if (existingMethods.length > 0) {
      console.log(`✅ ${existingMethods.length} ödeme yöntemi zaten mevcut. Migration atlanıyor.`);
      return;
    }

    // Sistem kullanıcısı bul (admin)
    const systemUser = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
    if (!systemUser) {
      console.error('❌ Admin kullanıcı bulunamadı. Önce admin kullanıcı oluşturun.');
      return;
    }

    console.log(`👤 Sistem kullanıcısı: ${systemUser.name} (${systemUser.email})`);

    // Varsayılan ödeme yöntemleri
    const defaultPaymentMethods = [
      {
        name: 'Nakit',
        description: 'Nakit ödeme',
        isDefault: true,
        sortOrder: 1,
        createdBy: systemUser._id
      },
      {
        name: 'Kredi',
        description: 'Kredi kartı ile ödeme',
        isDefault: false,
        sortOrder: 2,
        createdBy: systemUser._id
      },
      {
        name: 'Taksit',
        description: 'Taksitli ödeme',
        isDefault: false,
        sortOrder: 3,
        createdBy: systemUser._id
      },
      {
        name: 'Diğer',
        description: 'Diğer ödeme yöntemleri',
        isDefault: false,
        sortOrder: 4,
        createdBy: systemUser._id
      }
    ];

    // Ödeme yöntemlerini ekle
    for (const methodData of defaultPaymentMethods) {
      const method = new PaymentMethod(methodData);
      await method.save();
      console.log(`✅ Ödeme yöntemi eklendi: ${methodData.name}`);
    }

    console.log(`🎉 ${defaultPaymentMethods.length} ödeme yöntemi başarıyla eklendi!`);
    
  } catch (error) {
    console.error('❌ Migration hatası:', error);
    throw error;
  }
};

// Script'i çalıştır
const runMigration = async () => {
  try {
    await connectDB();
    await migratePaymentMethods();
    console.log('✅ Migration tamamlandı!');
  } catch (error) {
    console.error('❌ Migration başarısız:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Veritabanı bağlantısı kapatıldı');
    process.exit(0);
  }
};

// Eğer bu dosya direkt çalıştırılıyorsa migration'ı başlat
if (require.main === module) {
  runMigration();
}

module.exports = { migratePaymentMethods };
