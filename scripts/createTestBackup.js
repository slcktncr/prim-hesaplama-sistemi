const fs = require('fs');
const path = require('path');

const createTestBackup = () => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    // Backup klasörü yoksa oluştur
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('📁 Backup klasörü oluşturuldu:', backupDir);
    }
    
    // Test yedek dosyası oluştur
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    
    const testBackupData = {
      timestamp: new Date().toISOString(),
      type: 'test',
      count: 3,
      data: [
        {
          customerName: 'Test Müşteri 1',
          contractNo: 'TEST-001',
          blockNo: 'A',
          apartmentNo: '1',
          saleType: 'satis',
          saleDate: new Date('2023-01-01'),
          entryDate: new Date('2023-06-01'),
          salesperson: 'admin'
        },
        {
          customerName: 'Test Müşteri 2',
          contractNo: 'TEST-002',
          blockNo: 'B',
          apartmentNo: '2',
          saleType: 'kapora',
          saleDate: new Date('2023-01-02'),
          entryDate: new Date('2023-06-02'),
          salesperson: 'admin'
        },
        {
          customerName: 'Test Müşteri 3',
          contractNo: 'TEST-003',
          blockNo: 'C',
          apartmentNo: '3',
          saleType: 'satis',
          saleDate: new Date('2023-01-03'),
          entryDate: new Date('2023-06-03'),
          salesperson: 'admin'
        }
      ]
    };
    
    fs.writeFileSync(filepath, JSON.stringify(testBackupData, null, 2));
    console.log('✅ Test yedek dosyası oluşturuldu:', filename);
    console.log('📍 Dosya yolu:', filepath);
    console.log('📊 Kayıt sayısı:', testBackupData.count);
    
    return filename;
    
  } catch (error) {
    console.error('❌ Test yedek oluşturma hatası:', error);
    throw error;
  }
};

// Eğer bu dosya direkt çalıştırılıyorsa
if (require.main === module) {
  try {
    const filename = createTestBackup();
    console.log('\n🎉 Test yedek dosyası başarıyla oluşturuldu!');
    console.log('Şimdi web arayüzünden test edebilirsiniz.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script başarısız:', error);
    process.exit(1);
  }
}

module.exports = { createTestBackup };
