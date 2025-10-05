const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stwork', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function debugYearlyData() {
  try {
    console.log('🔍 CommunicationYear collection verilerini RAW olarak kontrol ediyorum...\n');
    
    // Direkt MongoDB collection'dan oku
    const db = mongoose.connection.db;
    const collection = db.collection('communicationyears');
    
    // 2025 yılını bul
    const year2025 = await collection.findOne({ year: 2025 });
    
    if (year2025) {
      console.log('📅 2025 Yılı RAW Verileri:');
      console.log('   - Tüm alanlar:', Object.keys(year2025));
      
      // monthlyData'yı incele
      if (year2025.monthlyData) {
        console.log('\n   📅 monthlyData:');
        console.log('   - Type:', typeof year2025.monthlyData);
        console.log('   - Constructor:', year2025.monthlyData.constructor.name);
        console.log('   - Keys:', Object.keys(year2025.monthlyData));
        
        // Her ayı incele
        Object.keys(year2025.monthlyData).forEach(month => {
          const monthData = year2025.monthlyData[month];
          console.log(`\n   📅 Ay ${month}:`);
          console.log('     - Type:', typeof monthData);
          console.log('     - Constructor:', monthData ? monthData.constructor.name : 'null');
          
          if (monthData && typeof monthData === 'object') {
            const userIds = Object.keys(monthData);
            console.log('     - Kullanıcı sayısı:', userIds.length);
            console.log('     - İlk 3 kullanıcı ID:', userIds.slice(0, 3));
            
            // İlk kullanıcının verisini göster
            if (userIds.length > 0) {
              const firstUserId = userIds[0];
              const userData = monthData[firstUserId];
              console.log(`     - ${firstUserId} verisi:`, JSON.stringify(userData, null, 2));
            }
          }
        });
      }
      
      // yearlyCommunicationData'yı incele
      if (year2025.yearlyCommunicationData) {
        console.log('\n   📊 yearlyCommunicationData:');
        console.log('   - Type:', typeof year2025.yearlyCommunicationData);
        console.log('   - Constructor:', year2025.yearlyCommunicationData.constructor.name);
        console.log('   - Keys:', Object.keys(year2025.yearlyCommunicationData));
        
        const userIds = Object.keys(year2025.yearlyCommunicationData);
        if (userIds.length > 0) {
          const firstUserId = userIds[0];
          const userData = year2025.yearlyCommunicationData[firstUserId];
          console.log(`   - ${firstUserId} verisi:`, JSON.stringify(userData, null, 2));
        }
      }
      
    } else {
      console.log('❌ 2025 yılı bulunamadı');
    }
    
  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugYearlyData();
