const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const User = require('../models/User');
const PrimTransaction = require('../models/PrimTransaction');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Multer configuration for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Sadece Excel dosyaları (.xlsx, .xls) kabul edilir'), false);
    }
  }
});

// Helper function: Excel tarihini JS tarihine çevir
function excelDateToJSDate(excelDate, fieldName = '') {
  if (!excelDate) return null;
  
  console.log(`🔍 ${fieldName} tarih dönüşümü:`, {
    value: excelDate,
    type: typeof excelDate,
    isString: typeof excelDate === 'string',
    isNumber: typeof excelDate === 'number'
  });
  
  // String'i temizle - boşlukları kaldır
  if (typeof excelDate === 'string') {
    excelDate = excelDate.trim();
  }
  
  // Eğer zaten string ise
  if (typeof excelDate === 'string') {
    // YYYY-MM-DD formatı (saleDate için)
    if (excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(excelDate);
    }
    
    // GG/AA formatı (entryDate ve exitDate için) - örn: 21/08 = 21 Ağustos
    if (excelDate.match(/^\d{1,2}\/\d{1,2}$/)) {
      const [day, month] = excelDate.split('/');
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      
      // Geçerli tarih kontrolü
      if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        console.log(`❌ ${fieldName} geçersiz tarih:`, excelDate);
        return null;
      }
      
      const currentYear = new Date().getFullYear();
      let year = currentYear;
      if (fieldName === 'exitDate') {
        year = currentYear + 1; // Çıkış tarihi 1 yıl sonra
      }
      
      const date = new Date(year, monthNum - 1, dayNum);
      console.log(`✅ ${fieldName} GG/AA formatından dönüştürüldü:`, {
        input: excelDate,
        day: dayNum,
        month: monthNum,
        year: year,
        result: date
      });
      return date;
    }
    
    // Sadece sayı formatı (21/8, 1/12 gibi) - Excel'de sıfırsız olabilir
    if (excelDate.match(/^\d{1,2}\/\d{1,2}$/)) {
      const parts = excelDate.split('/');
      if (parts.length === 2) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const currentYear = new Date().getFullYear();
        
        let year = currentYear;
        if (fieldName === 'exitDate') {
          year = currentYear + 1;
        }
        
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          const date = new Date(year, month - 1, day);
          console.log(`✅ ${fieldName} GG/AA formatından dönüştürüldü:`, date);
          return date;
        }
      }
    }
    
    // DD/MM/YYYY formatı (Excel'den gelebilir)
    if (excelDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const [day, month, year] = excelDate.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      console.log(`✅ ${fieldName} DD/MM/YYYY formatından dönüştürüldü:`, date);
      return date;
    }
    
    // MM/DD/YYYY formatı (Excel'den gelebilir)
    if (excelDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) && fieldName !== 'saleDate') {
      // entryDate ve exitDate için MM/DD formatını DD/MM olarak yorumla
      const parts = excelDate.split('/');
      if (parts.length === 3) {
        const [first, second, year] = parts;
        // Eğer ikinci kısım 12'den büyükse, first=month, second=day
        if (parseInt(second) > 12) {
          const date = new Date(parseInt(year), parseInt(first) - 1, parseInt(second));
          console.log(`✅ ${fieldName} MM/DD/YYYY formatından dönüştürüldü:`, date);
          return date;
        } else {
          // Normal DD/MM/YYYY
          const date = new Date(parseInt(year), parseInt(second) - 1, parseInt(first));
          console.log(`✅ ${fieldName} DD/MM/YYYY formatından dönüştürüldü:`, date);
          return date;
        }
      }
    }
  }
  
  // Excel serial date ise
  if (typeof excelDate === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
    console.log(`✅ ${fieldName} Excel serial'dan dönüştürüldü:`, jsDate);
    return jsDate;
  }
  
  // Date objesi ise direkt döndür
  if (excelDate instanceof Date) {
    console.log(`✅ ${fieldName} zaten Date objesi:`, excelDate);
    return excelDate;
  }
  
  // Parse etmeye çalış
  const parsed = new Date(excelDate);
  if (!isNaN(parsed)) {
    console.log(`✅ ${fieldName} parse edildi:`, parsed);
    return parsed;
  }
  
  console.log(`❌ ${fieldName} dönüştürülemedi:`, excelDate);
  return null;
}

// Helper function: Satış kaydını validate et
function validateSaleRecord(record, rowIndex) {
  const errors = [];
  const requiredFields = [
    'customerName', 'blockNo', 'apartmentNo', 'periodNo', 
    'saleType', 'saleDate', 'entryDate', 'exitDate',
    'listPrice', 'activitySalePrice', 'primStatus', 'status', 'salesperson'
  ];
  
  // Zorunlu alanları kontrol et
  requiredFields.forEach(field => {
    if (!record[field] || record[field] === '') {
      errors.push(`Satır ${rowIndex}: ${field} alanı zorunludur`);
    }
  });
  
  // Tarih validasyonu
  ['saleDate', 'entryDate', 'exitDate'].forEach(dateField => {
    if (record[dateField]) {
      const date = excelDateToJSDate(record[dateField], dateField);
      if (!date || isNaN(date)) {
        if (dateField === 'saleDate') {
          errors.push(`Satır ${rowIndex}: ${dateField} geçerli bir tarih formatında olmalıdır (örn: 2021-03-15)`);
        } else {
          errors.push(`Satır ${rowIndex}: ${dateField} geçerli bir tarih formatında olmalıdır (örn: 21/08 veya 21/8)`);
        }
      }
    }
  });
  
  // Sayısal alan validasyonu
  ['listPrice', 'activitySalePrice'].forEach(numField => {
    if (record[numField] && isNaN(parseFloat(record[numField]))) {
      errors.push(`Satır ${rowIndex}: ${numField} sayısal olmalıdır`);
    }
  });
  
  // Enum validasyonu
  const validSaleTypes = ['satis', 'kapora', 'yazlik', 'kislik'];
  if (record.saleType && !validSaleTypes.includes(record.saleType)) {
    errors.push(`Satır ${rowIndex}: saleType geçerli değil (${validSaleTypes.join(', ')})`);
  }
  
  const validPrimStatuses = ['ödendi', 'ödenmedi'];
  if (record.primStatus && !validPrimStatuses.includes(record.primStatus)) {
    errors.push(`Satır ${rowIndex}: primStatus geçerli değil (${validPrimStatuses.join(', ')})`);
  }
  
  const validStatuses = ['aktif', 'iptal'];
  if (record.status && !validStatuses.includes(record.status)) {
    errors.push(`Satır ${rowIndex}: status geçerli değil (${validStatuses.join(', ')})`);
  }
  
  return errors;
}

// Helper function: Excel verisini Sale modeline çevir
async function convertToSaleRecord(record, adminUserId) {
  // Kullanıcıyı bul (username'e göre)
  let salesperson = adminUserId; // Default admin
  if (record.salesperson && record.salesperson !== 'admin') {
    const user = await User.findOne({ username: record.salesperson });
    if (user) {
      salesperson = user._id;
    }
  }
  
  // Tarih dönüşümleri - Sale model string bekliyor!
  console.log('📅 Tarih dönüşüm debug:', {
    entryDate: record.entryDate,
    exitDate: record.exitDate,
    entryDateType: typeof record.entryDate,
    exitDateType: typeof record.exitDate
  });
  
  const saleDate = excelDateToJSDate(record.saleDate, 'saleDate');
  
  // entryDate ve exitDate'i string formatında tut (GG/AA)
  let entryDate = null;
  let exitDate = null;
  
  if (record.entryDate) {
    if (typeof record.entryDate === 'string' && record.entryDate.match(/^\d{1,2}\/\d{1,2}$/)) {
      // Zaten doğru formatta
      const [day, month] = record.entryDate.split('/');
      entryDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
    } else if (typeof record.entryDate === 'number') {
      // Excel serial number ise Date'e çevir sonra format et
      const date = excelDateToJSDate(record.entryDate, 'entryDate');
      if (date) {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        entryDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
      }
    }
  }
  
  if (record.exitDate) {
    if (typeof record.exitDate === 'string' && record.exitDate.match(/^\d{1,2}\/\d{1,2}$/)) {
      // Zaten doğru formatta
      const [day, month] = record.exitDate.split('/');
      exitDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
    } else if (typeof record.exitDate === 'number') {
      // Excel serial number ise Date'e çevir sonra format et
      const date = excelDateToJSDate(record.exitDate, 'exitDate');
      if (date) {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        exitDate = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
      }
    }
  }
  
  console.log('📅 String formatına çevrildi:', {
    entryDate,
    exitDate
  });
  
  // İndirimli fiyat hesaplama
  const listPrice = parseFloat(record.listPrice) || 0;
  const discountRate = parseFloat(record.discountRate) || 0;
  const discountedListPrice = discountRate > 0 ? 
    listPrice * (1 - discountRate / 100) : listPrice;
  const activitySalePrice = parseFloat(record.activitySalePrice) || 0;
  const basePrimPrice = Math.min(discountedListPrice, activitySalePrice);
  
  // Prim oranını ve dönemini belirle
  const primRate = 1; // %1 prim oranı
  let primPeriod = null;
  
  // Aktif prim dönemini bul
  try {
    const PrimPeriod = require('../models/PrimPeriod');
    const activePeriod = await PrimPeriod.findOne({ isActive: true });
    if (activePeriod) {
      primPeriod = activePeriod._id;
    }
  } catch (error) {
    console.error('Prim dönemi bulunamadı:', error);
  }
  
  // Prim tutarını otomatik hesapla
  let primAmount = 0;
  if (basePrimPrice > 0) {
    // Prim hesaplama mantığı - fiyat üzerinden yüzde hesaplama
    primAmount = (basePrimPrice * primRate) / 100;
  }
  
  return {
    customerName: record.customerName.toString().trim(),
    blockNo: record.blockNo.toString().trim(),
    apartmentNo: record.apartmentNo.toString().trim(),
    periodNo: record.periodNo.toString().trim(),
    saleType: record.saleType,
    contractNo: record.contractNo ? record.contractNo.toString().trim() : '',
    saleDate: saleDate,
    entryDate: entryDate,
    exitDate: exitDate,
    listPrice: listPrice,
    discountRate: discountRate,
    discountedListPrice: discountedListPrice,
    activitySalePrice: activitySalePrice,
    basePrimPrice: basePrimPrice,
    primAmount: primAmount,
    primRate: primRate,
    primPeriod: primPeriod,
    primStatus: record.primStatus || 'ödendi',
    paymentType: record.paymentType || 'Nakit',
    status: record.status,
    salesperson: salesperson,
    notes: record.notes || '',
    isImported: true,
    importedAt: new Date(),
    importedBy: adminUserId
  };
}

// @route   POST /api/sales-import/upload
// @desc    Excel dosyasından satış verilerini import et
// @access  Admin only
router.post('/upload', [auth, adminAuth, upload.single('salesFile')], async (req, res) => {
  try {
    console.log('🚀 Starting sales import...');
    
    if (!req.file) {
      return res.status(400).json({ message: 'Excel dosyası yüklenmedi' });
    }
    
    const { dryRun = 'true', overwriteExisting = 'false' } = req.body;
    const isDryRun = dryRun === 'true';
    const shouldOverwrite = overwriteExisting === 'true';
    
    // Excel dosyasını oku
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON'a çevir - tarihleri text olarak oku
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false, // Tüm değerleri string olarak al
      dateNF: 'dd/mm', // Tarih formatını belirt
      defval: '' // Boş hücreler için varsayılan değer
    });
    
    console.log(`📊 Found ${rawData.length} rows in Excel file`);
    
    if (rawData.length === 0) {
      return res.status(400).json({ message: 'Excel dosyasında veri bulunamadı' });
    }
    
    const results = {
      totalRows: rawData.length,
      validRows: 0,
      invalidRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errors: [],
      warnings: [],
      dryRun: isDryRun
    };
    
    const validRecords = [];
    
    // Her satırı validate et
    for (let i = 0; i < rawData.length; i++) {
      const record = rawData[i];
      const rowIndex = i + 2; // Excel'de 1. satır başlık, 2. satır ilk veri
      
      // Boş satırları atla
      if (!record.customerName && !record.blockNo) {
        results.skippedRows++;
        continue;
      }
      
      // Validasyon
      const validationErrors = validateSaleRecord(record, rowIndex);
      
      if (validationErrors.length > 0) {
        results.invalidRows++;
        results.errors.push(...validationErrors);
      } else {
        results.validRows++;
        validRecords.push({ ...record, rowIndex });
      }
    }
    
    console.log(`✅ Validation completed: ${results.validRows} valid, ${results.invalidRows} invalid`);
    
    // Eğer geçerli kayıt yoksa durdur
    if (validRecords.length === 0) {
      return res.json({
        success: false,
        message: 'Geçerli satış kaydı bulunamadı',
        results: results
      });
    }
    
    // Dry run değilse kayıtları veritabanına yaz
    if (!isDryRun) {
      console.log('💾 Importing records to database...');
      
      // Mevcut kayıtları kontrol et (eğer overwrite yoksa)
      if (!shouldOverwrite) {
        const existingContracts = await Sale.find({
          contractNo: { $in: validRecords.map(r => r.contractNo).filter(c => c) }
        }).select('contractNo');
        
        if (existingContracts.length > 0) {
          results.warnings.push(
            `${existingContracts.length} adet sözleşme numarası zaten mevcut. Üzerine yazmak için 'overwriteExisting' seçeneğini işaretleyin.`
          );
        }
      }
      
      // Kayıtları dönüştür ve kaydet
      for (const record of validRecords) {
        try {
          const saleRecord = await convertToSaleRecord(record, req.user.id);
          
          // Mevcut kaydı kontrol et
          let existingSale = null;
          if (record.contractNo) {
            existingSale = await Sale.findOne({ contractNo: record.contractNo });
          }
          
          if (existingSale && !shouldOverwrite) {
            results.skippedRows++;
            results.warnings.push(`Satır ${record.rowIndex}: Sözleşme ${record.contractNo} zaten mevcut, atlandı`);
          } else {
            if (existingSale && shouldOverwrite) {
              // Mevcut kaydı güncelle
              await Sale.findByIdAndUpdate(existingSale._id, saleRecord);
              results.importedRows++;
            } else {
              // Yeni kayıt oluştur
              await Sale.create(saleRecord);
              results.importedRows++;
            }
          }
          
        } catch (error) {
          results.errors.push(`Satır ${record.rowIndex}: Kayıt hatası - ${error.message}`);
          results.invalidRows++;
        }
      }
      
      console.log(`✅ Import completed: ${results.importedRows} records imported`);
    }
    
    res.json({
      success: true,
      message: isDryRun ? 
        `Simülasyon tamamlandı: ${results.validRows} geçerli kayıt bulundu` :
        `Import tamamlandı: ${results.importedRows} kayıt eklendi`,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Sales import error:', error);
    res.status(500).json({ 
      message: 'Import sırasında hata oluştu', 
      error: error.message 
    });
  }
});

// @route   DELETE /api/sales-import/rollback
// @desc    Import edilen kayıtları geri al
// @access  Admin only
router.delete('/rollback', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🔄 Rolling back imported sales...');
    
    const { hours, startDate, endDate } = req.body;
    
    let dateFilter = {};
    let filterDescription = '';
    
    if (startDate && endDate) {
      // Tarih aralığı modu
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz tarih formatı'
        });
      }
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: 'Başlangıç tarihi bitiş tarihinden küçük olmalıdır'
        });
      }
      
      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end
        }
      };
      
      filterDescription = `${start.toLocaleDateString('tr-TR')} - ${end.toLocaleDateString('tr-TR')} tarihleri arasında`;
      console.log(`📅 Looking for records between ${start.toISOString()} and ${end.toISOString()}`);
      console.log(`📅 User selected: ${startDate} - ${endDate}`);
      console.log(`📅 Converted to UTC: ${start.toISOString()} - ${end.toISOString()}`);
      
    } else {
      // Saat modu (eski sistem)
      const hoursNum = parseInt(hours || 2);
      
      if (hoursNum < 1 || hoursNum > 48) {
        return res.status(400).json({
          success: false,
          message: 'Saat değeri 1-48 arasında olmalıdır'
        });
      }
      
      dateFilter = {
        createdAt: { $gte: new Date(Date.now() - hoursNum * 60 * 60 * 1000) }
      };
      
      filterDescription = `son ${hoursNum} saatte`;
      console.log(`⏰ Looking for records from last ${hoursNum} hours`);
    }
    
    // Önce tüm satışları kontrol et
    const allSales = await Sale.find({});
    console.log(`📊 Total sales in database: ${allSales.length}`);
    
    // Import edilen kayıtları bul (birden fazla kritere göre)
    const importedSales = await Sale.find({
      $or: [
        { isImported: true },
        { importedBy: { $exists: true } },
        { importedAt: { $exists: true } }
      ]
    });
    
    console.log(`📊 Found ${importedSales.length} imported sales to delete`);
    
    // Tarih filtresi ile kayıtları bul
    const filteredSales = await Sale.find(dateFilter).sort({ createdAt: -1 });
    
    console.log(`📊 Filtered sales (${filterDescription}): ${filteredSales.length}`);
    console.log(`🔍 Date filter used:`, JSON.stringify(dateFilter, null, 2));
    
    // Son birkaç kayıdın tarihlerini göster
    const recentSamples = await Sale.find({}).sort({ createdAt: -1 }).limit(5);
    console.log(`📋 Recent 5 sales timestamps:`);
    recentSamples.forEach((sale, idx) => {
      console.log(`  ${idx + 1}. ${sale.createdAt.toISOString()} (${sale.customerName})`);
    });
    
    if (importedSales.length === 0 && filteredSales.length > 0) {
      // Import flag'i olmayan ama filtreye uyan kayıtları da dahil et
      console.log('⚠️ No isImported flag found, using filtered sales as fallback');
      
      const saleIds = filteredSales.map(sale => sale._id);
      const deletedTransactions = await PrimTransaction.deleteMany({ 
        sale: { $in: saleIds } 
      });
      
      const deletedSales = await Sale.deleteMany({ 
        _id: { $in: saleIds }
      });
      
      return res.json({
        success: true,
        message: `${deletedSales.deletedCount} adet ${filterDescription} eklenen kayıt ve ${deletedTransactions.deletedCount} adet prim transaction'ı başarıyla silindi`,
        deletedCount: deletedSales.deletedCount,
        deletedTransactions: deletedTransactions.deletedCount
      });
    }
    
    if (importedSales.length === 0) {
      return res.json({
        success: true,
        message: 'Silinecek import kaydı bulunamadı',
        deletedCount: 0
      });
    }
    
    // İlişkili prim transaction'larını sil
    const saleIds = importedSales.map(sale => sale._id);
    const deletedTransactions = await PrimTransaction.deleteMany({ 
      sale: { $in: saleIds } 
    });
    
    // Import edilen satışları sil
    const deletedSales = await Sale.deleteMany({ 
      $or: [
        { isImported: true },
        { importedBy: { $exists: true } },
        { importedAt: { $exists: true } }
      ]
    });
    
    console.log(`✅ Rollback completed: ${deletedSales.deletedCount} sales deleted, ${deletedTransactions.deletedCount} transactions deleted`);
    
    res.json({
      success: true,
      message: `${deletedSales.deletedCount} adet import kaydı ve ${deletedTransactions.deletedCount} adet prim transaction'ı başarıyla silindi`,
      deletedCount: deletedSales.deletedCount,
      deletedTransactions: deletedTransactions.deletedCount
    });
    
  } catch (error) {
    console.error('❌ Rollback error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Import geri alma sırasında hata oluştu: ' + error.message 
    });
  }
});

// @route   GET /api/sales-import/template
// @desc    Excel şablon dosyasını indir
// @access  Admin only
router.get('/template', [auth, adminAuth], (req, res) => {
  try {
    // Şablon verisi
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
      }
    ];
    
    // Excel oluştur
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Satışlar');
    
    // Buffer'a çevir
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Response headers
    res.setHeader('Content-Disposition', 'attachment; filename=satis_import_sablonu.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(buffer);
    
  } catch (error) {
    console.error('Template creation error:', error);
    res.status(500).json({ message: 'Şablon oluşturulurken hata oluştu' });
  }
});

module.exports = router;
