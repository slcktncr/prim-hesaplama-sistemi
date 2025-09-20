const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const Sale = require('../models/Sale');
const User = require('../models/User'); // User modelinizin yolunu güncelleyin
const PrimPeriod = require('../models/PrimPeriod'); // PrimPeriod modelinizin yolunu güncelleyin

class CancelledSalesImporter {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successCount = 0;
    this.userCache = new Map();
    this.primPeriodCache = new Map();
  }

  async importFromExcel(filePath) {
    try {
      console.log('İptal edilen satışları import etmeye başlıyor...');
      
    // Dosya uzantısına göre okuma yöntemi belirle
    let data;
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.csv') {
      // CSV dosyasını oku
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      // Excel dosyasını oku
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else {
      throw new Error('Desteklenmeyen dosya formatı. Sadece .xlsx, .xls ve .csv dosyaları desteklenir.');
    }

      console.log(`${data.length} kayıt bulundu.`);

      // Kullanıcıları ve prim dönemlerini önbelleğe al
      await this.loadCacheData();

      // Her satırı işle
      for (let i = 0; i < data.length; i++) {
        const rowData = data[i];
        const rowNumber = i + 2; // Excel'de başlık satırı 1, veri 2'den başlar

        try {
          await this.processSaleRow(rowData, rowNumber);
        } catch (error) {
          this.errors.push(`Satır ${rowNumber}: ${error.message}`);
        }
      }

      // Sonuçları göster
      this.showResults();

    } catch (error) {
      console.error('Import hatası:', error);
      throw error;
    }
  }

  async loadCacheData() {
    // Kullanıcıları yükle
    const users = await User.find({}, 'email _id name');
    users.forEach(user => {
      this.userCache.set(user.email.toLowerCase(), user);
    });

    // Prim dönemlerini yükle
    const primPeriods = await PrimPeriod.find({}, '_id name startDate endDate');
    primPeriods.forEach(period => {
      this.primPeriodCache.set(period.name, period);
    });
  }

  async processSaleRow(rowData, rowNumber) {
    // Veri doğrulama
    const validationResult = this.validateRowData(rowData, rowNumber);
    if (!validationResult.isValid) {
      throw new Error(validationResult.errors.join(', '));
    }

    // Kullanıcıları bul
    const salesperson = this.findUserByEmail(rowData['Satış Danışmanı Email']);
    const cancelledBy = this.findUserByEmail(rowData['İptal Eden Kullanıcı Email']);

    if (!salesperson) {
      throw new Error(`Satış danışmanı bulunamadı: ${rowData['Satış Danışmanı Email']}`);
    }

    if (!cancelledBy) {
      throw new Error(`İptal eden kullanıcı bulunamadı: ${rowData['İptal Eden Kullanıcı Email']}`);
    }

    // Prim dönemini bul (sadece kapora değilse)
    let primPeriod = null;
    if (rowData['Satış Türü'] !== 'kapora') {
      primPeriod = this.findPrimPeriodByDate(this.parseDate(rowData['Satış Tarihi']));
      if (!primPeriod) {
        this.warnings.push(`Satır ${rowNumber}: Prim dönemi bulunamadı, varsayılan dönem kullanılacak`);
      }
    }

    // Sale kaydını oluştur
    const saleData = {
      // Müşteri bilgileri
      customerName: rowData['Müşteri Adı Soyadı'],
      phone: rowData['Telefon'] || null,
      blockNo: rowData['Blok No'],
      apartmentNo: rowData['Daire No'],
      periodNo: rowData['Dönem No'],

      // Satış bilgileri
      saleType: rowData['Satış Türü'],
      saleDate: rowData['Satış Türü'] !== 'kapora' ? this.parseDate(rowData['Satış Tarihi']) : null,
      kaporaDate: rowData['Satış Türü'] === 'kapora' ? this.parseDate(rowData['Kapora Tarihi']) : null,
      contractNo: rowData['Sözleşme No'] || null,
      listPrice: rowData['Satış Türü'] !== 'kapora' ? parseFloat(rowData['Liste Fiyatı']) : null,
      discountRate: parseFloat(rowData['İndirim Oranı']) || 0,
      activitySalePrice: rowData['Satış Türü'] !== 'kapora' ? parseFloat(rowData['Aktivite Satış Fiyatı']) : null,
      paymentType: rowData['Satış Türü'] !== 'kapora' ? rowData['Ödeme Tipi'] : null,

      // Giriş-çıkış tarihleri
      entryDate: rowData['Giriş Tarihi'] || null,
      exitDate: rowData['Çıkış Tarihi'] || null,

      // Prim bilgileri
      primRate: parseFloat(rowData['Prim Oranı']) || null,

      // İlişkiler
      salesperson: salesperson._id,
      primPeriod: primPeriod ? primPeriod._id : null,

      // Durum bilgileri - İPTAL EDİLMİŞ OLARAK AYARLA
      status: 'iptal',
      cancelledAt: this.parseDate(rowData['İptal Tarihi']),
      cancelledBy: cancelledBy._id,

      // Notlar
      notes: rowData['Notlar'] || null,

      // Import tracking
      isImported: true,
      originalSalesperson: salesperson._id,

      // Tarihler
      createdAt: rowData['Satış Türü'] === 'kapora' ? 
        this.parseDate(rowData['Kapora Tarihi']) : 
        this.parseDate(rowData['Satış Tarihi']),
      updatedAt: this.parseDate(rowData['İptal Tarihi'])
    };

    // İndirimli liste fiyatını hesapla
    if (saleData.listPrice && saleData.discountRate > 0) {
      saleData.discountedListPrice = saleData.listPrice * (1 - saleData.discountRate / 100);
      saleData.originalListPrice = saleData.listPrice;
    }

    // Sale kaydını oluştur
    const sale = new Sale(saleData);
    await sale.save();

    this.successCount++;
    console.log(`✓ Satır ${rowNumber}: ${rowData['Müşteri Adı Soyadı']} - İptal kaydı oluşturuldu`);
  }

  validateRowData(rowData, rowNumber) {
    const errors = [];

    // Zorunlu alanları kontrol et
    const requiredFields = [
      'Müşteri Adı Soyadı',
      'Blok No', 
      'Daire No',
      'Dönem No',
      'Satış Türü',
      'Satış Danışmanı Email',
      'İptal Tarihi',
      'İptal Eden Kullanıcı Email'
    ];

    requiredFields.forEach(field => {
      if (!rowData[field] || rowData[field].toString().trim() === '') {
        errors.push(`${field} boş olamaz`);
      }
    });

    // Satış türüne göre zorunlu alanları kontrol et
    if (rowData['Satış Türü'] === 'kapora') {
      if (!rowData['Kapora Tarihi']) {
        errors.push('Kapora türü için Kapora Tarihi gereklidir');
      }
    } else {
      const requiredForSale = ['Satış Tarihi', 'Liste Fiyatı', 'Aktivite Satış Fiyatı', 'Ödeme Tipi'];
      requiredForSale.forEach(field => {
        if (!rowData[field]) {
          errors.push(`Satış türü için ${field} gereklidir`);
        }
      });
    }

    // Tarih formatlarını kontrol et
    if (rowData['Satış Tarihi'] && !this.isValidDate(rowData['Satış Tarihi'])) {
      errors.push('Geçersiz Satış Tarihi formatı (YYYY-MM-DD bekleniyor)');
    }

    if (rowData['Kapora Tarihi'] && !this.isValidDate(rowData['Kapora Tarihi'])) {
      errors.push('Geçersiz Kapora Tarihi formatı (YYYY-MM-DD bekleniyor)');
    }

    if (rowData['İptal Tarihi'] && !this.isValidDate(rowData['İptal Tarihi'])) {
      errors.push('Geçersiz İptal Tarihi formatı (YYYY-MM-DD bekleniyor)');
    }

    // Giriş-çıkış tarih formatlarını kontrol et
    if (rowData['Giriş Tarihi'] && !this.isValidDayMonth(rowData['Giriş Tarihi'])) {
      errors.push('Geçersiz Giriş Tarihi formatı (GG/AA bekleniyor)');
    }

    if (rowData['Çıkış Tarihi'] && !this.isValidDayMonth(rowData['Çıkış Tarihi'])) {
      errors.push('Geçersiz Çıkış Tarihi formatı (GG/AA bekleniyor)');
    }

    // Sayısal değerleri kontrol et
    if (rowData['Liste Fiyatı'] && isNaN(parseFloat(rowData['Liste Fiyatı']))) {
      errors.push('Liste Fiyatı sayısal değer olmalıdır');
    }

    if (rowData['Aktivite Satış Fiyatı'] && isNaN(parseFloat(rowData['Aktivite Satış Fiyatı']))) {
      errors.push('Aktivite Satış Fiyatı sayısal değer olmalıdır');
    }

    if (rowData['İndirim Oranı'] && (isNaN(parseFloat(rowData['İndirim Oranı'])) || parseFloat(rowData['İndirim Oranı']) < 0 || parseFloat(rowData['İndirim Oranı']) > 100)) {
      errors.push('İndirim Oranı 0-100 arasında sayısal değer olmalıdır');
    }

    if (rowData['Prim Oranı'] && (isNaN(parseFloat(rowData['Prim Oranı'])) || parseFloat(rowData['Prim Oranı']) < 0 || parseFloat(rowData['Prim Oranı']) > 100)) {
      errors.push('Prim Oranı 0-100 arasında sayısal değer olmalıdır');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  findUserByEmail(email) {
    if (!email) return null;
    return this.userCache.get(email.toLowerCase());
  }

  findPrimPeriodByDate(date) {
    if (!date) return null;
    
    // Tarihe göre uygun prim dönemini bul
    for (const [name, period] of this.primPeriodCache) {
      if (date >= period.startDate && date <= period.endDate) {
        return period;
      }
    }
    return null;
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    // Excel'den gelen tarih formatları
    if (typeof dateString === 'number') {
      // Excel serial date
      return new Date((dateString - 25569) * 86400 * 1000);
    }
    
    // String formatları
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  isValidDate(dateString) {
    if (!dateString) return false;
    const date = this.parseDate(dateString);
    return date && !isNaN(date.getTime());
  }

  isValidDayMonth(dateString) {
    if (!dateString) return true; // Opsiyonel alan
    return /^([0-2][0-9]|3[01])\/([0][1-9]|1[0-2])$/.test(dateString);
  }

  showResults() {
    console.log('\n=== İMPORT SONUÇLARI ===');
    console.log(`✓ Başarılı: ${this.successCount} kayıt`);
    console.log(`⚠ Uyarı: ${this.warnings.length} adet`);
    console.log(`✗ Hata: ${this.errors.length} adet`);

    if (this.warnings.length > 0) {
      console.log('\n--- UYARILAR ---');
      this.warnings.forEach(warning => console.log(`⚠ ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n--- HATALAR ---');
      this.errors.forEach(error => console.log(`✗ ${error}`));
    }

    console.log('\n=== İMPORT TAMAMLANDI ===');
  }
}

// Kullanım örneği
async function runImport() {
  try {
    // MongoDB bağlantısı
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('MongoDB bağlantısı başarılı');

    const importer = new CancelledSalesImporter();
    
    // Excel dosyasının yolunu belirtin (örnek verilerle dolu şablon)
    const excelFilePath = path.join(__dirname, '../iptal_satis_ornekli_sablon.xlsx');
    
    // Alternatif olarak boş şablon veya CSV kullanabilirsiniz:
    // const excelFilePath = path.join(__dirname, '../iptal_satis_bos_sablon.xlsx');
    // const excelFilePath = path.join(__dirname, '../iptal_satis_import_sablonu.csv');
    
    await importer.importFromExcel(excelFilePath);

  } catch (error) {
    console.error('Import işlemi başarısız:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB bağlantısı kapatıldı');
  }
}

// Eğer bu dosya doğrudan çalıştırılıyorsa import'u başlat
if (require.main === module) {
  runImport();
}

module.exports = CancelledSalesImporter;
