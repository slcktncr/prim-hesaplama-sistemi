const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const User = require('../models/User');
const PrimPeriod = require('../models/PrimPeriod');
const fs = require('fs');
const path = require('path');
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

// Helper function: Kayıtları yedekle
async function backupCancelledSales(salesData, backupType = 'cancelled_import') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../backups');
    
    // Backup klasörü yoksa oluştur
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = `${backupType}_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    
    const backupData = {
      timestamp: new Date().toISOString(),
      type: backupType,
      count: salesData.length,
      data: salesData
    };
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
    console.log(`💾 İptal import backup created: ${filename} (${salesData.length} records)`);
    
    return filename;
  } catch (error) {
    console.error('❌ Backup error:', error);
    return null;
  }
}

// Helper function: Excel tarihini JS tarihine çevir
function excelDateToJSDate(excelDate, fieldName = '') {
  if (!excelDate) return null;
  
  // Eğer zaten Date objesi ise
  if (excelDate instanceof Date) {
    return excelDate;
  }
  
  // Eğer string ise
  if (typeof excelDate === 'string') {
    const date = new Date(excelDate);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Eğer Excel serial number ise
  if (typeof excelDate === 'number') {
    // Excel'de 1900-01-01 = 1, JavaScript'te 1970-01-01 = 0
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

// İptal kaydını oluştur
async function convertToCancelledSaleRecord(record, adminUserId) {
  const errors = [];
  
  // Zorunlu alanları kontrol et
  if (!record['customerName']) errors.push('customerName boş olamaz');
  if (!record['blockNo']) errors.push('blockNo boş olamaz');
  if (!record['apartmentNo']) errors.push('apartmentNo boş olamaz');
  if (!record['periodNo']) errors.push('periodNo boş olamaz');
  if (!record['saleDate']) errors.push('saleDate boş olamaz');
  if (!record['salesperson']) errors.push('salesperson boş olamaz');
  if (!record['cancelledAt']) errors.push('cancelledAt boş olamaz');
  if (!record['cancelledBy']) errors.push('cancelledBy boş olamaz');

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  // Kullanıcıları bul (ad soyad ile)
  const salesperson = await User.findOne({ 
    $or: [
      { name: record['salesperson'] },
      { name: { $regex: new RegExp(record['salesperson'], 'i') } }
    ]
  });
  if (!salesperson) {
    throw new Error(`Satış danışmanı bulunamadı: ${record['salesperson']}`);
  }

  const cancelledBy = await User.findOne({ 
    $or: [
      { name: record['cancelledBy'] },
      { name: { $regex: new RegExp(record['cancelledBy'], 'i') } }
    ]
  });
  if (!cancelledBy) {
    throw new Error(`İptal eden kullanıcı bulunamadı: ${record['cancelledBy']}`);
  }

  // Tarihleri çevir
  const saleDate = excelDateToJSDate(record['saleDate']);
  const cancelledAt = excelDateToJSDate(record['cancelledAt']);

  if (!saleDate) {
    throw new Error('Geçersiz Satış Tarihi');
  }
  if (!cancelledAt) {
    throw new Error('Geçersiz İptal Tarihi');
  }

  // Prim dönemini bul
  let primPeriod = null;
  const primPeriods = await PrimPeriod.find({
    startDate: { $lte: saleDate },
    endDate: { $gte: saleDate }
  });
  if (primPeriods.length > 0) {
    primPeriod = primPeriods[0]._id;
  }

  // Fiyat bilgilerini işle
  const listPrice = parseFloat(record['listPrice']) || 0;
  const activityPrice = parseFloat(record['activitySalePrice']) || 0;
  const primAmount = parseFloat(record['primAmount']) || 0;

  // İndirim oranını hesapla
  let discountRate = 0;
  let discountedListPrice = listPrice;
  let originalListPrice = listPrice;

  if (listPrice > 0 && activityPrice > 0 && listPrice > activityPrice) {
    discountRate = ((listPrice - activityPrice) / listPrice) * 100;
    discountedListPrice = activityPrice;
  }

  // Prim oranını hesapla
  let primRate = null;
  if (primAmount > 0 && activityPrice > 0) {
    primRate = (primAmount / activityPrice) * 100;
  }

  const saleRecord = {
    // Müşteri bilgileri
    customerName: record['customerName'],
    phone: null,
    blockNo: record['blockNo'],
    apartmentNo: record['apartmentNo'],
    periodNo: record['periodNo'],

    // Satış bilgileri
    saleType: 'satis', // İptal import'unda hep satis
    saleDate: saleDate,
    kaporaDate: null,
    contractNo: record['contractNo'] || null,
    
    // Fiyat bilgileri
    listPrice: listPrice,
    discountRate: discountRate,
    discountedListPrice: discountedListPrice,
    originalListPrice: originalListPrice,
    activitySalePrice: activityPrice,
    paymentType: 'Nakit', // Varsayılan
    
    // Prim bilgileri
    primRate: primRate,
    primAmount: primAmount,
    basePrimPrice: Math.min(discountedListPrice || listPrice, activityPrice || listPrice),

    // İlişkiler
    salesperson: salesperson._id,
    primPeriod: primPeriod,

    // Durum bilgileri - İPTAL EDİLMİŞ
    status: 'iptal',
    primStatus: 'ödenmedi',
    cancelledAt: cancelledAt,
    cancelledBy: cancelledBy._id,

    // Notlar
    notes: 'Geçmiş iptal kaydı - Web import',

    // Import tracking
    isImported: true,
    originalSalesperson: salesperson._id,

    // Tarihler
    createdAt: saleDate,
    updatedAt: cancelledAt
  };

  return saleRecord;
}

// @route   POST /api/cancelled-sales-import/upload
// @desc    Excel dosyasından iptal edilen satış verilerini import et
// @access  Admin only
router.post('/upload', [auth, adminAuth, upload.single('cancelledSalesFile')], async (req, res) => {
  try {
    console.log('🚀 Starting cancelled sales import...');
    
    if (!req.file) {
      return res.status(400).json({ message: 'Excel dosyası yüklenmedi' });
    }
    
    const { dryRun = 'true' } = req.body;
    const isDryRun = dryRun === 'true';
    
    // Excel dosyasını oku
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON'a çevir
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: true,
      defval: ''
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
      const rowNumber = i + 1;
      const record = rawData[i];
      
      try {
        // Boş satırları atla
        if (!record['Müşteri Adı'] && !record['Blok'] && !record['Daire']) {
          results.skippedRows++;
          continue;
        }
        
        const saleRecord = await convertToCancelledSaleRecord(record, req.user._id);
        validRecords.push(saleRecord);
        results.validRows++;
        
      } catch (error) {
        results.invalidRows++;
        results.errors.push({
          row: rowNumber,
          error: error.message,
          data: record
        });
      }
    }
    
    console.log(`✅ Validation complete: ${results.validRows} valid, ${results.invalidRows} invalid`);
    
    // Eğer dry run değilse, verileri kaydet
    if (!isDryRun && validRecords.length > 0) {
      try {
        // Backup oluştur
        const backupFilename = await backupCancelledSales(validRecords);
        
        // Kayıtları veritabanına ekle
        const insertedRecords = await Sale.insertMany(validRecords, { ordered: false });
        results.importedRows = insertedRecords.length;
        
        console.log(`💾 Imported ${results.importedRows} cancelled sales records`);
        
        if (backupFilename) {
          results.backupFile = backupFilename;
        }
        
      } catch (error) {
        console.error('❌ Database insert error:', error);
        
        // Duplicate key hatalarını yakala
        if (error.code === 11000) {
          results.errors.push({
            row: 'Database',
            error: 'Bazı kayıtlar zaten mevcut (duplicate key error)',
            data: null
          });
        } else {
          throw error;
        }
      }
    }
    
    const success = results.errors.length === 0 || (results.validRows > 0 && results.errors.length < results.totalRows);
    
    res.json({
      success,
      message: isDryRun ? 
        `Analiz tamamlandı: ${results.validRows} geçerli, ${results.invalidRows} hatalı kayıt` :
        `Import tamamlandı: ${results.importedRows} kayıt eklendi`,
      results
    });
    
  } catch (error) {
    console.error('❌ Cancelled sales import error:', error);
    res.status(500).json({ 
      message: 'Import sırasında hata oluştu', 
      error: error.message 
    });
  }
});

// @route   GET /api/cancelled-sales-import/template
// @desc    İptal import şablonunu indir
// @access  Admin only
router.get('/template', [auth, adminAuth], async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../iptal_import_optimize_bos.xlsx');
    
    if (fs.existsSync(templatePath)) {
      res.download(templatePath, 'iptal_import_sablonu.xlsx');
    } else {
      // Şablon yoksa oluştur
      const XLSX = require('xlsx');
      
      const templateData = [{
        'customerName': '',
        'blockNo': '',
        'apartmentNo': '',
        'periodNo': '',
        'contractNo': '',
        'saleDate': '',
        'listPrice': '',
        'activitySalePrice': '',
        'primAmount': '',
        'salesperson': '', // Ad Soyad
        'cancelledAt': '', // YYYY-MM-DD
        'cancelledBy': '' // Ad Soyad
      }];
      
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'İptal Satışları');
      
      // Geçici dosya oluştur
      const tempPath = path.join(__dirname, '../temp_iptal_template.xlsx');
      XLSX.writeFile(wb, tempPath);
      
      res.download(tempPath, 'iptal_import_sablonu.xlsx', (err) => {
        if (!err) {
          // Geçici dosyayı sil
          fs.unlinkSync(tempPath);
        }
      });
    }
    
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ message: 'Şablon indirilemedi' });
  }
});

module.exports = router;
