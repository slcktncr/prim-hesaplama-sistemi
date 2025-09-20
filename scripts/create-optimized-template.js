const XLSX = require('xlsx');
const path = require('path');

function createOptimizedTemplate() {
  // Mevcut sistemdeki iptal verilerine göre optimize edilmiş şablon
  const optimizedTemplateData = [
    {
      'customerName': 'ERDEM İÇLİ',
      'blockNo': 'D12',
      'apartmentNo': '14',
      'periodNo': '34',
      'contractNo': 'SZL-2024-001',
      'saleDate': '2025-09-20',
      'listPrice': 500000,
      'activitySalePrice': 450000,
      'primAmount': 11250,
      'salesperson': 'Fatma KOCAMAN',
      'cancelledAt': '2025-09-13',
      'cancelledBy': 'Selçuk TUNCER'
    },
    {
      'customerName': 'NEVİN ÇIRAK',
      'blockNo': 'D12',
      'apartmentNo': '7',
      'periodNo': '34',
      'contractNo': 'SZL-2024-002',
      'saleDate': '2025-09-20',
      'listPrice': 600000,
      'activitySalePrice': 550000,
      'primAmount': 13750,
      'salesperson': 'Fatma KOCAMAN',
      'cancelledAt': '2025-09-13',
      'cancelledBy': 'Selçuk TUNCER'
    },
    {
      'customerName': 'FATHİ KANAKRI',
      'blockNo': 'D4',
      'apartmentNo': '8',
      'periodNo': '26',
      'contractNo': 'SZL-2024-003',
      'saleDate': '2025-09-20',
      'listPrice': 750000,
      'activitySalePrice': 700000,
      'primAmount': 17500,
      'salesperson': 'Rahma ABOERLISH',
      'cancelledAt': '2025-09-18',
      'cancelledBy': 'Selçuk TUNCER'
    }
  ];

  // Boş şablon - sadece 12 sütun
  const emptyOptimizedTemplate = [
    {
      'customerName': '',
      'blockNo': '',
      'apartmentNo': '',
      'periodNo': '',
      'contractNo': '',
      'saleDate': '', // YYYY-MM-DD
      'listPrice': '', // Sayısal
      'activitySalePrice': '', // Sayısal
      'primAmount': '', // Sayısal
      'salesperson': '', // Ad Soyad
      'cancelledAt': '', // YYYY-MM-DD
      'cancelledBy': '' // Ad Soyad
    }
  ];

  try {
    // Örnek verilerle dolu optimize edilmiş şablon
    const wsWithData = XLSX.utils.json_to_sheet(optimizedTemplateData);
    const wbWithData = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbWithData, wsWithData, 'İptal Satışları');
    
    // Sütun genişlikleri - 12 sütun için optimize edilmiş
    const colWidths = [
      { wch: 20 }, // customerName
      { wch: 8 },  // blockNo
      { wch: 12 }, // apartmentNo
      { wch: 10 }, // periodNo
      { wch: 15 }, // contractNo
      { wch: 12 }, // saleDate
      { wch: 12 }, // listPrice
      { wch: 15 }, // activitySalePrice
      { wch: 12 }, // primAmount
      { wch: 25 }, // salesperson
      { wch: 12 }, // cancelledAt
      { wch: 25 }  // cancelledBy
    ];
    wsWithData['!cols'] = colWidths;

    // Örnek verilerle dolu dosyayı kaydet
    const exampleFilePath = path.join(__dirname, '../iptal_import_optimize.xlsx');
    XLSX.writeFile(wbWithData, exampleFilePath);
    console.log('✓ Optimize edilmiş şablon oluşturuldu:', exampleFilePath);

    // Boş optimize edilmiş şablon
    const wsEmpty = XLSX.utils.json_to_sheet(emptyOptimizedTemplate);
    const wbEmpty = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbEmpty, wsEmpty, 'İptal Satışları');
    wsEmpty['!cols'] = colWidths;

    // Boş dosyayı kaydet
    const emptyFilePath = path.join(__dirname, '../iptal_import_optimize_bos.xlsx');
    XLSX.writeFile(wbEmpty, emptyFilePath);
    console.log('✓ Boş optimize edilmiş şablon oluşturuldu:', emptyFilePath);

    // CSV versiyonu da oluştur
    const csvData = [
      'customerName,blockNo,apartmentNo,periodNo,contractNo,saleDate,listPrice,activitySalePrice,primAmount,salesperson,cancelledAt,cancelledBy',
      'ERDEM İÇLİ,D12,14,34,SZL-2024-001,2025-09-20,500000,450000,11250,Fatma KOCAMAN,2025-09-13,Selçuk TUNCER',
      'NEVİN ÇIRAK,D12,7,34,SZL-2024-002,2025-09-20,600000,550000,13750,Fatma KOCAMAN,2025-09-13,Selçuk TUNCER',
      'FATHİ KANAKRI,D4,8,26,SZL-2024-003,2025-09-20,750000,700000,17500,Rahma ABOERLISH,2025-09-18,Selçuk TUNCER'
    ].join('\n');

    const fs = require('fs');
    const csvFilePath = path.join(__dirname, '../iptal_import_optimize.csv');
    fs.writeFileSync(csvFilePath, csvData, 'utf8');
    console.log('✓ Optimize edilmiş CSV şablonu oluşturuldu:', csvFilePath);

    console.log('\n=== OPTİMİZE EDİLMİŞ ŞABLON DOSYALARI HAZIR ===');
    console.log('1. iptal_import_optimize.xlsx - Mevcut sisteme uygun örnek veriler');
    console.log('2. iptal_import_optimize_bos.xlsx - Boş şablon (12 sütun)');
    console.log('3. iptal_import_optimize.csv - CSV formatı');
    console.log('\n📋 OPTİMİZE EDİLMİŞ ŞABLON İÇERİĞİ:');
    console.log('✅ Sadece 12 Sütun (önceki 17 sütundan %30 azalma)');
    console.log('✅ Mevcut sistemdeki iptal verilerine %100 uyumlu');
    console.log('✅ Gereksiz alanlar tamamen kaldırıldı');
    console.log('✅ Basit ve anlaşılır sütun isimleri');
    console.log('✅ Sözleşme No ZORUNLU DEĞİL - boş bırakılabilir');
    console.log('\n🎯 KALDIRILAN GEREKSIZ ALANLAR:');
    console.log('❌ Telefon (mevcut iptallerde yok)');
    console.log('❌ Satış Türü (hepsi "satis" olacak)');
    console.log('❌ İndirim % (Liste ve Aktivite fiyat farkından anlaşılır)');
    console.log('❌ Ödeme Şekli (mevcut iptallerde yok)');
    console.log('❌ Prim % (Prim tutarı direkt girilecek)');
    console.log('❌ İptal Sebebi (notlar sisteminde tutulacak)');

  } catch (error) {
    console.error('Optimize edilmiş şablon oluşturulurken hata:', error);
  }
}

// Eğer bu dosya doğrudan çalıştırılıyorsa şablonları oluştur
if (require.main === module) {
  createOptimizedTemplate();
}

module.exports = createOptimizedTemplate;
