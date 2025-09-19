const mongoose = require('mongoose');
const Sale = require('../models/Sale');

const fixContractNoIndex = async () => {
  try {
    console.log('🔧 Fixing contractNo index...');
    
    // MongoDB bağlantısını kur
    const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stwork';
    await mongoose.connect(DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Mevcut index'leri listele
    const indexes = await Sale.collection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique,
      sparse: idx.sparse,
      partialFilterExpression: idx.partialFilterExpression
    })));
    
    // Eski contractNo index'ini sil
    try {
      await Sale.collection.dropIndex({ contractNo: 1 });
      console.log('🗑️ Dropped old contractNo index');
    } catch (error) {
      console.log('ℹ️ Old index not found or already dropped:', error.message);
    }
    
    // Yeni partial index oluştur
    await Sale.collection.createIndex(
      { contractNo: 1 }, 
      { 
        unique: true, 
        partialFilterExpression: { contractNo: { $ne: null } },
        name: 'contractNo_1_partial'
      }
    );
    console.log('✅ Created new partial unique index for contractNo');
    
    // Yeni index'leri listele
    const newIndexes = await Sale.collection.indexes();
    console.log('📋 New indexes:', newIndexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique,
      sparse: idx.sparse,
      partialFilterExpression: idx.partialFilterExpression
    })));
    
    // Test: Kapora kayıtlarını kontrol et
    const kaporaCount = await Sale.countDocuments({ saleType: 'kapora', contractNo: null });
    console.log(`📊 Found ${kaporaCount} kapora records with null contractNo`);
    
    console.log('🎉 Index fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing index:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
  }
};

// Script'i çalıştır
if (require.main === module) {
  fixContractNoIndex();
}

module.exports = fixContractNoIndex;