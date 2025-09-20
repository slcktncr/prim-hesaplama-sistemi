const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const Sale = require('../models/Sale');
const User = require('../models/User');
const PrimPeriod = require('../models/PrimPeriod');

class MinimalCancelledSalesImporter {
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
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
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
    const users = await User.find({}, 'email _id name firstName lastName');
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
    const salesperson = this.findUserByEmail(rowData['Satış Danışmanı']);
    const cancelledBy = this.findUserByEmail(rowData['İptal Eden']);

    if (!salesperson) {
      throw new Error(`Satış danışmanı bulunamadı: ${rowData['Satış Danışmanı']}`);
    }

    if (!cancelledBy) {
      throw new Error(`İptal eden kullanıcı bulunamadı: ${rowData['İptal Eden']}`);
    }

    // Prim dönemini bul (sadece kapora değilse)
    let primPeriod = null;
    if (rowData['Satış Türü'] !== 'kapora') {
      primPeriod = this.findPrimPeriodByDate(this.parseDate(rowData['Satış Tarihi']));
      if (!primPeriod) {
        this.warnings.push(`Satır ${rowNumber}: Prim dönemi bulunamadı, varsayılan dönem kullanılacak`);
      }
    }

    // Satış türüne göre tarih belirleme
    const isKapora = rowData['Satış Türü'] === 'kapora';
    const saleDate = this.parseDate(rowData['Satış Tarihi']);

    // Sale kaydını oluştur
    const saleData = {
      // Müşteri bilgileri
      customerName: rowData['Müşteri Adı'],
      phone: rowData['Telefon'] || null,
      blockNo: rowData['Blok'],
      apartmentNo: rowData['Daire'],
      periodNo: rowData['Dönem'],

      // Satış bilgileri
      saleType: rowData['Satış Türü'],
      saleDate: isKapora ? null : saleDate,
      kaporaDate: isKapora ? saleDate : null,
      contractNo: rowData['Sözleşme No'] || null,
      
      // Fiyat bilgileri (sadece kapora değilse)
      listPrice: !isKapora && rowData['Liste Fiyatı'] ? parseFloat(rowData['Liste Fiyatı']) : null,
      discountRate: rowData['İndirim %'] ? parseFloat(rowData['İndirim %']) : 0,
      activitySalePrice: !isKapora && rowData['Satış Fiyatı'] ? parseFloat(rowData['Satış Fiyatı']) : null,
      paymentType: !isKapora ? (rowData['Ödeme Şekli'] || null) : null,

      // Prim bilgileri
      primRate: rowData['Prim %'] ? parseFloat(rowData['Prim %']) : null,

      // İlişkiler
      salesperson: salesperson._id,
      primPeriod: primPeriod ? primPeriod._id : null,

      // Durum bilgileri - İPTAL EDİLMİŞ OLARAK AYARLA
      status: 'iptal',
      cancelledAt: this.parseDate(rowData['İptal Tarihi']),
      cancelledBy: cancelledBy._id,

      // Notlar
      notes: rowData['İptal Sebebi'] || null,

      // Import tracking
      isImported: true,
      originalSalesperson: salesperson._id,

      // Tarihler
      createdAt: saleDate,
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
    console.log(`✓ Satır ${rowNumber}: ${rowData['Müşteri Adı']} - İptal kaydı oluşturuldu`);
  }

  validateRowData(rowData, rowNumber) {
    const errors = [];

    // Zorunlu alanları kontrol et
    const requiredFields = [
      'Müşteri Adı',
      'Blok', 
      'Daire',
      'Dönem',
      'Satış Türü',
      'Satış Tarihi',
      'Satış Danışmanı',
      'İptal Tarihi',
      'İptal Eden'
    ];

    requiredFields.forEach(field => {
      if (!rowData[field] || rowData[field].toString().trim() === '') {
        errors.push(`${field} boş olamaz`);
      }
    });

    // Satış türüne göre zorunlu alanları kontrol et
    if (rowData['Satış Türü'] !== 'kapora') {
      const requiredForSale = ['Liste Fiyatı', 'Satış Fiyatı'];
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

    if (rowData['İptal Tarihi'] && !this.isValidDate(rowData['İptal Tarihi'])) {
      errors.push('Geçersiz İptal Tarihi formatı (YYYY-MM-DD bekleniyor)');
    }

    // Sayısal değerleri kontrol et
    if (rowData['Liste Fiyatı'] && rowData['Liste Fiyatı'] !== '' && isNaN(parseFloat(rowData['Liste Fiyatı']))) {
      errors.push('Liste Fiyatı sayısal değer olmalıdır');
    }

    if (rowData['Satış Fiyatı'] && rowData['Satış Fiyatı'] !== '' && isNaN(parseFloat(rowData['Satış Fiyatı']))) {
      errors.push('Satış Fiyatı sayısal değer olmalıdır');
    }

    if (rowData['İndirim %'] && rowData['İndirim %'] !== '' && (isNaN(parseFloat(rowData['İndirim %'])) || parseFloat(rowData['İndirim %']) < 0 || parseFloat(rowData['İndirim %']) > 100)) {
      errors.push('İndirim % 0-100 arasında sayısal değer olmalıdır');
    }

    if (rowData['Prim %'] && rowData['Prim %'] !== '' && (isNaN(parseFloat(rowData['Prim %'])) || parseFloat(rowData['Prim %']) < 0 || parseFloat(rowData['Prim %']) > 100)) {
      errors.push('Prim % 0-100 arasında sayısal değer olmalıdır');
    }

    // Email formatı kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (rowData['Satış Danışmanı'] && !emailRegex.test(rowData['Satış Danışmanı'])) {
      errors.push('Geçersiz Satış Danışmanı email formatı');
    }

    if (rowData['İptal Eden'] && !emailRegex.test(rowData['İptal Eden'])) {
      errors.push('Geçersiz İptal Eden email formatı');
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

    const importer = new MinimalCancelledSalesImporter();
    
    // Excel dosyasının yolunu belirtin
    const excelFilePath = path.join(__dirname, '../iptal_import_ornekli.xlsx');
    
    // Alternatif dosyalar:
    // const excelFilePath = path.join(__dirname, '../iptal_import_bos.xlsx');
    // const excelFilePath = path.join(__dirname, '../iptal_import_ornekli.csv');
    
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

module.exports = MinimalCancelledSalesImporter;
