const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

const fixContractNoIndex = async () => {
  try {
    console.log('🔧 ContractNo index düzeltme işlemi başlatılıyor...');
    
    const db = mongoose.connection.db;
    const salesCollection = db.collection('sales');
    
    // Mevcut indexleri listele
    console.log('📋 Mevcut indexler:');
    const indexes = await salesCollection.indexes();
    console.log(indexes.map(idx => ({ name: idx.name, key: idx.key, sparse: idx.sparse, unique: idx.unique })));
    
    // Yeni index zaten varsa çık
    const existingSparseIndex = indexes.find(idx => 
      idx.key.contractNo === 1 && idx.sparse === true && idx.unique === true
    );
    
    if (existingSparseIndex) {
      console.log('✅ Sparse unique index zaten mevcut, işlem gerekmiyor');
      return;
    }
    
    // Mevcut contractNo index'ini sil
    try {
      console.log('🗑️ Eski contractNo_1 index\'i siliniyor...');
      await salesCollection.dropIndex('contractNo_1');
      console.log('✅ Eski index silindi');
    } catch (error) {
      console.log('⚠️ Eski index silinemedi (muhtemelen zaten yok):', error.message);
    }
    
    // Mevcut null contractNo kayıtlarını temizle
    console.log('🧹 Null contractNo kayıtları temizleniyor...');
    const nullContractResult = await salesCollection.updateMany(
      { contractNo: null },
      { $unset: { contractNo: "" } }
    );
    console.log(`✅ ${nullContractResult.modifiedCount} adet null contractNo kaydı temizlendi`);
    
    // Boş string contractNo kayıtlarını temizle
    console.log('🧹 Boş string contractNo kayıtları temizleniyor...');
    const emptyContractResult = await salesCollection.updateMany(
      { contractNo: "" },
      { $unset: { contractNo: "" } }
    );
    console.log(`✅ ${emptyContractResult.modifiedCount} adet boş string contractNo kaydı temizlendi`);
    
    // Yeni sparse unique index oluştur
    console.log('🔨 Yeni sparse unique index oluşturuluyor...');
    await salesCollection.createIndex(
      { contractNo: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'contractNo_1_sparse'
      }
    );
    console.log('✅ Yeni sparse unique index oluşturuldu');
    
    // Son durumu kontrol et
    console.log('📋 Güncel indexler:');
    const newIndexes = await salesCollection.indexes();
    console.log(newIndexes.map(idx => ({ name: idx.name, key: idx.key, sparse: idx.sparse, unique: idx.unique })));
    
    console.log('✅ ContractNo index düzeltme işlemi tamamlandı!');
    
  } catch (error) {
    console.error('❌ Index düzeltme hatası:', error);
    throw error;
  }
};

// Script'i çalıştır
const runScript = async () => {
  try {
    await connectDB();
    await fixContractNoIndex();
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

module.exports = { fixContractNoIndex };
