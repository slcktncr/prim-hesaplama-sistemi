const XLSX = require('xlsx');
const path = require('path');

function createMinimalTemplate() {
  // Minimal şablon - sadece gerekli alanlar
  const minimalTemplateData = [
    {
      'Müşteri Adı': 'Ahmet Yılmaz',
      'Telefon': '05551234567',
      'Blok': 'A',
      'Daire': '101', 
      'Dönem': '2024-1',
      'Satış Türü': 'satis',
      'Satış Tarihi': '2024-01-15',
      'Sözleşme No': 'SZL-2024-001',
      'Liste Fiyatı': 500000,
      'İndirim %': 10,
      'Satış Fiyatı': 450000,
      'Ödeme Şekli': 'nakit',
      'Prim %': 2.5,
      'Satış Danışmanı': 'satis@firma.com',
      'İptal Tarihi': '2024-02-20',
      'İptal Eden': 'admin@firma.com',
      'İptal Sebebi': 'Müşteri talebi'
    },
    {
      'Müşteri Adı': 'Ayşe Demir',
      'Telefon': '05559876543',
      'Blok': 'B',
      'Daire': '205',
      'Dönem': '2024-1', 
      'Satış Türü': 'kapora',
      'Satış Tarihi': '2024-01-10',
      'Sözleşme No': '',
      'Liste Fiyatı': '',
      'İndirim %': '',
      'Satış Fiyatı': '',
      'Ödeme Şekli': '',
      'Prim %': 1.5,
      'Satış Danışmanı': 'satis2@firma.com',
      'İptal Tarihi': '2024-01-25',
      'İptal Eden': 'admin@firma.com',
      'İptal Sebebi': 'Finansman sorunu'
    }
  ];

  // Boş şablon
  const emptyMinimalTemplate = [
    {
      'Müşteri Adı': '',
      'Telefon': '',
      'Blok': '',
      'Daire': '',
      'Dönem': '',
      'Satış Türü': '', // satis, kapora, yazlkev, kslkev
      'Satış Tarihi': '', // YYYY-MM-DD formatında
      'Sözleşme No': '',
      'Liste Fiyatı': '',
      'İndirim %': '', // 0-100 arası
      'Satış Fiyatı': '',
      'Ödeme Şekli': '', // nakit, taksit, vs.
      'Prim %': '', // 0-100 arası
      'Satış Danışmanı': '', // Email adresi
      'İptal Tarihi': '', // YYYY-MM-DD formatında
      'İptal Eden': '', // Email adresi
      'İptal Sebebi': ''
    }
  ];

  try {
    // Örnek verilerle dolu minimal şablon
    const wsWithData = XLSX.utils.json_to_sheet(minimalTemplateData);
    const wbWithData = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbWithData, wsWithData, 'İptal Satışları');
    
    // Sütun genişlikleri - daha az sütun olduğu için daha geniş
    const colWidths = [
      { wch: 20 }, // Müşteri Adı
      { wch: 15 }, // Telefon
      { wch: 8 },  // Blok
      { wch: 8 },  // Daire
      { wch: 10 }, // Dönem
      { wch: 12 }, // Satış Türü
      { wch: 12 }, // Satış Tarihi
      { wch: 15 }, // Sözleşme No
      { wch: 12 }, // Liste Fiyatı
      { wch: 10 }, // İndirim %
      { wch: 12 }, // Satış Fiyatı
      { wch: 12 }, // Ödeme Şekli
      { wch: 8 },  // Prim %
      { wch: 25 }, // Satış Danışmanı
      { wch: 12 }, // İptal Tarihi
      { wch: 20 }, // İptal Eden
      { wch: 25 }  // İptal Sebebi
    ];
    wsWithData['!cols'] = colWidths;

    // Örnek verilerle dolu dosyayı kaydet
    const exampleFilePath = path.join(__dirname, '../iptal_import_ornekli.xlsx');
    XLSX.writeFile(wbWithData, exampleFilePath);
    console.log('✓ Örnek verilerle minimal şablon oluşturuldu:', exampleFilePath);

    // Boş minimal şablon
    const wsEmpty = XLSX.utils.json_to_sheet(emptyMinimalTemplate);
    const wbEmpty = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbEmpty, wsEmpty, 'İptal Satışları');
    wsEmpty['!cols'] = colWidths;

    // Boş dosyayı kaydet
    const emptyFilePath = path.join(__dirname, '../iptal_import_bos.xlsx');
    XLSX.writeFile(wbEmpty, emptyFilePath);
    console.log('✓ Boş minimal şablon oluşturuldu:', emptyFilePath);

    // CSV versiyonu da oluştur
    const csvData = [
      'Müşteri Adı,Telefon,Blok,Daire,Dönem,Satış Türü,Satış Tarihi,Sözleşme No,Liste Fiyatı,İndirim %,Satış Fiyatı,Ödeme Şekli,Prim %,Satış Danışmanı,İptal Tarihi,İptal Eden,İptal Sebebi',
      'Ahmet Yılmaz,05551234567,A,101,2024-1,satis,2024-01-15,SZL-2024-001,500000,10,450000,nakit,2.5,satis@firma.com,2024-02-20,admin@firma.com,Müşteri talebi',
      'Ayşe Demir,05559876543,B,205,2024-1,kapora,2024-01-10,,,,,1.5,satis2@firma.com,2024-01-25,admin@firma.com,Finansman sorunu'
    ].join('\n');

    const fs = require('fs');
    const csvFilePath = path.join(__dirname, '../iptal_import_ornekli.csv');
    fs.writeFileSync(csvFilePath, csvData, 'utf8');
    console.log('✓ CSV şablonu oluşturuldu:', csvFilePath);

    console.log('\n=== MİNİMAL ŞABLON DOSYALARI HAZIR ===');
    console.log('1. iptal_import_ornekli.xlsx - Örnek verilerle (17 sütun)');
    console.log('2. iptal_import_bos.xlsx - Boş şablon (17 sütun)');
    console.log('3. iptal_import_ornekli.csv - CSV formatı');
    console.log('\n📋 ŞABLON İÇERİĞİ:');
    console.log('✅ Zorunlu Alanlar: Müşteri Adı, Blok, Daire, Dönem, Satış Türü, Satış Tarihi');
    console.log('✅ İptal Bilgileri: İptal Tarihi, İptal Eden, İptal Sebebi');
    console.log('✅ Kullanıcı Bilgisi: Satış Danışmanı (email)');
    console.log('✅ Satış Bilgileri: Liste Fiyatı, İndirim %, Satış Fiyatı, Ödeme Şekli');
    console.log('✅ Prim Bilgisi: Prim %');
    console.log('❌ Kaldırılan: Giriş/Çıkış Tarihleri, Kapora Tarihi, Aktivite Satış Fiyatı');

  } catch (error) {
    console.error('Minimal şablon oluşturulurken hata:', error);
  }
}

// Eğer bu dosya doğrudan çalıştırılıyorsa şablonları oluştur
if (require.main === module) {
  createMinimalTemplate();
}

module.exports = createMinimalTemplate;
