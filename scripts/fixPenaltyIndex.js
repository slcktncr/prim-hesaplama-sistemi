const mongoose = require('mongoose');
require('dotenv').config();

async function fixPenaltyIndex() {
  try {
    console.log('🔧 Connecting to database...');
    
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    const db = mongoose.connection.db;
    const collection = db.collection('penaltyrecords');
    
    console.log('📋 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key })));
    
    // Drop the problematic index if it exists
    try {
      console.log('🗑️ Attempting to drop salesperson_1_year_1 index...');
      await collection.dropIndex('salesperson_1_year_1');
      console.log('✅ Successfully dropped salesperson_1_year_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ salesperson_1_year_1 index does not exist');
      } else {
        console.log('⚠️ Error dropping index:', error.message);
      }
    }
    
    // Also check for any other salesperson indexes
    for (const index of indexes) {
      if (index.name.includes('salesperson')) {
        try {
          console.log(`🗑️ Dropping salesperson-related index: ${index.name}`);
          await collection.dropIndex(index.name);
          console.log(`✅ Successfully dropped ${index.name}`);
        } catch (error) {
          console.log(`⚠️ Error dropping ${index.name}:`, error.message);
        }
      }
    }
    
    console.log('📋 Final indexes after cleanup:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('✅ Penalty index fix completed');
    
  } catch (error) {
    console.error('❌ Error fixing penalty index:', error);
    throw error;
  }
}

module.exports = fixPenaltyIndex;

// Run if called directly
if (require.main === module) {
  fixPenaltyIndex()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
