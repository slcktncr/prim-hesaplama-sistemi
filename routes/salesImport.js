const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const User = require('../models/User');
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
  
  // Eğer zaten string ise ve YYYY-MM-DD formatındaysa (saleDate için)
  if (typeof excelDate === 'string') {
    if (excelDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(excelDate);
    }
    
    // GG/AA formatı (entryDate ve exitDate için) - örn: 01/05 = 1 Mayıs
    if (excelDate.match(/^\d{1,2}\/\d{1,2}$/)) {
      const [day, month] = excelDate.split('/');
      const currentYear = new Date().getFullYear();
      
      // Giriş tarihi için: eğer satış tarihinden küçükse bir sonraki yıl
      // Çıkış tarihi için: giriş tarihinden 1 yıl sonra
      let year = currentYear;
      
      if (fieldName === 'exitDate') {
        // Çıkış tarihi genelde giriş tarihinden 1 yıl sonra
        year = currentYear + 1;
      }
      
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      return date;
    }
  }
  
  // Excel serial date ise
  if (typeof excelDate === 'number') {
    // Excel'in epoch'u 1900-01-01, JavaScript'in epoch'u 1970-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
    return jsDate;
  }
  
  // Date objesi ise direkt döndür
  if (excelDate instanceof Date) {
    return excelDate;
  }
  
  // Parse etmeye çalış
  const parsed = new Date(excelDate);
  return isNaN(parsed) ? null : parsed;
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
          errors.push(`Satır ${rowIndex}: ${dateField} YYYY-MM-DD formatında olmalıdır (örn: 2021-03-15)`);
        } else {
          errors.push(`Satır ${rowIndex}: ${dateField} GG/AA formatında olmalıdır (örn: 01/05 = 1 Mayıs)`);
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
  
  // Tarih dönüşümleri
  console.log('📅 Tarih dönüşüm debug:', {
    entryDate: record.entryDate,
    exitDate: record.exitDate,
    entryDateType: typeof record.entryDate,
    exitDateType: typeof record.exitDate
  });
  
  const saleDate = excelDateToJSDate(record.saleDate, 'saleDate');
  const entryDate = excelDateToJSDate(record.entryDate, 'entryDate');
  const exitDate = excelDateToJSDate(record.exitDate, 'exitDate');
  
  console.log('📅 Dönüştürülen tarihler:', {
    entryDate,
    exitDate,
    entryDateValid: entryDate && !isNaN(entryDate),
    exitDateValid: exitDate && !isNaN(exitDate)
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
    
    // JSON'a çevir
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false, // Tarihleri string olarak al
      dateNF: 'yyyy-mm-dd' // Tarih formatı
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
