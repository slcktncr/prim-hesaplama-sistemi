const XLSX = require('xlsx');

// Şablon verisi - 3 örnek satır
const templateData = [
  {
    customerName: 'Ahmet Yılmaz',
    blockNo: 'A1',
    apartmentNo: '12',
    periodNo: '1',
    saleType: 'satis',
    contractNo: 'SZL2021001',
    saleDate: '2021-03-15',
    entryDate: '2021-06-01',
    exitDate: '2022-06-01',
    listPrice: 500000,
    discountRate: 5,
    activitySalePrice: 475000,
    primAmount: 4750,
    primStatus: 'ödendi',
    paymentType: 'Nakit',
    status: 'aktif',
    salesperson: 'admin',
    notes: 'Örnek satış kaydı'
  },
  {
    customerName: 'Fatma Demir',
    blockNo: 'B2',
    apartmentNo: '25',
    periodNo: '2',
    saleType: 'kapora',
    contractNo: 'SZL2021002',
    saleDate: '2021-05-20',
    entryDate: '2021-08-01',
    exitDate: '2022-08-01',
    listPrice: 750000,
    discountRate: 0,
    activitySalePrice: 750000,
    primAmount: 7500,
    primStatus: 'ödenmedi',
    paymentType: 'Kredi',
    status: 'aktif',
    salesperson: 'admin',
    notes: 'Kapora örneği'
  },
  {
    customerName: 'Mehmet Kaya',
    blockNo: 'C3',
    apartmentNo: '8',
    periodNo: '1',
    saleType: 'yazlik',
    contractNo: 'SZL2021003',
    saleDate: '2021-07-10',
    entryDate: '2021-10-01',
    exitDate: '2022-10-01',
    listPrice: 400000,
    discountRate: 10,
    activitySalePrice: 360000,
    primAmount: 3600,
    primStatus: 'ödendi',
    paymentType: 'Nakit',
    status: 'iptal',
    salesperson: 'admin',
    notes: 'İptal edilmiş yazlık ev'
  }
];

try {
  // Excel oluştur
  const ws = XLSX.utils.json_to_sheet(templateData);
  
  // Kolon genişliklerini ayarla
  const colWidths = [
    { wch: 15 }, // customerName
    { wch: 8 },  // blockNo
    { wch: 8 },  // apartmentNo
    { wch: 8 },  // periodNo
    { wch: 10 }, // saleType
    { wch: 12 }, // contractNo
    { wch: 12 }, // saleDate
    { wch: 12 }, // entryDate
    { wch: 12 }, // exitDate
    { wch: 12 }, // listPrice
    { wch: 10 }, // discountRate
    { wch: 15 }, // activitySalePrice
    { wch: 12 }, // primAmount
    { wch: 10 }, // primStatus
    { wch: 10 }, // paymentType
    { wch: 8 },  // status
    { wch: 12 }, // salesperson
    { wch: 20 }  // notes
  ];
  
  ws['!cols'] = colWidths;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Satışlar');
  
  // Dosyaya kaydet
  XLSX.writeFile(wb, 'satis_import_sablonu.xlsx');
  
  console.log('✅ Excel şablon dosyası başarıyla oluşturuldu!');
  console.log('📁 Dosya adı: satis_import_sablonu.xlsx');
  console.log('📊 İçeriği: 3 örnek satış kaydı ile birlikte');
  console.log('');
  console.log('📋 Şablonda bulunan satış türleri:');
  console.log('  - Normal satış (satis)');
  console.log('  - Kapora (kapora)');
  console.log('  - Yazlık ev (yazlik)');
  console.log('  - İptal durumu örneği');
  console.log('');
  console.log('💡 Bu dosyayı açıp örnek satırları silin, kendi verilerinizi ekleyin.');
  console.log('🎯 Başlık satırını (1. satır) değiştirmeyin!');
  
} catch (error) {
  console.error('❌ Excel dosyası oluşturulurken hata:', error.message);
  console.log('');
  console.log('🔧 Alternatif: Manuel olarak Excel oluşturun');
  console.log('📋 İlk satıra şu başlıkları yazın:');
  console.log('customerName	blockNo	apartmentNo	periodNo	saleType	contractNo	saleDate	entryDate	exitDate	listPrice	discountRate	activitySalePrice	primAmount	primStatus	paymentType	status	salesperson	notes');
}
