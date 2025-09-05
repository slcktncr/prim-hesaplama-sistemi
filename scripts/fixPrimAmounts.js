const mongoose = require('mongoose');
require('dotenv').config();

const Sale = require('../models/Sale');

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

const fixPrimAmounts = async () => {
  try {
    console.log('🔄 Prim tutarları düzeltme scripti başlatılıyor...');
    
    // Tüm aktif satışları getir
    const sales = await Sale.find({ 
      status: 'aktif',
      saleType: { $ne: 'kapora' } // Kapora hariç
    }).populate('primPeriod', 'name');
    
    console.log(`📊 Toplam ${sales.length} satış bulundu`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const sale of sales) {
      try {
        console.log(`\n🔍 Satış kontrol ediliyor: ${sale.contractNo}`);
        console.log(`Mevcut primAmount: ${sale.primAmount}`);
        console.log(`basePrimPrice: ${sale.basePrimPrice}`);
        console.log(`primRate: ${sale.primRate}`);
        
        // Doğru prim tutarını hesapla
        const correctPrimAmount = sale.basePrimPrice * (sale.primRate / 100);
        
        console.log(`Hesaplanan doğru prim: ${correctPrimAmount}`);
        
        // Eğer farklıysa güncelle
        if (Math.abs(sale.primAmount - correctPrimAmount) > 0.01) {
          const oldAmount = sale.primAmount;
          sale.primAmount = correctPrimAmount;
          
          // save() middleware'ini bypass et, direkt update yap
          await Sale.updateOne(
            { _id: sale._id },
            { 
              $set: { 
                primAmount: correctPrimAmount,
                updatedAt: new Date()
              }
            }
          );
          
          console.log(`✅ Güncellendi: ${oldAmount} → ${correctPrimAmount}`);
          updatedCount++;
        } else {
          console.log(`✓ Zaten doğru`);
        }
        
      } catch (error) {
        console.error(`❌ Satış ${sale.contractNo} güncellenirken hata:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📈 Özet:`);
    console.log(`✅ Güncellenen satış sayısı: ${updatedCount}`);
    console.log(`❌ Hata sayısı: ${errorCount}`);
    console.log(`📊 Toplam kontrol edilen: ${sales.length}`);
    
  } catch (error) {
    console.error('❌ Script hatası:', error);
    throw error;
  }
};

// Script'i çalıştır
const runScript = async () => {
  try {
    await connectDB();
    await fixPrimAmounts();
    console.log('✅ Script tamamlandı!');
  } catch (error) {
    console.error('❌ Script başarısız:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Veritabanı bağlantısı kapatıldı');
    process.exit(0);
  }
};

// Eğer bu dosya direkt çalıştırılıyorsa script'i başlat
if (require.main === module) {
  runScript();
}

module.exports = { fixPrimAmounts };
