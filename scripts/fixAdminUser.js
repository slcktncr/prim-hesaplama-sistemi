const mongoose = require('mongoose');
require('../config/db')();

const User = require('../models/User');

const fixAdminUser = async () => {
  try {
    console.log('🔧 Admin kullanıcısı düzeltiliyor...');

    // Selçuk TUNÇER'i bul
    const user = await User.findOne({ 
      email: 'selcuktuncer@gmail.com' 
    });

    if (!user) {
      console.error('❌ Kullanıcı bulunamadı: selcuktuncer@gmail.com');
      process.exit(1);
    }

    console.log('📋 Mevcut kullanıcı durumu:');
    console.log('- Ad:', user.name);
    console.log('- Email:', user.email);
    console.log('- SystemRole:', user.systemRole);
    console.log('- Role:', user.role);
    console.log('- isActive:', user.isActive);
    console.log('- isApproved:', user.isApproved);

    // Admin yetkilerini düzelt
    user.systemRole = 'admin';
    user.role = null; // Sistem admin'i için role null olmalı
    user.isActive = true;
    user.isApproved = true;
    user.approvedAt = new Date();

    // firstName/lastName eksikse düzelt
    if (!user.firstName || !user.lastName) {
      const nameParts = user.name ? user.name.split(' ') : ['Selçuk', 'TUNÇER'];
      user.firstName = nameParts[0] || 'Selçuk';
      user.lastName = nameParts.slice(1).join(' ') || 'TUNÇER';
    }

    await user.save();

    console.log('✅ Admin kullanıcısı başarıyla düzeltildi:');
    console.log('- SystemRole:', user.systemRole);
    console.log('- Role:', user.role);
    console.log('- isActive:', user.isActive);
    console.log('- isApproved:', user.isApproved);
    console.log('- firstName:', user.firstName);
    console.log('- lastName:', user.lastName);

    console.log('🎉 İşlem tamamlandı! Artık admin paneline erişebilirsiniz.');
    
  } catch (error) {
    console.error('❌ Admin düzeltme hatası:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Script çalıştırıldığında
if (require.main === module) {
  fixAdminUser();
}

module.exports = fixAdminUser;
