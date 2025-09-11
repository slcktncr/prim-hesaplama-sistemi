const mongoose = require('mongoose');
require('dotenv').config();

const Sale = require('../models/Sale');
const PrimPeriod = require('../models/PrimPeriod');
const PrimTransaction = require('../models/PrimTransaction');

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Satış dönemini otomatik belirle (sales.js'den kopyalanan fonksiyon)
const getOrCreatePrimPeriod = async (saleDate, createdBy) => {
  const date = new Date(saleDate);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  
  const periodName = `${monthNames[month - 1]} ${year}`;
  
  let period = await PrimPeriod.findOne({ name: periodName });
  
  if (!period) {
    period = new PrimPeriod({
      name: periodName,
      month,
      year,
      createdBy
    });
    await period.save();
    console.log(`✅ Yeni dönem oluşturuldu: ${periodName}`);
  }
  
  return period._id;
};

const fixPrimPeriods = async () => {
  try {
    console.log('🔍 Satış tarihine göre prim dönemlerini kontrol ediliyor...\n');
    
    // Tüm aktif satışları getir
    const sales = await Sale.find({ status: 'aktif' })
      .populate('primPeriod', 'name month year')
      .populate('salesperson', 'name')
      .sort({ saleDate: 1 });
    
    console.log(`📊 Toplam ${sales.length} aktif satış bulundu\n`);
    
    let fixedCount = 0;
    let correctCount = 0;
    let errorCount = 0;
    
    for (const sale of sales) {
      try {
        // Satış tarihine göre doğru dönem ID'sini hesapla
        const correctPeriodId = await getOrCreatePrimPeriod(sale.saleDate, sale.salesperson?._id);
        
        // Mevcut dönem bilgisi
        const currentPeriod = sale.primPeriod;
        const saleDate = new Date(sale.saleDate);
        const saleDateStr = `${saleDate.getDate().toString().padStart(2, '0')}/${(saleDate.getMonth() + 1).toString().padStart(2, '0')}/${saleDate.getFullYear()}`;
        
        if (!currentPeriod || currentPeriod._id.toString() !== correctPeriodId.toString()) {
          // Yanlış dönem - düzelt
          const correctPeriod = await PrimPeriod.findById(correctPeriodId);
          
          console.log(`🔧 Düzeltiliyor: ${sale.contractNo || 'Sözleşme yok'}`);
          console.log(`   👤 Temsilci: ${sale.salesperson?.name || 'Bilinmeyen'}`);
          console.log(`   📅 Satış tarihi: ${saleDateStr}`);
          console.log(`   ❌ Mevcut dönem: ${currentPeriod?.name || 'YOK'}`);
          console.log(`   ✅ Doğru dönem: ${correctPeriod.name}`);
          
          // Sale'i güncelle
          await Sale.findByIdAndUpdate(sale._id, { 
            primPeriod: correctPeriodId 
          });
          
          // İlgili PrimTransaction'ları da güncelle
          const updatedTransactions = await PrimTransaction.updateMany(
            { sale: sale._id },
            { primPeriod: correctPeriodId }
          );
          
          if (updatedTransactions.modifiedCount > 0) {
            console.log(`   🔄 ${updatedTransactions.modifiedCount} prim transaction güncellendi`);
          }
          
          console.log('   ✅ Düzeltildi\n');
          fixedCount++;
        } else {
          // Doğru dönem
          console.log(`✅ Doğru: ${sale.contractNo || 'Sözleşme yok'} - ${saleDateStr} → ${currentPeriod.name}`);
          correctCount++;
        }
      } catch (error) {
        console.error(`❌ Hata (${sale.contractNo}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 ÖZET:');
    console.log(`✅ Zaten doğru: ${correctCount}`);
    console.log(`🔧 Düzeltilen: ${fixedCount}`);
    console.log(`❌ Hatalı: ${errorCount}`);
    console.log(`📈 Toplam: ${sales.length}`);
    
    if (fixedCount > 0) {
      console.log('\n🎉 Prim dönemleri başarıyla düzeltildi!');
      console.log('💡 Değişiklikler hakediş hesaplamalarına yansıyacaktır.');
    } else {
      console.log('\n✨ Tüm prim dönemleri zaten doğru!');
    }
    
  } catch (error) {
    console.error('❌ Script hatası:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Script'i çalıştır
fixPrimPeriods();
