const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Sale = require('../models/Sale');
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

const listBackups = async () => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    if (!fs.existsSync(backupDir)) {
      console.log('📁 Backup klasörü bulunamadı:', backupDir);
      return;
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        
        try {
          const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          return {
            filename: file,
            size: (stats.size / 1024).toFixed(2) + ' KB',
            created: stats.ctime.toLocaleString('tr-TR'),
            type: content.type || 'unknown',
            count: content.count || 0,
            timestamp: content.timestamp ? new Date(content.timestamp).toLocaleString('tr-TR') : 'Bilinmiyor'
          };
        } catch (error) {
          return {
            filename: file,
            size: (stats.size / 1024).toFixed(2) + ' KB',
            created: stats.ctime.toLocaleString('tr-TR'),
            type: 'BOZUK',
            count: 0,
            timestamp: 'Okunamadı',
            error: error.message
          };
        }
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    if (files.length === 0) {
      console.log('📂 Yedek dosyası bulunamadı.');
      return;
    }
    
    console.log(`\n📋 ${files.length} adet yedek dosyası bulundu:\n`);
    console.log('='.repeat(120));
    console.log('| No | Dosya Adı                           | Tür        | Kayıt | Boyut    | Oluşturma Tarihi      |');
    console.log('='.repeat(120));
    
    files.forEach((file, index) => {
      const no = (index + 1).toString().padStart(2);
      const filename = file.filename.padEnd(35);
      const type = file.type.padEnd(10);
      const count = file.count.toString().padStart(5);
      const size = file.size.padStart(8);
      const created = file.created.padEnd(21);
      
      console.log(`| ${no} | ${filename} | ${type} | ${count} | ${size} | ${created} |`);
      
      if (file.error) {
        console.log(`     HATA: ${file.error}`);
      }
    });
    
    console.log('='.repeat(120));
    console.log(`\n📍 Yedek klasörü: ${backupDir}\n`);
    
    return files;
    
  } catch (error) {
    console.error('❌ Yedek dosyaları listelenirken hata:', error);
    throw error;
  }
};

const showBackupDetails = async (filename) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    const filepath = path.join(backupDir, filename);
    
    if (!fs.existsSync(filepath)) {
      console.log(`❌ Yedek dosyası bulunamadı: ${filename}`);
      return;
    }
    
    const backupData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const stats = fs.statSync(filepath);
    
    console.log(`\n📄 Yedek Dosyası Detayları: ${filename}\n`);
    console.log('='.repeat(60));
    console.log(`Dosya Adı        : ${filename}`);
    console.log(`Yedek Türü       : ${backupData.type || 'Bilinmiyor'}`);
    console.log(`Kayıt Sayısı     : ${backupData.count || 0}`);
    console.log(`Dosya Boyutu     : ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`Oluşturma Tarihi : ${backupData.timestamp ? new Date(backupData.timestamp).toLocaleString('tr-TR') : 'Bilinmiyor'}`);
    console.log(`Dosya Tarihi     : ${stats.ctime.toLocaleString('tr-TR')}`);
    console.log('='.repeat(60));
    
    if (backupData.data && backupData.data.length > 0) {
      console.log('\n📊 İlk 5 Kayıt Örneği:');
      backupData.data.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.customerName || 'Bilinmeyen'} - ${record.contractNo || 'Sözleşme Yok'}`);
      });
      
      if (backupData.data.length > 5) {
        console.log(`... ve ${backupData.data.length - 5} kayıt daha`);
      }
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Yedek dosyası detayları alınırken hata:', error);
    throw error;
  }
};

const cleanOldBackups = async (daysOld = 30) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    if (!fs.existsSync(backupDir)) {
      console.log('📁 Backup klasörü bulunamadı.');
      return;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          filepath: filepath,
          created: stats.ctime
        };
      })
      .filter(file => file.created < cutoffDate);
    
    if (files.length === 0) {
      console.log(`📅 ${daysOld} günden eski yedek dosyası bulunamadı.`);
      return;
    }
    
    console.log(`🗑️ ${daysOld} günden eski ${files.length} adet yedek dosyası siliniyor...\n`);
    
    let deletedCount = 0;
    for (const file of files) {
      try {
        fs.unlinkSync(file.filepath);
        console.log(`✅ Silindi: ${file.filename}`);
        deletedCount++;
      } catch (error) {
        console.log(`❌ Silinemedi: ${file.filename} - ${error.message}`);
      }
    }
    
    console.log(`\n🎯 ${deletedCount} adet eski yedek dosyası başarıyla silindi.`);
    
  } catch (error) {
    console.error('❌ Eski yedek dosyaları silinirken hata:', error);
    throw error;
  }
};

// Script parametrelerini işle
const runScript = async () => {
  try {
    await connectDB();
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'list':
        await listBackups();
        break;
        
      case 'details':
        const filename = args[1];
        if (!filename) {
          console.log('❌ Dosya adı belirtilmedi. Kullanım: npm run backup:manager details <filename>');
          process.exit(1);
        }
        await showBackupDetails(filename);
        break;
        
      case 'clean':
        const days = parseInt(args[1]) || 30;
        await cleanOldBackups(days);
        break;
        
      default:
        console.log('📋 Yedek Dosyası Yöneticisi\n');
        console.log('Kullanım:');
        console.log('  npm run backup:manager list                    - Yedek dosyalarını listele');
        console.log('  npm run backup:manager details <filename>      - Yedek dosyası detaylarını göster');
        console.log('  npm run backup:manager clean [days]            - Eski yedek dosyalarını sil (varsayılan: 30 gün)');
        console.log('\nÖrnekler:');
        console.log('  npm run backup:manager list');
        console.log('  npm run backup:manager details rollback_2023-12-01T10-30-00-000Z.json');
        console.log('  npm run backup:manager clean 7');
    }
    
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

module.exports = { listBackups, showBackupDetails, cleanOldBackups };
