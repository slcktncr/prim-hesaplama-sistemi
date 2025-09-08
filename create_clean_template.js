const fs = require('fs');

// Excel için TAB ile ayrılmış format (TSV) - Excel'de düzgün sütunlar oluşturur
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
  'primStatus',
  'paymentType',
  'status',
  'salesperson',
  'notes'
];

// Örnek veriler - TAB ile ayrılacak
const sampleData = [
  [
    'Ahmet Yılmaz',
    'A1',
    '12',
    '1',
    'satis',
    'SZL2021001',
    '2021-03-15',
    '01/06',
    '01/06',
    '500000',
    '5',
    '475000',
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
    '01/08',
    '01/08',
    '750000',
    '0',
    '750000',
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
    '01/10',
    '01/10',
    '400000',
    '10',
    '360000',
    'ödendi',
    'Nakit',
    'iptal',
    'admin',
    'İptal edilmiş yazlık ev'
  ]
];

try {
  // TSV içeriğini oluştur (TAB ile ayrılmış)
  let tsvContent = headers.join('\t') + '\n';
  
  sampleData.forEach(row => {
    tsvContent += row.join('\t') + '\n';
  });
  
  // .txt dosyası olarak kaydet (Excel'de açılabilir)
  fs.writeFileSync('satis_import_sablonu.txt', tsvContent, 'utf8');
  
  console.log('✅ Excel şablon dosyası başarıyla oluşturuldu!');
  console.log('📁 Dosya adı: satis_import_sablonu.txt');
  console.log('');
  console.log('📋 Kullanım Adımları:');
  console.log('  1. satis_import_sablonu.txt dosyasını çift tıklayarak açın');
  console.log('  2. Excel ile açılacak ve düzgün sütunlar halinde görünecek');
  console.log('  3. Örnek satırları silin (2, 3, 4. satırlar)');
  console.log('  4. Kendi verilerinizi sütunlara yapıştırın');
  console.log('  5. Excel formatında (.xlsx) olarak kaydedin');
  console.log('  6. Web sitesinden import edin');
  console.log('');
  console.log('💡 Artık tırnak işareti yok, düzgün sütunlar var!');
  console.log('🎯 Her sütuna direkt veri yapıştırabilirsiniz');
  console.log('📅 Tarih Formatları:');
  console.log('   - Satış Tarihi: YYYY-MM-DD (örn: 2021-03-15)');
  console.log('   - Giriş/Çıkış: GG/AA (örn: 01/06 = 1 Haziran)');
  
  // Ayrıca boş şablon da oluştur
  const emptyTemplate = headers.join('\t') + '\n';
  fs.writeFileSync('satis_import_bos_sablon.txt', emptyTemplate, 'utf8');
  console.log('');
  console.log('📄 Bonus: Boş şablon da oluşturuldu');
  console.log('📁 Dosya adı: satis_import_bos_sablon.txt (sadece başlıklar)');
  
} catch (error) {
  console.error('❌ Şablon dosyası oluşturulurken hata:', error.message);
}

// Başlıkları konsola da yazdır
console.log('');
console.log('📊 Sütun Başlıkları (soldan sağa):');
console.log('');
headers.forEach((header, index) => {
  const columnLetter = String.fromCharCode(65 + index); // A, B, C, D...
  console.log(`  ${columnLetter}: ${header}`);
});

console.log('');
console.log('💡 Prim Tutarı Otomatik Hesaplanır! (Artık girmenize gerek yok)');
console.log('🔥 Artık Excel\'de düzgün sütunlar halinde görünecek!');
