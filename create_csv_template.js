const fs = require('fs');

// CSV başlıkları
const headers = [
  'customerName',
  'blockNo', 
  'apartmentNo',
  'periodNo',
  'saleType',
  'contractNo',
  'saleDate',
  'entryDate',
  'exitDate',
  'listPrice',
  'discountRate',
  'activitySalePrice',
  'primAmount',
  'primStatus',
  'paymentType',
  'status',
  'salesperson',
  'notes'
];

// Örnek veriler
const sampleData = [
  [
    'Ahmet Yılmaz',
    'A1',
    '12',
    '1',
    'satis',
    'SZL2021001',
    '2021-03-15',
    '2021-06-01',
    '2022-06-01',
    '500000',
    '5',
    '475000',
    '4750',
    'ödendi',
    'Nakit',
    'aktif',
    'admin',
    'Örnek satış kaydı'
  ],
  [
    'Fatma Demir',
    'B2',
    '25',
    '2',
    'kapora',
    'SZL2021002',
    '2021-05-20',
    '2021-08-01',
    '2022-08-01',
    '750000',
    '0',
    '750000',
    '7500',
    'ödenmedi',
    'Kredi',
    'aktif',
    'admin',
    'Kapora örneği'
  ],
  [
    'Mehmet Kaya',
    'C3',
    '8',
    '1',
    'yazlik',
    'SZL2021003',
    '2021-07-10',
    '2021-10-01',
    '2022-10-01',
    '400000',
    '10',
    '360000',
    '3600',
    'ödendi',
    'Nakit',
    'iptal',
    'admin',
    'İptal edilmiş yazlık ev'
  ]
];

try {
  // CSV içeriğini oluştur
  let csvContent = headers.join(',') + '\n';
  
  sampleData.forEach(row => {
    // Her hücreyi tırnak içine al (virgül ve özel karakterler için)
    const escapedRow = row.map(cell => `"${cell}"`);
    csvContent += escapedRow.join(',') + '\n';
  });
  
  // Dosyaya yaz
  fs.writeFileSync('satis_import_sablonu.csv', csvContent, 'utf8');
  
  console.log('✅ CSV şablon dosyası başarıyla oluşturuldu!');
  console.log('📁 Dosya adı: satis_import_sablonu.csv');
  console.log('📊 İçeriği: 3 örnek satış kaydı ile birlikte');
  console.log('');
  console.log('📋 Kullanım:');
  console.log('  1. CSV dosyasını Excel ile açın');
  console.log('  2. Örnek satırları silin (2, 3, 4. satırlar)');
  console.log('  3. Kendi verilerinizi ekleyin');
  console.log('  4. Excel formatında (.xlsx) kaydedin');
  console.log('');
  console.log('💡 Başlık satırını (1. satır) değiştirmeyin!');
  console.log('🎯 Tarih formatı: YYYY-MM-DD (örn: 2021-03-15)');
  
} catch (error) {
  console.error('❌ CSV dosyası oluşturulurken hata:', error.message);
}
