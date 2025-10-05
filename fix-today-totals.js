require('dotenv').config();
const mongoose = require('mongoose');

async function fixTodayTotals() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB bağlantısı başarılı');

    const CommunicationRecord = require('./models/CommunicationRecord');
    
    // Bugünün tarihini al
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    console.log(`\n📅 Bugünün tarihi: ${todayStr}`);
    
    // Bugünün kayıtlarını bul
    const todayRecords = await CommunicationRecord.find({
      date: { 
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    }).populate('salesperson', 'name email');
    
    console.log(`\n📊 Bugün toplam ${todayRecords.length} kayıt bulundu\n`);
    
    if (todayRecords.length === 0) {
      console.log('⚠️ Bugün için kayıt bulunamadı!');
      await mongoose.connection.close();
      return;
    }
    
    // Her kaydı tekrar kaydet ki pre('save') middleware'i çalışsın
    let updatedCount = 0;
    for (const record of todayRecords) {
      console.log(`\n🔄 ${record.salesperson.name} için kayıt güncelleniyor...`);
      console.log(`   Önceki totalCommunication: ${record.totalCommunication}`);
      
      // Sadece save() çağırıyoruz, pre('save') middleware toplamları yeniden hesaplayacak
      await record.save();
      
      // Güncellenmiş kaydı tekrar al
      const updatedRecord = await CommunicationRecord.findById(record._id);
      console.log(`   Yeni totalCommunication: ${updatedRecord.totalCommunication}`);
      console.log(`   ✅ Güncellendi`);
      
      updatedCount++;
    }
    
    console.log(`\n✅ Toplam ${updatedCount} kayıt güncellendi`);
    
    await mongoose.connection.close();
    console.log('✅ Bağlantı kapatıldı');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

fixTodayTotals();

