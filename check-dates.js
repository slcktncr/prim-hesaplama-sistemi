const mongoose = require('mongoose');
const Sale = require('./models/Sale');

mongoose.connect('mongodb://localhost:27017/stwork', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('MongoDB bağlantısı başarılı');
  
  // İlk 10 satışı kontrol et
  const sales = await Sale.find({}).limit(10).select('customerName entryDate exitDate periodNo');
  
  console.log('\nİlk 10 satışın giriş/çıkış tarihleri:');
  sales.forEach((sale, index) => {
    console.log(`${index + 1}. ${sale.customerName} - Dönem: ${sale.periodNo}`);
    console.log(`   Giriş: ${sale.entryDate || 'YOK'}`);
    console.log(`   Çıkış: ${sale.exitDate || 'YOK'}`);
    console.log('');
  });
  
  // Giriş tarihi olan satış sayısını kontrol et
  const withEntryDate = await Sale.countDocuments({ entryDate: { $exists: true, $ne: null, $ne: '' } });
  const withExitDate = await Sale.countDocuments({ exitDate: { $exists: true, $ne: null, $ne: '' } });
  const totalSales = await Sale.countDocuments({});
  
  console.log(`\nToplam satış: ${totalSales}`);
  console.log(`Giriş tarihi olan: ${withEntryDate}`);
  console.log(`Çıkış tarihi olan: ${withExitDate}`);
  
  process.exit(0);
}).catch(err => {
  console.error('MongoDB bağlantı hatası:', err);
  process.exit(1);
});
