const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const Sale = require('../models/Sale');
const User = require('../models/User');
const PrimPeriod = require('../models/PrimPeriod');

class OptimizedCancelledSalesImporter {
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
    const salesperson = this.findUserByEmail(rowData['Temsilci Email']);
    const cancelledBy = this.findUserByEmail(rowData['İptal Eden Email']);

    if (!salesperson) {
      throw new Error(`Satış danışmanı bulunamadı: ${rowData['Temsilci Email']}`);
    }

    if (!cancelledBy) {
      throw new Error(`İptal eden kullanıcı bulunamadı: ${rowData['İptal Eden Email']}`);
    }

    // Prim dönemini bul
    const saleDate = this.parseDate(rowData['Satış Tarihi']);
    let primPeriod = this.findPrimPeriodByDate(saleDate);
    if (!primPeriod) {
      this.warnings.push(`Satır ${rowNumber}: Prim dönemi bulunamadı, varsayılan dönem kullanılacak`);
    }

    // Sale kaydını oluştur
    const saleData = {
      // Müşteri bilgileri
      customerName: rowData['Müşteri Adı'],
      phone: null, // İptal import'unda telefon yok
      blockNo: rowData['Blok'],
      apartmentNo: rowData['Daire'],
      periodNo: rowData['Dönem'],

      // Satış bilgileri - İptal import'unda hep 'satis' türü
      saleType: 'satis',
      saleDate: saleDate,
      kaporaDate: null,
      contractNo: rowData['Sözleşme No'] || null, // BOŞ BIRAKILABİLİR
      
      // Fiyat bilgileri
      listPrice: parseFloat(rowData['Liste Fiyatı']) || 0,
      discountRate: 0, // İndirim oranı hesaplanacak
      activitySalePrice: parseFloat(rowData['Aktivite Fiyatı']) || 0,
      paymentType: 'Nakit', // Varsayılan

      // Prim bilgileri
      primRate: null, // Prim tutarından hesaplanacak
      primAmount: parseFloat(rowData['Prim Tutarı']) || 0,

      // İlişkiler
      salesperson: salesperson._id,
      primPeriod: primPeriod ? primPeriod._id : null,

      // Durum bilgileri - İPTAL EDİLMİŞ OLARAK AYARLA
      status: 'iptal',
      cancelledAt: this.parseDate(rowData['İptal Tarihi']),
      cancelledBy: cancelledBy._id,

      // Notlar
      notes: 'Geçmiş iptal kaydı - Import edildi',

      // Import tracking
      isImported: true,
      originalSalesperson: salesperson._id,

      // Tarihler
      createdAt: saleDate,
      updatedAt: this.parseDate(rowData['İptal Tarihi'])
    };

    // İndirim oranını hesapla (Liste fiyatı > Aktivite fiyatı ise)
    if (saleData.listPrice > 0 && saleData.activitySalePrice > 0 && saleData.listPrice > saleData.activitySalePrice) {
      saleData.discountRate = ((saleData.listPrice - saleData.activitySalePrice) / saleData.listPrice) * 100;
      saleData.discountedListPrice = saleData.activitySalePrice;
      saleData.originalListPrice = saleData.listPrice;
    }

    // Prim oranını hesapla (Prim tutarı > 0 ise)
    if (saleData.primAmount > 0 && saleData.activitySalePrice > 0) {
      saleData.primRate = (saleData.primAmount / saleData.activitySalePrice) * 100;
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
      'Satış Tarihi',
      'Temsilci Email',
      'İptal Tarihi',
      'İptal Eden Email'
    ];

    requiredFields.forEach(field => {
      if (!rowData[field] || rowData[field].toString().trim() === '') {
        errors.push(`${field} boş olamaz`);
      }
    });

    // Sözleşme No zorunlu değil - boş bırakılabilir
    // Liste Fiyatı ve Aktivite Fiyatı zorunlu değil - 0 olabilir

    // Tarih formatlarını kontrol et
    if (rowData['Satış Tarihi'] && !this.isValidDate(rowData['Satış Tarihi'])) {
      errors.push('Geçersiz Satış Tarihi formatı (YYYY-MM-DD bekleniyor)');
    }

    if (rowData['İptal Tarihi'] && !this.isValidDate(rowData['İptal Tarihi'])) {
      errors.push('Geçersiz İptal Tarihi formatı (YYYY-MM-DD bekleniyor)');
    }

    // Sayısal değerleri kontrol et (opsiyonel alanlar için)
    if (rowData['Liste Fiyatı'] && rowData['Liste Fiyatı'] !== '' && isNaN(parseFloat(rowData['Liste Fiyatı']))) {
      errors.push('Liste Fiyatı sayısal değer olmalıdır');
    }

    if (rowData['Aktivite Fiyatı'] && rowData['Aktivite Fiyatı'] !== '' && isNaN(parseFloat(rowData['Aktivite Fiyatı']))) {
      errors.push('Aktivite Fiyatı sayısal değer olmalıdır');
    }

    if (rowData['Prim Tutarı'] && rowData['Prim Tutarı'] !== '' && isNaN(parseFloat(rowData['Prim Tutarı']))) {
      errors.push('Prim Tutarı sayısal değer olmalıdır');
    }

    // Email formatı kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (rowData['Temsilci Email'] && !emailRegex.test(rowData['Temsilci Email'])) {
      errors.push('Geçersiz Temsilci Email formatı');
    }

    if (rowData['İptal Eden Email'] && !emailRegex.test(rowData['İptal Eden Email'])) {
      errors.push('Geçersiz İptal Eden Email formatı');
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

    const importer = new OptimizedCancelledSalesImporter();
    
    // Excel dosyasının yolunu belirtin
    const excelFilePath = path.join(__dirname, '../iptal_import_optimize.xlsx');
    
    // Alternatif dosyalar:
    // const excelFilePath = path.join(__dirname, '../iptal_import_optimize_bos.xlsx');
    // const excelFilePath = path.join(__dirname, '../iptal_import_optimize.csv');
    
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

module.exports = OptimizedCancelledSalesImporter;
