require('dotenv').config();
const mongoose = require('mongoose');

async function checkTodayCommunication() {
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
    }).populate('salesperson', 'name email').lean();
    
    console.log(`\n📊 Bugün toplam ${todayRecords.length} kayıt bulundu\n`);
    
    if (todayRecords.length === 0) {
      console.log('⚠️ Bugün için kayıt bulunamadı!');
      await mongoose.connection.close();
      return;
    }
    
    // Her kaydı detaylı göster
    todayRecords.forEach((record, index) => {
      console.log(`\n═══════════════════════════════════════════════`);
      console.log(`Kayıt #${index + 1}`);
      console.log(`═══════════════════════════════════════════════`);
      console.log(`👤 Kullanıcı: ${record.salesperson?.name || 'Bilinmiyor'}`);
      console.log(`📅 Tarih: ${new Date(record.date).toLocaleDateString('tr-TR')}`);
      console.log(`📝 Not: ${record.notes || '-'}`);
      console.log(`\n📊 LEGACY ALANLAR (eski sistem):`);
      console.log(`   whatsappIncoming: ${record.whatsappIncoming || 0}`);
      console.log(`   callIncoming: ${record.callIncoming || 0}`);
      console.log(`   callOutgoing: ${record.callOutgoing || 0}`);
      console.log(`   meetingNewCustomer: ${record.meetingNewCustomer || 0}`);
      console.log(`   meetingAfterSale: ${record.meetingAfterSale || 0}`);
      
      console.log(`\n📊 DİNAMİK ALANLAR (yeni sistem):`);
      console.log(`   WHATSAPP_INCOMING: ${record.WHATSAPP_INCOMING || 0}`);
      console.log(`   CALL_INCOMING: ${record.CALL_INCOMING || 0}`);
      console.log(`   CALL_OUTGOING: ${record.CALL_OUTGOING || 0}`);
      console.log(`   MEETING_NEW_CUSTOMER: ${record.MEETING_NEW_CUSTOMER || 0}`);
      console.log(`   MEETING_AFTER_SALE: ${record.MEETING_AFTER_SALE || 0}`);
      
      console.log(`\n📊 TOPLAMLAR:`);
      console.log(`   totalMeetings: ${record.totalMeetings || 0}`);
      console.log(`   totalCommunication: ${record.totalCommunication || 0}`);
      
      // Tüm alanları göster
      console.log(`\n🔍 TÜM KAYIT ALANLARI:`);
      const allKeys = Object.keys(record).sort();
      allKeys.forEach(key => {
        if (!['_id', '__v', 'salesperson', 'date', 'createdAt', 'updatedAt'].includes(key)) {
          console.log(`   ${key}: ${JSON.stringify(record[key])}`);
        }
      });
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Bağlantı kapatıldı');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

checkTodayCommunication();

