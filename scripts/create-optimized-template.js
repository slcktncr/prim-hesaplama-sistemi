const XLSX = require('xlsx');
const path = require('path');

function createOptimizedTemplate() {
  // Mevcut sistemdeki iptal verilerine göre optimize edilmiş şablon
  const optimizedTemplateData = [
    {
      'Müşteri Adı': 'ERDEM İÇLİ',
      'Blok': 'D12',
      'Daire': '14',
      'Dönem': '34',
      'Sözleşme No': 'SZL-2024-001',
      'Satış Tarihi': '2025-09-20',
      'Liste Fiyatı': 500000,
      'Aktivite Fiyatı': 450000,
      'Prim Tutarı': 11250,
      'Temsilci Email': 'fatma@firma.com',
      'İptal Tarihi': '2025-09-13',
      'İptal Eden Email': 'admin@firma.com'
    },
    {
      'Müşteri Adı': 'NEVİN ÇIRAK',
      'Blok': 'D12',
      'Daire': '7',
      'Dönem': '34',
      'Sözleşme No': 'SZL-2024-002',
      'Satış Tarihi': '2025-09-20',
      'Liste Fiyatı': 600000,
      'Aktivite Fiyatı': 550000,
      'Prim Tutarı': 13750,
      'Temsilci Email': 'fatma@firma.com',
      'İptal Tarihi': '2025-09-13',
      'İptal Eden Email': 'admin@firma.com'
    },
    {
      'Müşteri Adı': 'FATHİ KANAKRI',
      'Blok': 'D4',
      'Daire': '8',
      'Dönem': '26',
      'Sözleşme No': 'SZL-2024-003',
      'Satış Tarihi': '2025-09-20',
      'Liste Fiyatı': 750000,
      'Aktivite Fiyatı': 700000,
      'Prim Tutarı': 17500,
      'Temsilci Email': 'rahma@firma.com',
      'İptal Tarihi': '2025-09-18',
      'İptal Eden Email': 'admin@firma.com'
    }
  ];

  // Boş şablon - sadece 12 sütun
  const emptyOptimizedTemplate = [
    {
      'Müşteri Adı': '',
      'Blok': '',
      'Daire': '',
      'Dönem': '',
      'Sözleşme No': '',
      'Satış Tarihi': '', // YYYY-MM-DD
      'Liste Fiyatı': '', // Sayısal
      'Aktivite Fiyatı': '', // Sayısal
      'Prim Tutarı': '', // Sayısal
      'Temsilci Email': '', // Email
      'İptal Tarihi': '', // YYYY-MM-DD
      'İptal Eden Email': '' // Email
    }
  ];

  try {
    // Örnek verilerle dolu optimize edilmiş şablon
    const wsWithData = XLSX.utils.json_to_sheet(optimizedTemplateData);
    const wbWithData = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbWithData, wsWithData, 'İptal Satışları');
    
    // Sütun genişlikleri - 12 sütun için optimize edilmiş
    const colWidths = [
      { wch: 20 }, // Müşteri Adı
      { wch: 8 },  // Blok
      { wch: 8 },  // Daire
      { wch: 10 }, // Dönem
      { wch: 15 }, // Sözleşme No
      { wch: 12 }, // Satış Tarihi
      { wch: 12 }, // Liste Fiyatı
      { wch: 12 }, // Aktivite Fiyatı
      { wch: 12 }, // Prim Tutarı
      { wch: 25 }, // Temsilci Email
      { wch: 12 }, // İptal Tarihi
      { wch: 25 }  // İptal Eden Email
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
      'Müşteri Adı,Blok,Daire,Dönem,Sözleşme No,Satış Tarihi,Liste Fiyatı,Aktivite Fiyatı,Prim Tutarı,Temsilci Email,İptal Tarihi,İptal Eden Email',
      'ERDEM İÇLİ,D12,14,34,SZL-2024-001,2025-09-20,500000,450000,11250,fatma@firma.com,2025-09-13,admin@firma.com',
      'NEVİN ÇIRAK,D12,7,34,SZL-2024-002,2025-09-20,600000,550000,13750,fatma@firma.com,2025-09-13,admin@firma.com',
      'FATHİ KANAKRI,D4,8,26,SZL-2024-003,2025-09-20,750000,700000,17500,rahma@firma.com,2025-09-18,admin@firma.com'
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
