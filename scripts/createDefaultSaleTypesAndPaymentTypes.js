const mongoose = require('mongoose');
const SaleType = require('../models/SaleType');
const PaymentType = require('../models/PaymentType');
const User = require('../models/User');

// MongoDB bağlantısı
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stwork');
    console.log('✅ MongoDB bağlantısı başarılı');
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error);
    process.exit(1);
  }
};

const createDefaultSaleTypes = async (adminUser) => {
  try {
    console.log('🔍 Varsayılan satış türleri kontrol ediliyor...');
    
    const existingSaleTypes = await SaleType.find();
    if (existingSaleTypes.length > 0) {
      console.log('✅ Satış türleri zaten mevcut');
      return;
    }

    const defaultSaleTypes = [
      {
        name: 'Normal Satış',
        description: 'Standart satış işlemi',
        isActive: true,
        isDefault: true,
        color: 'success',
        sortOrder: 1,
        requiredFields: {
          contractNo: true,
          listPrice: true,
          activitySalePrice: true,
          paymentType: true,
          saleDate: true,
          kaporaDate: false
        },
        createdBy: adminUser._id
      },
      {
        name: 'Kapora',
        description: 'Kapora işlemi',
        isActive: true,
        isDefault: false,
        color: 'warning',
        sortOrder: 2,
        requiredFields: {
          contractNo: false,
          listPrice: false,
          activitySalePrice: false,
          paymentType: false,
          saleDate: false,
          kaporaDate: true
        },
        createdBy: adminUser._id
      }
    ];

    for (const saleTypeData of defaultSaleTypes) {
      const saleType = new SaleType(saleTypeData);
      await saleType.save();
      console.log(`✅ Satış türü oluşturuldu: ${saleType.name}`);
    }

    console.log('✅ Tüm varsayılan satış türleri oluşturuldu');
  } catch (error) {
    console.error('❌ Satış türleri oluşturma hatası:', error);
  }
};

const createDefaultPaymentTypes = async (adminUser) => {
  try {
    console.log('🔍 Varsayılan ödeme türleri kontrol ediliyor...');
    
    const existingPaymentTypes = await PaymentType.find();
    if (existingPaymentTypes.length > 0) {
      console.log('✅ Ödeme türleri zaten mevcut');
      return;
    }

    const defaultPaymentTypes = [
      {
        name: 'Nakit',
        description: 'Nakit ödeme',
        isActive: true,
        isDefault: true,
        createdBy: adminUser._id
      },
      {
        name: 'Kredi Kartı',
        description: 'Kredi kartı ile ödeme',
        isActive: true,
        isDefault: false,
        createdBy: adminUser._id
      },
      {
        name: 'Banka Transferi',
        description: 'Banka transferi ile ödeme',
        isActive: true,
        isDefault: false,
        createdBy: adminUser._id
      },
      {
        name: 'Çek',
        description: 'Çek ile ödeme',
        isActive: true,
        isDefault: false,
        createdBy: adminUser._id
      }
    ];

    for (const paymentTypeData of defaultPaymentTypes) {
      const paymentType = new PaymentType(paymentTypeData);
      await paymentType.save();
      console.log(`✅ Ödeme türü oluşturuldu: ${paymentType.name}`);
    }

    console.log('✅ Tüm varsayılan ödeme türleri oluşturuldu');
  } catch (error) {
    console.error('❌ Ödeme türleri oluşturma hatası:', error);
  }
};

const main = async () => {
  try {
    await connectDB();

    // Admin kullanıcıyı bul
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ Admin kullanıcı bulunamadı. Önce admin kullanıcı oluşturun.');
      process.exit(1);
    }

    console.log(`👤 Admin kullanıcı bulundu: ${adminUser.email}`);

    await createDefaultSaleTypes(adminUser);
    await createDefaultPaymentTypes(adminUser);

    console.log('🎉 Varsayılan veriler başarıyla oluşturuldu!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script hatası:', error);
    process.exit(1);
  }
};

// Script çalıştırılırsa
if (require.main === module) {
  main();
}

module.exports = { createDefaultSaleTypes, createDefaultPaymentTypes };
