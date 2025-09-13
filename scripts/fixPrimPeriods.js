const mongoose = require('mongoose');
require('../config/db')();

const Sale = require('../models/Sale');
const PrimPeriod = require('../models/PrimPeriod');
const PrimTransaction = require('../models/PrimTransaction');

// getOrCreatePrimPeriod fonksiyonunu doğrudan kopyala
const getOrCreatePrimPeriod = async (saleDate, createdBy) => {
  const date = new Date(saleDate);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  
  const periodName = `${monthNames[month - 1]} ${year}`;
  
  let period = await PrimPeriod.findOne({ name: periodName });
  
  if (!period) {
    // createdBy ID'sini düzelt (23 karakter ise başına 0 ekle)
    let createdById = createdBy;
    if (typeof createdBy === 'string' && createdBy.length === 23 && /^[0-9a-fA-F]{23}$/.test(createdBy)) {
      createdById = '0' + createdBy;
    }
    
    period = new PrimPeriod({
      name: periodName,
      month,
      year,
      createdBy: new mongoose.Types.ObjectId(createdById)
    });
    await period.save();
    console.log(`📅 Yeni dönem oluşturuldu: ${periodName}`);
  }
  
  return period._id;
};

async function fixPrimPeriods() {
  try {
    console.log('🔄 Prim dönemlerini saleDate\'e göre düzeltme başlıyor...');
    
    // Tüm aktif satışları al
    const sales = await Sale.find({ 
      status: 'aktif',
      saleDate: { $exists: true, $ne: null }
    }).populate('primPeriod', 'name month year');
    
    console.log(`📊 ${sales.length} aktif satış bulundu`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const sale of sales) {
      try {
        // Salesperson ID'sini düzelt (23 karakter ise başına 0 ekle)
        let salespersonId = sale.salesperson.toString();
        if (salespersonId.length === 23 && /^[0-9a-fA-F]{23}$/.test(salespersonId)) {
          salespersonId = '0' + salespersonId;
          console.log(`🔧 Salesperson ID düzeltildi: ${sale.salesperson} → ${salespersonId}`);
        }
        
        // saleDate'e göre doğru prim dönemini bul/oluştur
        const correctPrimPeriodId = await getOrCreatePrimPeriod(sale.saleDate, salespersonId);
        
        // Mevcut prim dönemi ile karşılaştır
        if (sale.primPeriod._id.toString() !== correctPrimPeriodId.toString()) {
          const oldPeriod = sale.primPeriod;
          
          // Sale'in prim dönemini güncelle
          await Sale.findByIdAndUpdate(sale._id, {
            primPeriod: correctPrimPeriodId
          });
          
          // İlgili PrimTransaction'ları da güncelle
          await PrimTransaction.updateMany(
            { sale: sale._id },
            { primPeriod: correctPrimPeriodId }
          );
          
          // Yeni dönem bilgisini al
          const newPeriod = await PrimPeriod.findById(correctPrimPeriodId);
          
          console.log(`✅ ${sale.contractNo}: ${oldPeriod.name} → ${newPeriod.name} (${sale.saleDate.toISOString().split('T')[0]})`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ ${sale.contractNo} hatası:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Özet:');
    console.log(`✅ Güncellenen satış: ${updatedCount}`);
    console.log(`❌ Hata alan satış: ${errorCount}`);
    console.log(`➡️ Değişmeyen satış: ${sales.length - updatedCount - errorCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration hatası:', error);
    process.exit(1);
  }
}

// Script'i çalıştır
setTimeout(fixPrimPeriods, 2000);
