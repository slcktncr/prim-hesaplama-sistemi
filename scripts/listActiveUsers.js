const mongoose = require('mongoose');
require('dotenv').config();

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

const listActiveUsers = async () => {
  try {
    console.log('📋 Aktif kullanıcılar listeleniyor...\n');
    
    const activeUsers = await User.find({ 
      role: 'salesperson', 
      isActive: true, 
      isApproved: true 
    }).select('name email firstName lastName createdAt').sort({ name: 1 });
    
    if (activeUsers.length === 0) {
      console.log('❌ Aktif kullanıcı bulunamadı.');
      return;
    }
    
    console.log(`✅ ${activeUsers.length} aktif kullanıcı bulundu:\n`);
    console.log('='.repeat(80));
    console.log('| No | Tam Adı                    | Email                          |');
    console.log('='.repeat(80));
    
    activeUsers.forEach((user, index) => {
      const name = user.name || `${user.firstName} ${user.lastName}`;
      const email = user.email;
      
      console.log(`| ${(index + 1).toString().padStart(2)} | ${name.padEnd(26)} | ${email.padEnd(30)} |`);
    });
    
    console.log('='.repeat(80));
    
    console.log('\n📝 Excel şablonunda "salesperson" sütununa yazmanız gerekenler:\n');
    
    activeUsers.forEach((user, index) => {
      const name = user.name || `${user.firstName} ${user.lastName}`;
      console.log(`   ${index + 1}. "${name}" veya "${user.email}"`);
    });
    
    console.log('\n💡 İpuçları:');
    console.log('   • Tam adı (örn: "Ahmet Yılmaz") veya email adresini kullanabilirsiniz');
    console.log('   • Büyük/küçük harf duyarlı değil');
    console.log('   • Admin satışları için "admin" yazın');
    console.log('   • Kullanıcı bulunamazsa otomatik olarak admin\'e atanır\n');
    
  } catch (error) {
    console.error('❌ Kullanıcı listesi alınırken hata:', error);
    throw error;
  }
};

// Script'i çalıştır
const runScript = async () => {
  try {
    await connectDB();
    await listActiveUsers();
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

module.exports = { listActiveUsers };
