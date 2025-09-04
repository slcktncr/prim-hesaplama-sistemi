const mongoose = require('mongoose');
require('dotenv').config();

const SaleType = require('../models/SaleType');
const PaymentType = require('../models/PaymentType');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const seedSystemSettings = async () => {
  try {
    await connectDB();

    // Admin kullanıcısını bul
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ Admin kullanıcı bulunamadı. Önce bir admin kullanıcı oluşturun.');
      return;
    }

    console.log('🌱 Sistem ayarları seed işlemi başlatılıyor...');

    // Varsayılan satış türleri
    const defaultSaleTypes = [
      {
        name: 'Normal Satış',
        description: 'Standart satış işlemi',
        isDefault: true,
        isActive: true,
        createdBy: adminUser._id
      },
      {
        name: 'Kapora',
        description: 'Kapora ödemesi',
        isDefault: false,
        isActive: true,
        createdBy: adminUser._id
      },
      {
        name: 'Taksitli Satış',
        description: 'Taksitli ödeme planı ile satış',
        isDefault: false,
        isActive: true,
        createdBy: adminUser._id
      }
    ];

    // Varsayılan ödeme tipleri
    const defaultPaymentTypes = [
      {
        name: 'Nakit',
        description: 'Nakit ödeme',
        isDefault: true,
        isActive: true,
        createdBy: adminUser._id
      },
      {
        name: 'Kredi Kartı',
        description: 'Kredi kartı ile ödeme',
        isDefault: false,
        isActive: true,
        createdBy: adminUser._id
      },
      {
        name: 'Banka Transferi',
        description: 'Banka havalesi/EFT',
        isDefault: false,
        isActive: true,
        createdBy: adminUser._id
      },
      {
        name: 'Çek',
        description: 'Çek ile ödeme',
        isDefault: false,
        isActive: true,
        createdBy: adminUser._id
      }
    ];

    // Satış türlerini ekle
    for (const saleType of defaultSaleTypes) {
      const existing = await SaleType.findOne({ name: saleType.name });
      if (!existing) {
        await SaleType.create(saleType);
        console.log(`✅ Satış türü eklendi: ${saleType.name}`);
      } else {
        console.log(`⚠️ Satış türü zaten mevcut: ${saleType.name}`);
      }
    }

    // Ödeme tiplerini ekle
    for (const paymentType of defaultPaymentTypes) {
      const existing = await PaymentType.findOne({ name: paymentType.name });
      if (!existing) {
        await PaymentType.create(paymentType);
        console.log(`✅ Ödeme tipi eklendi: ${paymentType.name}`);
      } else {
        console.log(`⚠️ Ödeme tipi zaten mevcut: ${paymentType.name}`);
      }
    }

    console.log('🎉 Sistem ayarları seed işlemi tamamlandı!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Seed işlemi hatası:', error);
    process.exit(1);
  }
};

seedSystemSettings();
