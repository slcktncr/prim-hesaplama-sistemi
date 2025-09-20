const XLSX = require('xlsx');
const path = require('path');

function createExcelTemplate() {
  // Şablon verileri
  const templateData = [
    {
      'Müşteri Adı Soyadı': 'Ahmet Yılmaz',
      'Telefon': '05551234567',
      'Blok No': 'A',
      'Daire No': '101',
      'Dönem No': '2024-1',
      'Satış Türü': 'satis',
      'Satış Tarihi': '2024-01-15',
      'Kapora Tarihi': '',
      'Sözleşme No': 'SZL-2024-001',
      'Liste Fiyatı': 500000,
      'İndirim Oranı': 10,
      'Aktivite Satış Fiyatı': 450000,
      'Ödeme Tipi': 'nakit',
      'Giriş Tarihi': '15/06',
      'Çıkış Tarihi': '20/08',
      'Prim Oranı': 2.5,
      'Satış Danışmanı Email': 'satis@firma.com',
      'İptal Tarihi': '2024-02-20',
      'İptal Eden Kullanıcı Email': 'admin@firma.com',
      'Notlar': 'Müşteri talebi üzerine iptal'
    },
    {
      'Müşteri Adı Soyadı': 'Ayşe Demir',
      'Telefon': '05559876543',
      'Blok No': 'B',
      'Daire No': '205',
      'Dönem No': '2024-1',
      'Satış Türü': 'kapora',
      'Satış Tarihi': '',
      'Kapora Tarihi': '2024-01-10',
      'Sözleşme No': '',
      'Liste Fiyatı': '',
      'İndirim Oranı': '',
      'Aktivite Satış Fiyatı': '',
      'Ödeme Tipi': '',
      'Giriş Tarihi': '',
      'Çıkış Tarihi': '',
      'Prim Oranı': 1.5,
      'Satış Danışmanı Email': 'satis2@firma.com',
      'İptal Tarihi': '2024-01-25',
      'İptal Eden Kullanıcı Email': 'admin@firma.com',
      'Notlar': 'Finansman sorunu'
    },
    {
      'Müşteri Adı Soyadı': 'Mehmet Kaya',
      'Telefon': '05555555555',
      'Blok No': 'C',
      'Daire No': '302',
      'Dönem No': '2024-2',
      'Satış Türü': 'satis',
      'Satış Tarihi': '2024-03-01',
      'Kapora Tarihi': '',
      'Sözleşme No': 'SZL-2024-002',
      'Liste Fiyatı': 750000,
      'İndirim Oranı': 15,
      'Aktivite Satış Fiyatı': 637500,
      'Ödeme Tipi': 'taksit',
      'Giriş Tarihi': '01/07',
      'Çıkış Tarihi': '31/08',
      'Prim Oranı': 3,
      'Satış Danışmanı Email': 'satis@firma.com',
      'İptal Tarihi': '2024-03-15',
      'İptal Eden Kullanıcı Email': 'manager@firma.com',
      'Notlar': 'Sözleşme ihlali'
    }
  ];

  // Boş şablon için sadece başlıkları içeren veri
  const emptyTemplate = [
    {
      'Müşteri Adı Soyadı': '',
      'Telefon': '',
      'Blok No': '',
      'Daire No': '',
      'Dönem No': '',
      'Satış Türü': '',
      'Satış Tarihi': '',
      'Kapora Tarihi': '',
      'Sözleşme No': '',
      'Liste Fiyatı': '',
      'İndirim Oranı': '',
      'Aktivite Satış Fiyatı': '',
      'Ödeme Tipi': '',
      'Giriş Tarihi': '',
      'Çıkış Tarihi': '',
      'Prim Oranı': '',
      'Satış Danışmanı Email': '',
      'İptal Tarihi': '',
      'İptal Eden Kullanıcı Email': '',
      'Notlar': ''
    }
  ];

  try {
    // Örnek verilerle dolu şablon oluştur
    const wsWithData = XLSX.utils.json_to_sheet(templateData);
    const wbWithData = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbWithData, wsWithData, 'İptal Satışları');
    
    // Sütun genişliklerini ayarla
    const colWidths = [
      { wch: 20 }, // Müşteri Adı Soyadı
      { wch: 15 }, // Telefon
      { wch: 10 }, // Blok No
      { wch: 10 }, // Daire No
      { wch: 12 }, // Dönem No
      { wch: 12 }, // Satış Türü
      { wch: 12 }, // Satış Tarihi
      { wch: 12 }, // Kapora Tarihi
      { wch: 15 }, // Sözleşme No
      { wch: 12 }, // Liste Fiyatı
      { wch: 12 }, // İndirim Oranı
      { wch: 15 }, // Aktivite Satış Fiyatı
      { wch: 12 }, // Ödeme Tipi
      { wch: 12 }, // Giriş Tarihi
      { wch: 12 }, // Çıkış Tarihi
      { wch: 12 }, // Prim Oranı
      { wch: 25 }, // Satış Danışmanı Email
      { wch: 12 }, // İptal Tarihi
      { wch: 25 }, // İptal Eden Kullanıcı Email
      { wch: 30 }  // Notlar
    ];
    wsWithData['!cols'] = colWidths;

    // Örnek verilerle dolu dosyayı kaydet
    const exampleFilePath = path.join(__dirname, '../iptal_satis_ornekli_sablon.xlsx');
    XLSX.writeFile(wbWithData, exampleFilePath);
    console.log('✓ Örnek verilerle dolu şablon oluşturuldu:', exampleFilePath);

    // Boş şablon oluştur
    const wsEmpty = XLSX.utils.json_to_sheet(emptyTemplate);
    const wbEmpty = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbEmpty, wsEmpty, 'İptal Satışları');
    wsEmpty['!cols'] = colWidths;

    // Boş dosyayı kaydet
    const emptyFilePath = path.join(__dirname, '../iptal_satis_bos_sablon.xlsx');
    XLSX.writeFile(wbEmpty, emptyFilePath);
    console.log('✓ Boş şablon oluşturuldu:', emptyFilePath);

    console.log('\n=== ŞABLON DOSYALARI HAZIR ===');
    console.log('1. iptal_satis_ornekli_sablon.xlsx - Örnek verilerle dolu');
    console.log('2. iptal_satis_bos_sablon.xlsx - Boş şablon');
    console.log('3. iptal_satis_import_sablonu.csv - CSV formatı');

  } catch (error) {
    console.error('Excel şablonu oluşturulurken hata:', error);
  }
}

// Eğer bu dosya doğrudan çalıştırılıyorsa şablonları oluştur
if (require.main === module) {
  createExcelTemplate();
}

module.exports = createExcelTemplate;
