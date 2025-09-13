const express = require('express');
const { body, validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const PrimRate = require('../models/PrimRate');
const PrimPeriod = require('../models/PrimPeriod');
const PrimTransaction = require('../models/PrimTransaction');
const PaymentMethod = require('../models/PaymentMethod');
const SaleType = require('../models/SaleType');
const { auth, adminAuth } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// Ödeme tipi validasyonu - PaymentMethods tablosundan dinamik kontrol
// Satış türünün kapora türü olup olmadığını kontrol et
const isKaporaType = (saleTypeValue) => {
  return saleTypeValue === 'kapora';
};

// Satış tipi validasyonu - SaleTypes tablosundan dinamik kontrol
const validateSaleType = async (value) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 SaleType validation - Value:', value, 'Type:', typeof value);
  }
  
  if (!value || value === '') {
    return Promise.reject('Satış tipi gereklidir');
  }
  
  // String kontrolü
  if (typeof value !== 'string') {
    return Promise.reject('Satış tipi string olmalıdır');
  }
  
  try {
    // SaleTypes tablosundan aktif satış türlerini al
    const activeSaleTypes = await SaleType.find({ isActive: true }).select('name');
    
    const validSaleTypeValues = activeSaleTypes.map(type => {
      const lowerName = type.name.toLowerCase();
      if (lowerName.includes('kapora')) return 'kapora';
      // ÖNCE özel türleri kontrol et (daha spesifik olanlar)
      if (lowerName.includes('manuel')) return 'manuel';
      // Sonra genel satış türleri (daha genel olanlar)
      if (lowerName.includes('normal') || lowerName.includes('satış')) return 'satis';
      return lowerName.replace(/\s+/g, '').replace(/[^\w]/g, '').substring(0, 20);
    });
    
    // Eski sistem değerleri de ekle
    validSaleTypeValues.push('satis', 'kapora');
    
    // Eğer SaleType tablosu boşsa, varsayılan değerleri kabul et
    if (activeSaleTypes.length === 0) {
      const defaultTypes = ['satis', 'kapora'];
      if (!defaultTypes.includes(value)) {
        return Promise.reject(`Geçersiz satış tipi. Geçerli değerler: ${defaultTypes.join(', ')}`);
      }
    } else {
      // Aktif satış türleri arasında kontrol et (unique yap)
      const uniqueValues = [...new Set(validSaleTypeValues)];
      
      if (!uniqueValues.includes(value)) {
        return Promise.reject(`Geçersiz satış tipi: "${value}". Geçerli satış türleri: ${uniqueValues.join(', ')}`);
      }
    }
    
    return Promise.resolve(true);
  } catch (error) {
    console.error('❌ Sale type validation error:', error);
    // Hata durumunda eski sistem değerlerini kabul et
    if (['satis', 'kapora'].includes(value)) {
      return Promise.resolve(true);
    }
    return Promise.reject('Satış tipi doğrulanamadı');
  }
};

const validatePaymentType = async (value) => {
  if (!value || value === '') return Promise.resolve(true); // Optional field
  
  // String kontrolü
  if (typeof value !== 'string') {
    return Promise.reject('Ödeme tipi string olmalıdır');
  }
  
  try {
    // PaymentMethods tablosundan aktif ödeme yöntemlerini al
    const activePaymentMethods = await PaymentMethod.find({ isActive: true }).select('name');
    const validPaymentTypes = activePaymentMethods.map(method => method.name);
    
    // Eğer PaymentMethod tablosu boşsa, varsayılan değerleri kabul et
    if (validPaymentTypes.length === 0) {
      const defaultTypes = ['Nakit', 'Kredi', 'Kredi Kartı', 'Taksit', 'Çek', 'Havale', 'EFT', 'Diğer'];
      if (!defaultTypes.includes(value)) {
        return Promise.reject(`Geçersiz ödeme tipi. Geçerli değerler: ${defaultTypes.join(', ')}`);
      }
    } else {
      // Aktif ödeme yöntemleri arasında kontrol et
      if (!validPaymentTypes.includes(value)) {
        return Promise.reject(`Geçersiz ödeme tipi: "${value}". Aktif ödeme yöntemleri: ${validPaymentTypes.join(', ')}`);
      }
    }
    
    return Promise.resolve(true);
  } catch (error) {
    console.error('❌ Payment type validation error:', error);
    // Hata durumunda geçir, model validation'a bırak
    return Promise.resolve(true);
  }
};

// Satış dönemini otomatik belirle
const getOrCreatePrimPeriod = async (saleDate, createdBy) => {
  const date = new Date(saleDate);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  
  const periodName = `${monthNames[month - 1]} ${year}`;
  
  let period = await PrimPeriod.findOne({ name: periodName });
  
  if (!period) {
    period = new PrimPeriod({
      name: periodName,
      month,
      year,
      createdBy
    });
    await period.save();
  }
  
  return period._id;
};

// Export the function for use in other modules
module.exports.getOrCreatePrimPeriod = getOrCreatePrimPeriod;

// @route   POST /api/sales
// @desc    Yeni satış ekle
// @access  Private
router.post('/', auth, [
  body('customerName').trim().notEmpty().withMessage('Müşteri adı soyadı gereklidir'),
  body('phone').optional().custom((value) => {
    if (value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
      throw new Error('Geçerli bir telefon numarası giriniz');
    }
    return true;
  }),
  body('blockNo').trim().notEmpty().withMessage('Blok no gereklidir'),
  body('apartmentNo').trim().notEmpty().withMessage('Daire no gereklidir'),
  body('periodNo').trim().notEmpty().withMessage('Dönem no gereklidir'),
  body('contractNo').custom(async (value, { req }) => {
    if (!value || value.trim() === '') {
      // Sözleşme no'nun gerekli olup olmadığını SaleType'dan kontrol et
      const saleTypeValue = req.body.saleType;
      if (saleTypeValue) {
        const activeSaleTypes = await SaleType.find({ isActive: true });
        const matchingSaleType = activeSaleTypes.find(type => {
          const lowerName = type.name.toLowerCase();
          if (lowerName.includes('kapora')) return saleTypeValue === 'kapora';
          if (lowerName.includes('manuel')) return saleTypeValue === 'manuel';
          if (lowerName.includes('normal') || lowerName.includes('satış')) return saleTypeValue === 'satis';
          return saleTypeValue === lowerName.replace(/\s+/g, '').replace(/[^\w]/g, '').substring(0, 20);
        });
        
        // Eğer bu satış türü için contractNo gerekli değilse, boş olabilir
        if (matchingSaleType && !matchingSaleType.requiredFields?.contractNo) {
          return true;
        }
      }
      throw new Error('Sözleşme no gereklidir');
    }
    
    // Değer varsa uzunluk kontrolü yap
    if (value.length < 1 || value.length > 10) {
      throw new Error('Sözleşme no 1-10 karakter arasında olmalıdır');
    }
    return true;
  }),
  body('saleType').custom(validateSaleType),
  // Koşullu validasyonlar
  body('saleDate').custom((value, { req }) => {
    if (isKaporaType(req.body.saleType)) return true; // Kapora için tarih gerekli değil
    if (!value) throw new Error('Satış tarihi gereklidir');
    if (!value.match(/^\d{4}-\d{2}-\d{2}$/)) throw new Error('Geçerli bir satış tarihi giriniz (YYYY-MM-DD)');
    return true;
  }),
  body('kaporaDate').if(body('saleType').equals('kapora')).isISO8601().withMessage('Geçerli bir kapora tarihi giriniz'),
  body('listPrice').custom((value, { req }) => {
    if (isKaporaType(req.body.saleType)) return true; // Kapora için fiyat gerekli değil
    if (!value || parseFloat(value) <= 0) throw new Error('Liste fiyatı 0\'dan büyük olmalıdır');
    return true;
  }),
  body('activitySalePrice').custom((value, { req }) => {
    if (isKaporaType(req.body.saleType)) return true; // Kapora için fiyat gerekli değil
    if (!value || parseFloat(value) <= 0) throw new Error('Aktivite satış fiyatı 0\'dan büyük olmalıdır');
    return true;
  }),
  body('paymentType').custom((value, { req }) => {
    if (isKaporaType(req.body.saleType)) return true; // Kapora için ödeme tipi gerekli değil
    return validatePaymentType(value);
  })
], async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Sale POST request received');
      console.log('User:', req.user?.email);
      console.log('SaleType:', req.body.saleType);
    }
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', JSON.stringify(errors.array(), null, 2));
      const errorMessages = errors.array().map(err => `${err.param}: ${err.msg}`).join(', ');
      return res.status(400).json({ 
        message: `Validasyon hatası: ${errorMessages}`,
        errors: errors.array(),
        details: errorMessages
      });
    }

    const {
      customerName, phone, blockNo, apartmentNo, periodNo, saleDate, kaporaDate,
      contractNo, listPrice, activitySalePrice, paymentType, saleType,
      entryDate, exitDate, notes, discountRate, originalListPrice, discountedListPrice
    } = req.body;

    // Sözleşme no kontrolü (sadece contractNo varsa)
    if (contractNo && contractNo.trim()) {
      const existingSale = await Sale.findOne({ contractNo });
      if (existingSale) {
        return res.status(400).json({ message: 'Bu sözleşme numarası ile kayıtlı satış bulunmaktadır' });
      }
    }

    let currentPrimRate, primPeriodId, listPriceNum, activitySalePriceNum, basePrimPrice, primAmount;
    
    // Değişkenleri global scope'da tanımla
    const originalListPriceNum = parseFloat(originalListPrice || listPrice) || 0;
    const discountRateNum = parseFloat(discountRate) || 0;
    let discountedListPriceNum = 0;

    // Kapora değilse prim hesapla
    if (!isKaporaType(saleType)) {
    
    // originalListPrice eksikse listPrice'dan al
    if (!originalListPrice && listPrice) {
      console.log('⚠️ originalListPrice eksik, listPrice kullanılıyor:', listPrice);
    }
      
      // Aktif prim oranını al
      currentPrimRate = await PrimRate.findOne({ isActive: true }).sort({ createdAt: -1 });
      if (!currentPrimRate) {
        console.log('❌ Aktif prim oranı bulunamadı');
        return res.status(400).json({ message: 'Aktif prim oranı bulunamadı' });
      }
      console.log('✅ Prim oranı bulundu:', currentPrimRate.rate);
      console.log('🔍 Prim oranı tipi:', typeof currentPrimRate.rate);
      console.log('🔍 Prim oranı * 100:', currentPrimRate.rate * 100);

      // Prim dönemini belirle
      primPeriodId = await getOrCreatePrimPeriod(saleDate, req.user._id);

      // İndirim hesaplama
      if (discountRateNum > 0 && originalListPriceNum > 0) {
        discountedListPriceNum = parseFloat(discountedListPrice) || (originalListPriceNum * (1 - discountRateNum / 100));
        console.log(`💸 İndirim uygulandı: %${discountRateNum} - ${originalListPriceNum} TL → ${discountedListPriceNum} TL`);
        
        // NaN veya Infinity kontrolü
        if (!isFinite(discountedListPriceNum) || discountedListPriceNum < 0) {
          console.log('❌ İndirimli fiyat hesaplama hatası:', discountedListPriceNum);
          return res.status(400).json({ message: 'İndirimli fiyat hesaplamasında hata oluştu' });
        }
      }

      // Yeni prim hesaplama mantığı - 3 fiyat arasından en düşüğü
      activitySalePriceNum = parseFloat(activitySalePrice) || 0;
      
      const validPrices = [];
      
      // Orijinal liste fiyatı
      if (originalListPriceNum > 0) {
        validPrices.push(originalListPriceNum);
      }
      
      // İndirimli liste fiyatı (varsa)
      if (discountRateNum > 0 && discountedListPriceNum > 0) {
        validPrices.push(discountedListPriceNum);
      }
      
      // Aktivite fiyatı
      if (activitySalePriceNum > 0) {
        validPrices.push(activitySalePriceNum);
      }
      
      // En düşük fiyat üzerinden prim hesapla
      basePrimPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      primAmount = basePrimPrice * (currentPrimRate.rate / 100); // rate yüzde değeri olarak saklanıyor (1 = %1)
      
      // NaN veya Infinity kontrolü
      if (!isFinite(primAmount) || primAmount < 0) {
        console.log('❌ Prim hesaplama hatası:', { basePrimPrice, primRate: currentPrimRate.rate, primAmount });
        return res.status(400).json({ message: 'Prim hesaplamasında hata oluştu' });
      }

      console.log('💰 Prim hesaplama:');
      console.log('Orijinal liste fiyatı:', originalListPriceNum);
      console.log('İndirim oranı:', discountRateNum + '%');
      console.log('İndirimli liste fiyatı:', discountedListPriceNum);
      console.log('Aktivite fiyatı:', activitySalePriceNum);
      console.log('Geçerli fiyatlar:', validPrices);
      console.log('Base prim fiyatı:', basePrimPrice);
      console.log('Prim oranı:', currentPrimRate.rate);
      console.log('🧮 Hesaplama:', `${basePrimPrice} * ${currentPrimRate.rate} = ${primAmount}`);
      console.log('Hesaplanan prim:', primAmount);
    } else {
      // Kapora için prim dönemi belirle (kapora tarihine göre)
      primPeriodId = await getOrCreatePrimPeriod(kaporaDate, req.user._id);
      primAmount = 0; // Kapora için prim yok
      console.log('🏷️ Kapora kaydı - Prim hesaplanmadı');
    }

    // Yeni satış oluştur
    const saleData = {
      customerName,
      phone: phone || undefined, // Boşsa undefined
      blockNo,
      apartmentNo,
      periodNo,
      contractNo,
      saleType: saleType || 'satis',
      salesperson: req.user._id,
      primPeriod: primPeriodId,
      primAmount,
      entryDate,
      exitDate,
      notes
    };

    // Satış tipine göre farklı alanlar ekle
    if (!isKaporaType(saleType)) {
      saleData.saleDate = saleDate;
      saleData.listPrice = parseFloat(listPrice) || 0; // Ana liste fiyatı
      saleData.activitySalePrice = activitySalePriceNum;
      saleData.paymentType = paymentType;
      saleData.primRate = currentPrimRate.rate;
      saleData.basePrimPrice = basePrimPrice;
      
      // İndirim bilgileri
      if (discountRateNum > 0) {
        saleData.discountRate = discountRateNum;
        saleData.originalListPrice = originalListPriceNum; // Orijinal fiyat
        saleData.discountedListPrice = discountedListPriceNum; // İndirimli fiyat
      }
    } else {
      saleData.kaporaDate = kaporaDate;
    }

    console.log('💾 Sale oluşturuluyor, saleData:', saleData);
    
    // SaleData validation - dinamik kontrol
    const baseRequiredFields = ['customerName', 'blockNo', 'apartmentNo', 'periodNo', 'saleType'];
    
    // ContractNo için dinamik kontrol
    let isContractNoRequired = true;
    try {
      const activeSaleTypes = await SaleType.find({ isActive: true });
      const matchingSaleType = activeSaleTypes.find(type => {
        const lowerName = type.name.toLowerCase();
        if (lowerName.includes('kapora')) return saleType === 'kapora';
        if (lowerName.includes('manuel')) return saleType === 'manuel';
        if (lowerName.includes('normal') || lowerName.includes('satış')) return saleType === 'satis';
        return saleType === lowerName.replace(/\s+/g, '').replace(/[^\w]/g, '').substring(0, 20);
      });
      
      if (matchingSaleType && matchingSaleType.requiredFields?.contractNo === false) {
        isContractNoRequired = false;
      }
    } catch (error) {
      console.error('❌ SaleType check error:', error);
      // Hata durumunda contractNo'yu zorunlu tut
    }
    
    console.log('🔍 ContractNo requirement check:', {
      saleType,
      isContractNoRequired,
      contractNo: saleData.contractNo
    });
    
    // Temel alanları kontrol et
    for (const field of baseRequiredFields) {
      if (!saleData[field]) {
        console.log(`❌ Gerekli alan eksik: ${field}`);
        return res.status(400).json({ message: `Gerekli alan eksik: ${field}` });
      }
    }
    
    // ContractNo'yu dinamik olarak kontrol et
    if (isContractNoRequired && !saleData.contractNo) {
      console.log(`❌ Gerekli alan eksik: contractNo (saleType: ${saleType})`);
      return res.status(400).json({ message: `Gerekli alan eksik: contractNo` });
    }
    
    // Boş contractNo'yu undefined yap (MongoDB unique index hatası önlemek için)
    if (!saleData.contractNo || saleData.contractNo.trim() === '') {
      delete saleData.contractNo; // Alanı tamamen kaldır
    }
    
    const sale = new Sale(saleData);
    // Sale modeli kaydediliyor

    try {
      await sale.save();
      // Sale başarıyla kaydedildi
    } catch (saveError) {
      console.error('❌ Sale kaydetme hatası:', saveError);
      console.error('❌ Sale kaydetme hatası detayları:', {
        message: saveError.message,
        name: saveError.name,
        errors: saveError.errors,
        stack: saveError.stack
      });
      
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.keys(saveError.errors).map(key => ({
          field: key,
          message: saveError.errors[key].message,
          value: saveError.errors[key].value
        }));
        console.error('❌ Mongoose Validation Errors:', JSON.stringify(validationErrors, null, 2));
        return res.status(400).json({
          message: 'Veritabanı validasyon hatası',
          errors: validationErrors
        });
      }
      
      throw saveError; // Diğer hataları üst catch bloğuna fırlat
    }

    // Sadece normal satış için prim işlemi kaydet
    if (!isKaporaType(saleType)) {
      console.log('💰 Prim transaction oluşturuluyor...');
      const primTransaction = new PrimTransaction({
        salesperson: req.user._id,
        sale: sale._id,
        primPeriod: primPeriodId,
        transactionType: 'kazanç',
        amount: sale.primAmount,
        description: `${contractNo} sözleşme numaralı satış primi`,
        createdBy: req.user._id
      });

      console.log('📋 PrimTransaction data:', JSON.stringify(primTransaction.toObject(), null, 2));

      try {
        await primTransaction.save();
        console.log('✅ Prim transaction kaydedildi, ID:', primTransaction._id);
      } catch (primError) {
        console.error('❌ PrimTransaction kaydetme hatası:', primError);
        console.error('❌ PrimTransaction error details:', {
          message: primError.message,
          name: primError.name,
          errors: primError.errors
        });
        // Prim transaction hatası sale'i silmemeli, sadece log
        console.error('⚠️ Sale kaydedildi ama prim transaction başarısız!');
      }
    }

    // Populate ile döndür
    const populatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log(`✅ Yeni ${saleType === 'kapora' ? 'kapora' : 'satış'} oluşturuldu:`, sale._id);

    res.status(201).json({
      message: `${saleType === 'kapora' ? 'Kapora' : 'Satış'} başarıyla oluşturuldu`,
      sale: populatedSale
    });
  } catch (error) {
    console.error('❌ Create sale error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      message: 'Sunucu hatası',
      error: error.message,
      details: error.stack
    });
  }
});

// @route   GET /api/sales/upcoming-entries
// @desc    Yaklaşan giriş tarihli satışları listele
// @access  Private
router.get('/upcoming-entries', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query; // Varsayılan 7 gün
    const daysAhead = parseInt(days);
    
    // Bugünün tarihi ve gelecek X gün
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 0-based to 1-based
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();
    
    // Yaklaşan günleri hesapla (GG/AA formatında)
    const upcomingDates = [];
    for (let i = 0; i <= daysAhead; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      
      const day = futureDate.getDate().toString().padStart(2, '0');
      const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
      upcomingDates.push(`${day}/${month}`);
    }
    
    console.log('🔍 Upcoming entries search:', {
      daysAhead,
      upcomingDates,
      currentUser: req.user.email
    });
    
    // Sadece aktif satışları getir
    let query = { 
      status: 'aktif',
      entryDate: { $in: upcomingDates }
    };
    
    // Tüm kullanıcılar artık herkesi görebilir
    
    const upcomingSales = await Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .sort({ entryDate: 1, customerName: 1 })
      .limit(50); // Performans için limit
    
    // Giriş tarihine göre grupla ve sırala
    const groupedByDate = {};
    const sortedDates = [];
    
    upcomingSales.forEach(sale => {
      const entryDate = sale.entryDate;
      if (!groupedByDate[entryDate]) {
        groupedByDate[entryDate] = [];
        sortedDates.push(entryDate);
      }
      groupedByDate[entryDate].push(sale);
    });
    
    // Tarihleri sırala (bugün, yarın, vb.)
    sortedDates.sort((a, b) => {
      const [dayA, monthA] = a.split('/').map(Number);
      const [dayB, monthB] = b.split('/').map(Number);
      
      // Basit tarih karşılaştırması (aynı yıl varsayımı)
      const dateA = new Date(currentYear, monthA - 1, dayA);
      const dateB = new Date(currentYear, monthB - 1, dayB);
      
      return dateA - dateB;
    });
    
    console.log('📅 Upcoming entries found:', {
      totalSales: upcomingSales.length,
      uniqueDates: sortedDates.length,
      dates: sortedDates
    });
    
    res.json({
      success: true,
      data: {
        sales: upcomingSales,
        groupedByDate,
        sortedDates,
        totalCount: upcomingSales.length,
        daysAhead,
        searchDates: upcomingDates
      }
    });
    
  } catch (error) {
    console.error('Upcoming entries fetch error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Yaklaşan girişler yüklenirken hata oluştu',
      error: error.message 
    });
  }
});

// @route   GET /api/sales
// @desc    Satışları listele
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'aktif', 
      search, 
      period, 
      primStatus, 
      startDate, 
      endDate,
      salesperson,
      sortBy = 'saleDate',
      sortOrder = 'desc'
    } = req.query;
    
    let query = { status };
    
    // Tüm kullanıcılar tüm satışları görebilir (sadece görüntüleme için)
    if (salesperson && salesperson !== '') {
      // Temsilci seçilmişse o temsilciyi filtrele
      query.salesperson = salesperson;
    }
    
    // Arama filtresi
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { contractNo: { $regex: search, $options: 'i' } },
        { blockNo: { $regex: search, $options: 'i' } },
        { apartmentNo: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Dönem filtresi
    if (period) {
      query.primPeriod = period;
    }
    
    // Prim durumu filtresi
    if (primStatus && primStatus !== '') {
      query.primStatus = primStatus;
    }
    
    // Tarih aralığı filtresi
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.saleDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.saleDate = { $lte: new Date(endDate) };
    }

    // Sıralama parametresi oluştur
    const sortParam = {};
    
    // Güvenli alan kontrolü
    const allowedSortFields = [
      'customerName', 'contractNo', 'saleType', 'saleDate', 'kaporaDate', 
      'basePrimPrice', 'primAmount', 'status', 'createdAt', 'listPrice',
      'activitySalePrice', 'blockNo', 'apartmentNo'
    ];
    
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'saleDate';
    sortParam[sortField] = sortOrder === 'asc' ? 1 : -1;
    
    console.log(`🔄 Sales sorting: ${sortField} ${sortOrder} (requested: ${sortBy})`);
    
    // Eğer salesperson'a göre sıralama isteniyorsa, lookup ile yapılmalı
    let salesQuery;
    if (sortBy === 'salesperson') {
      // Aggregate pipeline ile salesperson'a göre sıralama
      salesQuery = Sale.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'salesperson',
            foreignField: '_id',
            as: 'salesperson'
          }
        },
        { $unwind: '$salesperson' },
        {
          $lookup: {
            from: 'primperiods',
            localField: 'primPeriod',
            foreignField: '_id',
            as: 'primPeriod'
          }
        },
        { $unwind: { path: '$primPeriod', preserveNullAndEmptyArrays: true } },
        { $sort: { 'salesperson.name': sortOrder === 'asc' ? 1 : -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit * 1 }
      ]);
    } else {
      // Normal query ile diğer alanlar için sıralama
      salesQuery = Sale.find(query)
        .populate('salesperson', 'name email')
        .populate('primPeriod', 'name')
        .sort(sortParam)
        .limit(limit * 1)
        .skip((page - 1) * limit);
    }

    const sales = await salesQuery;

    // Satış türü adlarını ve renklerini ekle
    const salesWithTypeNames = await Promise.all(sales.map(async (sale) => {
      const saleObj = sale.toObject();
      
      // Satış türü adını ve rengini bul
      if (saleObj.saleType === 'kapora') {
        saleObj.saleTypeName = 'Kapora Durumu';
        saleObj.saleTypeDetails = { color: 'warning' };
      } else if (saleObj.saleType === 'satis') {
        saleObj.saleTypeName = 'Normal Satış';
        saleObj.saleTypeDetails = { color: 'success' };
      } else {
        // Yeni satış türleri için SaleType tablosundan isim ve renk bul
        try {
          const saleTypes = await SaleType.find({ isActive: true }).select('name color sortOrder');
          const matchingType = saleTypes.find(type => {
            const lowerName = type.name.toLowerCase();
            const mappedValue = lowerName.replace(/\s+/g, '').replace(/[^\w]/g, '');
            return mappedValue === saleObj.saleType;
          });
          
          if (matchingType) {
            saleObj.saleTypeName = matchingType.name;
            saleObj.saleTypeDetails = { 
              color: matchingType.color || 'success',
              sortOrder: matchingType.sortOrder || 0
            };
          } else {
            saleObj.saleTypeName = saleObj.saleType;
            saleObj.saleTypeDetails = { color: 'success' };
          }
        } catch (error) {
          console.error('SaleType name lookup error:', error);
          saleObj.saleTypeName = saleObj.saleType;
          saleObj.saleTypeDetails = { color: 'success' };
        }
      }
      
      return saleObj;
    }));

    const total = await Sale.countDocuments(query);

    res.json({
      sales: salesWithTypeNames,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/sales/:id
// @desc    Tek satış getir
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('🔍 Sale GET by ID request received');
    console.log('User:', req.user?.email);
    console.log('Sale ID:', req.params.id);
    
    const sale = await Sale.findById(req.params.id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');
      
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Yetki kontrolü - sadece kendi satışını veya admin görebilir
    if (req.user.role !== 'admin' && sale.salesperson._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı görüntüleme yetkiniz bulunmamaktadır' });
    }

    console.log(`✅ Satış bulundu: ${sale.contractNo}`);
    
    res.json(sale);
  } catch (error) {
    console.error('❌ Get sale by ID error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id
// @desc    Satış güncelle
// @access  Private
router.put('/:id', auth, [
  body('customerName').optional().trim().isLength({ min: 1 }).withMessage('Müşteri adı soyadı gereklidir'),
  body('phone').optional().custom((value) => {
    if (value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
      throw new Error('Geçerli bir telefon numarası giriniz');
    }
    return true;
  }),
  body('blockNo').optional().trim().isLength({ min: 1 }).withMessage('Blok no gereklidir'),
  body('apartmentNo').optional().trim().isLength({ min: 1 }).withMessage('Daire no gereklidir'),
  body('periodNo').optional().trim().isLength({ min: 1 }).withMessage('Dönem no gereklidir'),
  body('contractNo').optional().custom(async (value, { req }) => {
    // Eğer değer varsa uzunluk kontrolü yap
    if (value && (value.length < 1 || value.length > 10)) {
      throw new Error('Sözleşme no 1-10 karakter arasında olmalıdır');
    }
    return true;
  }),
  body('saleType').optional().custom(validateSaleType),
  body('saleDate').optional().custom((value, { req }) => {
    if (!value) return true; // Optional field
    if (!isKaporaType(req.body.saleType) && !value) {
      throw new Error('Normal satış için satış tarihi gereklidir');
    }
    if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Geçerli bir satış tarihi giriniz (YYYY-MM-DD)');
    }
    return true;
  }),
  body('kaporaDate').optional().custom((value, { req }) => {
    if (!value) return true; // Optional field
    if (req.body.saleType === 'kapora' && !value) {
      throw new Error('Kapora için kapora tarihi gereklidir');
    }
    if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Geçerli bir kapora tarihi giriniz (YYYY-MM-DD)');
    }
    return true;
  }),
  body('listPrice').optional().isNumeric().withMessage('Liste fiyatı sayısal olmalıdır'),
  body('activitySalePrice').optional().isNumeric().withMessage('Aktivite satış fiyatı sayısal olmalıdır'),
  body('paymentType').optional().custom(validatePaymentType)
], async (req, res) => {
  try {
    console.log('🔍 Sale UPDATE request received');
    console.log('User:', req.user?.email);
    console.log('Sale ID:', req.params.id);
    console.log('Body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      const errorMessages = errors.array().map(err => `${err.param}: ${err.msg}`).join(', ');
      return res.status(400).json({ 
        message: `Validasyon hatası: ${errorMessages}`,
        errors: errors.array(),
        details: errorMessages
      });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Yetki kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı düzenleme yetkiniz bulunmamaktadır' });
    }

    const updates = req.body;
    
    // Satış türü değişikliği için admin kontrolü
    if (updates.saleType && updates.saleType !== sale.saleType && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Satış türü değişikliği sadece admin tarafından yapılabilir' });
    }
    
    // Sözleşme no değişikliği kontrolü
    if (updates.contractNo && updates.contractNo !== sale.contractNo) {
      const existingSale = await Sale.findOne({ 
        contractNo: updates.contractNo,
        _id: { $ne: sale._id }
      });
      if (existingSale) {
        return res.status(400).json({ message: 'Bu sözleşme numarası ile kayıtlı başka bir satış bulunmaktadır' });
      }
    }

    // Prim hesaplama (sadece normal satış için)
    let needsPrimRecalculation = false;
    if (!isKaporaType(sale.saleType) || !isKaporaType(updates.saleType)) {
      // Prim etkileyecek alanlar değişti mi?
      if (updates.listPrice !== undefined || updates.activitySalePrice !== undefined || 
          updates.discountRate !== undefined || updates.originalListPrice !== undefined || 
          updates.discountedListPrice !== undefined) {
        needsPrimRecalculation = true;
      }
    }

    // Boş contractNo'yu handle et (MongoDB unique index hatası önlemek için)
    if (updates.contractNo !== undefined && (!updates.contractNo || updates.contractNo.trim() === '')) {
      // Boş contractNo'yu tamamen kaldır
      sale.contractNo = undefined;
      delete updates.contractNo;
    }

    // Güncelleme işlemi
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        sale[key] = updates[key];
      }
    });

    // Prim yeniden hesaplama
    if (needsPrimRecalculation && !isKaporaType(sale.saleType)) {
      console.log('💰 Prim yeniden hesaplanıyor...');
      
      // Aktif prim oranını al
      const currentPrimRate = await PrimRate.findOne({ isActive: true }).sort({ createdAt: -1 });
      if (!currentPrimRate) {
        return res.status(400).json({ message: 'Aktif prim oranı bulunamadı' });
      }

      // İndirim hesaplama
      const originalListPriceNum = parseFloat(sale.originalListPrice || sale.listPrice) || 0;
      const discountRateNum = parseFloat(sale.discountRate) || 0;
      let discountedListPriceNum = 0;

      if (discountRateNum > 0 && originalListPriceNum > 0) {
        discountedListPriceNum = originalListPriceNum * (1 - discountRateNum / 100);
        sale.discountedListPrice = discountedListPriceNum;
        console.log(`💸 İndirim uygulandı: %${discountRateNum} - ${originalListPriceNum} TL → ${discountedListPriceNum} TL`);
      }

      // Yeni prim hesaplama mantığı - 3 fiyat arasından en düşüğü
      const activitySalePriceNum = parseFloat(sale.activitySalePrice) || 0;
      
      const validPrices = [];
      
      // Orijinal liste fiyatı
      if (originalListPriceNum > 0) {
        validPrices.push(originalListPriceNum);
      }
      
      // İndirimli liste fiyatı (varsa)
      if (discountRateNum > 0 && discountedListPriceNum > 0) {
        validPrices.push(discountedListPriceNum);
      }
      
      // Aktivite fiyatı
      if (activitySalePriceNum > 0) {
        validPrices.push(activitySalePriceNum);
      }
      
      // En düşük fiyat üzerinden prim hesapla
      const basePrimPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      const primAmount = basePrimPrice * (currentPrimRate.rate / 100); // rate yüzde değeri olarak saklanıyor (1 = %1)

      sale.primRate = currentPrimRate.rate;
      sale.basePrimPrice = basePrimPrice;
      sale.primAmount = primAmount;

      console.log('💰 Yeni prim hesaplama:');
      console.log('Orijinal liste fiyatı:', originalListPriceNum);
      console.log('İndirimli liste fiyatı:', discountedListPriceNum);
      console.log('Aktivite fiyatı:', activitySalePriceNum);
      console.log('Geçerli fiyatlar:', validPrices);
      console.log('Base prim fiyatı:', basePrimPrice);
      console.log('Prim oranı:', currentPrimRate.rate);
      console.log('Hesaplanan prim:', primAmount);

      // Prim transaction'ını güncelle (sadece ödenmemişse)
      if (sale.primStatus === 'ödenmedi') {
        await PrimTransaction.findOneAndUpdate(
          { sale: sale._id, transactionType: 'kazanç' },
          { 
            amount: primAmount,
            description: `${sale.contractNo} sözleşme numaralı satış primi (güncellendi)`
          }
        );
        console.log('✅ Prim transaction güncellendi');
      }
    }

    // Satış tarihine göre dönem güncelleme (sadece ödenmemiş primler için)
    if (updates.saleDate && sale.primStatus === 'ödenmedi') {
      const newPrimPeriodId = await getOrCreatePrimPeriod(updates.saleDate, req.user._id);
      if (newPrimPeriodId.toString() !== sale.primPeriod.toString()) {
        sale.primPeriod = newPrimPeriodId;
        
        // Prim transaction'ının dönemini de güncelle
        await PrimTransaction.findOneAndUpdate(
          { sale: sale._id, transactionType: 'kazanç' },
          { primPeriod: newPrimPeriodId }
        );
        console.log('📅 Prim dönemi güncellendi');
      }
    }

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log(`✅ Satış güncellendi: ${sale.contractNo}`);

    res.json({
      message: 'Satış başarıyla güncellendi',
      sale: updatedSale
    });
  } catch (error) {
    console.error('❌ Update sale error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      message: 'Satış güncellenirken hata oluştu',
      error: error.message 
    });
  }
});

// @route   PUT /api/sales/:id/cancel
// @desc    Satış iptal et
// @access  Private
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Yetki kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı iptal etme yetkiniz bulunmamaktadır' });
    }

    if (sale.status === 'iptal') {
      return res.status(400).json({ message: 'Satış zaten iptal edilmiş' });
    }

    // Satışı iptal et
    sale.status = 'iptal';
    sale.cancelledAt = new Date();
    sale.cancelledBy = req.user._id;
    await sale.save();

    // Prim durumuna göre işlem yap
    if (sale.primStatus === 'ödenmedi') {
      // Prim ödenmemişse, mevcut kazanç transaction'ını sil
      console.log('❌ Prim ödenmedi - Kazanç transaction siliniyor');
      await PrimTransaction.deleteOne({
        sale: sale._id,
        transactionType: 'kazanç',
        salesperson: sale.salesperson
      });
    } else if (sale.primStatus === 'ödendi') {
      // Prim ödenmişse kesinti işlemi oluştur - BİR SONRAKİ DÖNEMDE KESİNTİ
      console.log('💸 Prim ödendi - Kesinti transaction ekleniyor (bir sonraki döneme)');
      
      // Önce bu satış için önceden oluşturulmuş kesinti transaction'ı var mı kontrol et
      const existingDeduction = await PrimTransaction.findOne({
        sale: sale._id,
        transactionType: 'kesinti',
        salesperson: sale.salesperson
      });
      
      if (existingDeduction) {
        console.log(`⚠️ Bu satış için zaten kesinti var: ${existingDeduction.amount} TL`);
        console.log('Mevcut kesinti transaction korunuyor, yeni eklenmeyecek');
      } else {
        // İptal tarihi
        const cancelDate = new Date();
        const cancelYear = cancelDate.getFullYear();
        const cancelMonth = cancelDate.getMonth() + 1; // 0-11 arası olduğu için +1
        
        // Bir sonraki ayı hesapla
        let nextMonth = cancelMonth + 1;
        let nextYear = cancelYear;
        
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear = nextYear + 1;
        }
        
        // Bir sonraki ayın ilk gününü oluştur (dönem oluşturmak için)
        const nextPeriodDate = new Date(nextYear, nextMonth - 1, 1);
        const nextPeriodDateString = nextPeriodDate.toISOString().split('T')[0];
        
        console.log(`📅 İptal tarihi: ${cancelYear}/${cancelMonth} → Kesinti dönemi: ${nextYear}/${nextMonth}`);
        
        // Bir sonraki dönem oluştur/bul
        const nextPeriodId = await getOrCreatePrimPeriod(nextPeriodDateString, req.user._id);
        
        const primTransaction = new PrimTransaction({
          salesperson: sale.salesperson,
          sale: sale._id,
          primPeriod: nextPeriodId, // Bir sonraki dönem
          transactionType: 'kesinti',
          amount: -sale.primAmount,
          description: `İptalden kaynaklı kesinti - ${sale.contractNo} (${cancelYear}/${cancelMonth} iptal → ${nextYear}/${nextMonth} kesinti)`,
          deductionStatus: 'beklemede', // Manuel onay gerekiyor
          createdBy: req.user._id
        });
        await primTransaction.save();
        
        console.log(`✅ Kesinti eklendi: ${sale.primAmount} TL - Dönem: ${nextYear}/${nextMonth} (${nextPeriodId})`);
      }
    }

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .populate('cancelledBy', 'name');

    res.json({
      message: 'Satış başarıyla iptal edildi',
      sale: updatedSale
    });
  } catch (error) {
    console.error('Cancel sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/restore
// @desc    İptal edilen satışı geri al
// @access  Private
router.put('/:id/restore', auth, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Yetki kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı geri alma yetkiniz bulunmamaktadır' });
    }

    if (sale.status === 'aktif') {
      return res.status(400).json({ message: 'Satış zaten aktif durumda' });
    }

    // Satışı geri al
    sale.status = 'aktif';
    sale.cancelledAt = null;
    sale.cancelledBy = null;
    await sale.save();

    // İptal kesinti transaction'ını kaldır (varsa)
    const cancelTransaction = await PrimTransaction.findOne({
      sale: sale._id,
      transactionType: 'kesinti',
      salesperson: sale.salesperson
    });

    if (cancelTransaction) {
      console.log('🗑️ İptal kesinti transaction kaldırılıyor');
      await PrimTransaction.deleteOne({
        _id: cancelTransaction._id
      });
    }

    // Prim işlemini geri ekle (sadece bir kez)
    const existingTransaction = await PrimTransaction.findOne({
      sale: sale._id,
      transactionType: 'kazanç',
      salesperson: sale.salesperson
    });

    if (!existingTransaction) {
      console.log('🔄 Satış geri alındı - Prim kazancı ekleniyor');
      const primTransaction = new PrimTransaction({
        salesperson: sale.salesperson,
        sale: sale._id,
        primPeriod: sale.primPeriod,
        transactionType: 'kazanç',
        amount: sale.primAmount,
        description: `${sale.contractNo} sözleşme geri alma primi`,
        createdBy: req.user._id
      });
      await primTransaction.save();
    } else {
      console.log('⚠️ Prim transaction zaten mevcut, tekrar eklenmedi');
    }

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Satış başarıyla geri alındı',
      sale: updatedSale
    });
  } catch (error) {
    console.error('Restore sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/transfer
// @desc    Satışı başka temsilciye transfer et
// @access  Private (Admin only)
router.put('/:id/transfer', [auth, adminAuth], [
  body('newSalesperson').notEmpty().withMessage('Yeni temsilci seçilmelidir')
], async (req, res) => {
  try {
    console.log('🔄 Transfer request received:', {
      saleId: req.params.id,
      user: req.user?.email,
      body: req.body
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { newSalesperson, newPeriod } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    if (sale.salesperson.toString() === newSalesperson && !newPeriod) {
      return res.status(400).json({ message: 'Satış zaten bu temsilciye ait' });
    }

    const oldSalesperson = sale.salesperson;
    const oldPeriod = sale.primPeriod;

    // Transfer işlemi
    sale.transferredFrom = oldSalesperson;
    sale.salesperson = newSalesperson;
    sale.transferredAt = new Date();
    sale.transferredBy = req.user._id;

    // Eğer yeni dönem seçildiyse ve prim ödenmemişse değiştir
    if (newPeriod && sale.primStatus === 'ödenmedi') {
      sale.primPeriod = newPeriod;
    }

    await sale.save();

    // Sadece normal satışlar için prim transaction'ı oluştur
    if (!isKaporaType(sale.saleType)) {
      // Eski temsilciden kesinti
      const deductionTransaction = new PrimTransaction({
        salesperson: oldSalesperson,
        sale: sale._id,
        primPeriod: oldPeriod,
        transactionType: 'transfer_giden',
        amount: -sale.primAmount,
        description: `${sale.contractNo} sözleşme transfer kesintisi`,
        createdBy: req.user._id
      });
      await deductionTransaction.save();

      // Yeni temsilciye ekleme (yeni dönem varsa onu kullan)
      const additionTransaction = new PrimTransaction({
        salesperson: newSalesperson,
        sale: sale._id,
        primPeriod: newPeriod || sale.primPeriod,
        transactionType: 'transfer_gelen',
        amount: sale.primAmount,
        description: `${sale.contractNo} sözleşme transfer kazancı`,
        createdBy: req.user._id,
        relatedTransaction: deductionTransaction._id
      });
      await additionTransaction.save();
    }

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('transferredFrom', 'name email')
      .populate('primPeriod', 'name');

    const transferMessage = newPeriod && sale.primStatus === 'ödenmedi' 
      ? 'Satış başarıyla transfer edildi ve prim dönemi değiştirildi'
      : 'Satış başarıyla transfer edildi';

    console.log(`🔄 Transfer tamamlandı - Sözleşme: ${sale.contractNo}, Eski: ${oldSalesperson}, Yeni: ${newSalesperson}${newPeriod ? ', Yeni dönem: ' + newPeriod : ''}`);

    res.json({
      message: transferMessage,
      sale: updatedSale
    });
  } catch (error) {
    console.error('❌ Transfer sale error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      message: 'Transfer işlemi sırasında sunucu hatası oluştu',
      error: error.message 
    });
  }
});

// @route   PUT /api/sales/:id/prim-status
// @desc    Prim ödeme durumunu güncelle
// @access  Private (Admin only)
router.put('/:id/prim-status', [auth, adminAuth], [
  body('primStatus').isIn(['ödenmedi', 'ödendi']).withMessage('Geçerli bir prim durumu seçiniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { primStatus } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    sale.primStatus = primStatus;
    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Prim durumu başarıyla güncellendi',
      sale: updatedSale
    });
  } catch (error) {
    console.error('Update prim status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/sales/:id
// @desc    Satışı tamamen sil (sadece admin)
// @access  Private (Admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    console.log('🗑️ Admin satış siliyor:', req.user.email, 'Sale ID:', req.params.id);

    // İlişkili prim transaction'larını sil
    await PrimTransaction.deleteMany({ sale: sale._id });
    console.log('✅ İlişkili prim transaction\'ları silindi');

    // Satışı sil
    await Sale.findByIdAndDelete(req.params.id);
    console.log('✅ Satış veritabanından silindi');

    res.json({ 
      message: 'Satış ve ilişkili tüm veriler başarıyla silindi',
      deletedSale: {
        contractNo: sale.contractNo,
        customerName: sale.customerName,
        primAmount: sale.primAmount
      }
    });
  } catch (error) {
    console.error('❌ Delete sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/notes
// @desc    Satışa not ekle/güncelle
// @access  Private (sadece admin veya satışı yapan temsilci)
router.put('/:id/notes', auth, async (req, res) => {
  try {
    const { notes } = req.body;
    
    if (!notes || notes.trim() === '') {
      return res.status(400).json({ message: 'Not içeriği gereklidir' });
    }

    if (notes.length > 1000) {
      return res.status(400).json({ message: 'Not 1000 karakterden uzun olamaz' });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Sadece admin veya satışı yapan temsilci not ekleyebilir/güncelleyebilir
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışa not ekleme yetkiniz yok' });
    }

    const isNewNote = !sale.notes;
    
    sale.notes = notes.trim();
    
    if (isNewNote) {
      sale.notesAddedBy = req.user._id;
      sale.notesAddedAt = new Date();
    } else {
      sale.notesUpdatedBy = req.user._id;
      sale.notesUpdatedAt = new Date();
    }

    await sale.save();

    console.log(`📝 Not ${isNewNote ? 'eklendi' : 'güncellendi'} - Satış: ${sale.contractNo}, Kullanıcı: ${req.user.name}`);

    res.json({
      message: `Not başarıyla ${isNewNote ? 'eklendi' : 'güncellendi'}`,
      notes: sale.notes,
      notesAddedBy: sale.notesAddedBy,
      notesAddedAt: sale.notesAddedAt,
      notesUpdatedBy: sale.notesUpdatedBy,
      notesUpdatedAt: sale.notesUpdatedAt
    });
  } catch (error) {
    console.error('❌ Update notes error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/sales/:id/notes
// @desc    Satıştaki notu sil
// @access  Private (sadece admin veya satışı yapan temsilci)
router.delete('/:id/notes', auth, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Sadece admin veya satışı yapan temsilci not silebilir
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışın notunu silme yetkiniz yok' });
    }

    if (!sale.notes) {
      return res.status(400).json({ message: 'Silinecek not bulunamadı' });
    }

    sale.notes = undefined;
    sale.notesAddedBy = undefined;
    sale.notesAddedAt = undefined;
    sale.notesUpdatedBy = undefined;
    sale.notesUpdatedAt = undefined;

    await sale.save();

    console.log(`🗑️ Not silindi - Satış: ${sale.contractNo}, Kullanıcı: ${req.user.name}`);

    res.json({ message: 'Not başarıyla silindi' });
  } catch (error) {
    console.error('❌ Delete notes error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/convert-to-sale
// @desc    Kaporayı satışa dönüştür
// @access  Private (sadece admin veya satışı yapan temsilci)
router.put('/:id/convert-to-sale', auth, async (req, res) => {
  try {
    const { saleDate, listPrice, activitySalePrice, paymentType } = req.body;
    
    // Validasyonlar
    if (!saleDate || !listPrice || !activitySalePrice || !paymentType) {
      return res.status(400).json({ message: 'Tüm satış bilgileri gereklidir' });
    }

    if (parseFloat(listPrice) <= 0 || parseFloat(activitySalePrice) <= 0) {
      return res.status(400).json({ message: 'Fiyatlar sıfırdan büyük olmalıdır' });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    if (!isKaporaType(sale.saleType)) {
      return res.status(400).json({ message: 'Bu satış zaten normal satış durumunda' });
    }

    // Sadece admin veya satışı yapan temsilci dönüştürebilir
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu kaporayı dönüştürme yetkiniz yok' });
    }

    // Mevcut prim oranını al
    const currentPrimRate = await PrimRate.findOne().sort({ createdAt: -1 });
    if (!currentPrimRate) {
      return res.status(400).json({ message: 'Aktif prim oranı bulunamadı' });
    }

    // Prim hesaplama
    const listPriceNum = parseFloat(listPrice);
    const activitySalePriceNum = parseFloat(activitySalePrice);
    const basePrimPrice = Math.min(listPriceNum, activitySalePriceNum);
    const primAmount = basePrimPrice * (currentPrimRate.rate / 100); // rate yüzde değeri olarak saklanıyor (1 = %1)

    // Satışı güncelle
    sale.saleType = 'satis';
    sale.saleDate = new Date(saleDate);
    sale.listPrice = listPriceNum;
    sale.activitySalePrice = activitySalePriceNum;
    sale.paymentType = paymentType;
    sale.primRate = currentPrimRate.rate;
    sale.basePrimPrice = basePrimPrice;
    sale.primAmount = primAmount;

    await sale.save();

    // Prim transaction oluştur
    const PrimTransaction = require('../models/PrimTransaction');
    const primTransaction = new PrimTransaction({
      sale: sale._id,
      salesperson: sale.salesperson,
      primPeriod: sale.primPeriod,
      transactionType: 'kazanç',
      amount: primAmount,
      description: `Kapora satışa dönüştürüldü - ${sale.contractNo}`,
      createdBy: req.user._id
    });
    await primTransaction.save();

    console.log(`🔄 Kapora satışa dönüştürüldü - Sözleşme: ${sale.contractNo}, Prim: ${primAmount} TL`);

    res.json({
      message: 'Kapora başarıyla satışa dönüştürüldü',
      sale: {
        _id: sale._id,
        contractNo: sale.contractNo,
        customerName: sale.customerName,
        saleType: sale.saleType,
        primAmount: sale.primAmount
      }
    });
  } catch (error) {
    console.error('❌ Convert to sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/transaction/:transactionId/period
// @desc    PrimTransaction dönemini değiştir (Admin only)
// @access  Private (Admin only)
router.put('/transaction/:transactionId/period', [auth, adminAuth], [
  body('newPeriodId').notEmpty().withMessage('Yeni dönem seçilmelidir')
], async (req, res) => {
  try {
    console.log('🔄 PrimTransaction dönem değiştirme isteği:', {
      transactionId: req.params.transactionId,
      user: req.user?.email,
      body: req.body
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { newPeriodId } = req.body;

    // Transaction'ı bul
    const transaction = await PrimTransaction.findById(req.params.transactionId)
      .populate('primPeriod', 'name')
      .populate('salesperson', 'name email')
      .populate('sale', 'contractNo');

    if (!transaction) {
      return res.status(404).json({ message: 'Prim transaction bulunamadı' });
    }

    // Yeni dönem kontrolü
    const PrimPeriod = require('../models/PrimPeriod');
    const newPeriod = await PrimPeriod.findById(newPeriodId);
    if (!newPeriod) {
      return res.status(404).json({ message: 'Yeni dönem bulunamadı' });
    }

    const oldPeriodName = transaction.primPeriod?.name || 'Bilinmeyen';
    const newPeriodName = newPeriod.name;

    // Transaction dönemini güncelle
    transaction.primPeriod = newPeriodId;
    transaction.description += ` (Dönem değiştirildi: ${oldPeriodName} → ${newPeriodName})`;
    await transaction.save();

    // Güncellenmiş transaction'ı döndür
    const updatedTransaction = await PrimTransaction.findById(transaction._id)
      .populate('primPeriod', 'name')
      .populate('salesperson', 'name email')
      .populate('sale', 'contractNo');

    console.log(`✅ Transaction dönem değişikliği tamamlandı: ${transaction._id} - ${oldPeriodName} → ${newPeriodName}`);

    res.json({
      message: `Transaction dönemi başarıyla değiştirildi: ${oldPeriodName} → ${newPeriodName}`,
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error('❌ Transaction period change error:', error);
    res.status(500).json({ 
      message: 'Transaction dönem değiştirme işleminde hata oluştu',
      error: error.message 
    });
  }
});

// @route   PUT /api/sales/:id/modify
// @desc    Satış değişikliği yap
// @access  Private
router.put('/:id/modify', [
  auth,
  body('blockNo').notEmpty().withMessage('Blok no gereklidir'),
  body('apartmentNo').notEmpty().withMessage('Daire no gereklidir'),
  body('periodNo').notEmpty().withMessage('Dönem no gereklidir'),
  body('listPrice').isNumeric().withMessage('Liste fiyatı sayısal olmalıdır'),
  body('activitySalePrice').isNumeric().withMessage('Aktivite satış fiyatı sayısal olmalıdır'),
  body('contractNo').notEmpty().withMessage('Sözleşme no gereklidir'),
  body('saleDate').optional().isISO8601().withMessage('Geçerli bir satış tarihi giriniz'),
  body('kaporaDate').optional().isISO8601().withMessage('Geçerli bir kapora tarihi giriniz'),
  body('entryDate').notEmpty().withMessage('Giriş tarihi gereklidir'),
  body('exitDate').notEmpty().withMessage('Çıkış tarihi gereklidir'),
  body('reason').notEmpty().withMessage('Değişiklik sebebi gereklidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const {
      blockNo,
      apartmentNo,
      periodNo,
      listPrice,
      discountRate,
      activitySalePrice,
      contractNo,
      saleDate,
      kaporaDate,
      entryDate,
      exitDate,
      reason
    } = req.body;

    // Mevcut satışı bul
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Sadece kendi satışını değiştirebilir (admin hariç)
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Bu satışı değiştirme yetkiniz yok' });
    }

    // Önceki verileri kaydet
    const previousData = {
      blockNo: sale.blockNo,
      apartmentNo: sale.apartmentNo,
      periodNo: sale.periodNo,
      listPrice: sale.listPrice,
      discountRate: sale.discountRate,
      activitySalePrice: sale.activitySalePrice,
      contractNo: sale.contractNo,
      saleDate: sale.saleDate,
      kaporaDate: sale.kaporaDate,
      entryDate: sale.entryDate,
      exitDate: sale.exitDate,
      basePrimPrice: sale.basePrimPrice,
      primAmount: sale.primAmount
    };

    // Yeni verileri uygula
    sale.blockNo = blockNo;
    sale.apartmentNo = apartmentNo;
    sale.periodNo = periodNo;
    sale.listPrice = listPrice;
    sale.discountRate = discountRate || 0;
    sale.activitySalePrice = activitySalePrice;
    sale.contractNo = contractNo;
    sale.entryDate = entryDate;
    sale.exitDate = exitDate;

    // Tarih alanlarını güncelle
    if (saleDate) sale.saleDate = saleDate;
    if (kaporaDate) sale.kaporaDate = kaporaDate;

    // Güncel prim oranını al
    const currentPrimRate = await PrimRate.findOne().sort({ createdAt: -1 });
    if (currentPrimRate) {
      sale.primRate = currentPrimRate.rate;
    }

    // Değişiklik geçmişini kaydet
    const newData = {
      blockNo: sale.blockNo,
      apartmentNo: sale.apartmentNo,
      periodNo: sale.periodNo,
      listPrice: sale.listPrice,
      discountRate: sale.discountRate,
      activitySalePrice: sale.activitySalePrice,
      contractNo: sale.contractNo,
      saleDate: sale.saleDate,
      kaporaDate: sale.kaporaDate,
      entryDate: sale.entryDate,
      exitDate: sale.exitDate,
      basePrimPrice: 0, // save middleware'de hesaplanacak
      primAmount: 0 // save middleware'de hesaplanacak
    };

    sale.isModified = true;
    sale.modificationHistory.push({
      modifiedBy: req.user.id,
      reason: reason,
      previousData: previousData,
      newData: newData
    });

    // Değişiklik nedenini notlara da ekle
    const existingNotes = sale.notes || '';
    const modificationNote = `[DEĞİŞİKLİK NEDENI - ${new Date().toLocaleDateString('tr-TR')}]: ${reason.trim()}`;
    sale.notes = existingNotes 
      ? `${existingNotes}\n\n${modificationNote}`
      : modificationNote;
    
    // Not bilgilerini güncelle
    if (!sale.notesAddedBy) {
      sale.notesAddedBy = req.user._id;
      sale.notesAddedAt = new Date();
    } else {
      sale.notesUpdatedBy = req.user._id;
      sale.notesUpdatedAt = new Date();
    }

    await sale.save();

    // Yeni hesaplanan değerleri güncelle
    const updatedSale = await Sale.findById(id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    // Değişiklik geçmişindeki son kayıttaki newData'yı güncelle
    const lastModification = updatedSale.modificationHistory[updatedSale.modificationHistory.length - 1];
    lastModification.newData.basePrimPrice = updatedSale.basePrimPrice;
    lastModification.newData.primAmount = updatedSale.primAmount;
    await updatedSale.save();

    res.json({
      message: 'Satış başarıyla güncellendi',
      sale: updatedSale
    });

  } catch (error) {
    console.error('Sale modification error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});


// @route   POST /api/sales/bulk-prim-status/preview
// @desc    Toplu prim durumu önizleme (Admin only)
// @access  Private (Admin only)
router.post('/bulk-prim-status/preview', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🔄 Bulk prim status preview started');
    console.log('📊 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User:', req.user?.name, req.user?.role);
    
    const { 
      primStatus, // 'ödendi' veya 'ödenmedi'
      filters // { period, salesperson, month, year, startDate, endDate }
    } = req.body;
    
    console.log('🔍 Extracted values:');
    console.log('  - primStatus:', primStatus, typeof primStatus);
    console.log('  - filters:', filters, typeof filters);

    if (!primStatus || !['ödendi', 'ödenmedi'].includes(primStatus)) {
      console.log('❌ Invalid prim status:', primStatus);
      return res.status(400).json({ 
        message: 'Geçerli prim durumu belirtilmeli (ödendi/ödenmedi)' 
      });
    }

    if (!filters) {
      console.log('❌ No filters provided');
      return res.status(400).json({ 
        message: 'Filtreler belirtilmeli' 
      });
    }

    // Filtre oluştur (aynı logic)
    let query = { saleType: 'satis' }; // Sadece satışlar, kapora değil

    // Dönem filtresi
    if (filters.period && filters.period.trim() !== '') {
      try {
        query.primPeriod = new mongoose.Types.ObjectId(filters.period);
        console.log('✅ Period filter added:', filters.period);
      } catch (error) {
        console.log('❌ Invalid period ObjectId:', filters.period);
        return res.status(400).json({ 
          message: 'Geçersiz dönem ID formatı' 
        });
      }
    } else {
      console.log('ℹ️ Period filter skipped (empty value)');
    }

    // Temsilci filtresi (user name ile)
    if (filters.salesperson && filters.salesperson.trim() !== '') {
      const salespersonName = filters.salesperson.trim();
      
      console.log('🔍 Looking for salesperson by name:', salespersonName);
      
      // User'ı name ile bul
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: salespersonName,
        isActive: true,
        isApproved: true
      });
      
      if (user) {
        query.salesperson = user._id;
        console.log('✅ Salesperson found:', user.name, '→', user._id);
      } else {
        console.log('❌ Salesperson not found:', salespersonName);
        return res.status(400).json({ 
          message: `Temsilci bulunamadı: ${salespersonName}` 
        });
      }
    } else {
      console.log('ℹ️ Salesperson filter skipped (empty value)');
    }

    // Ay/Yıl filtresi (saleDate bazında)
    if (filters.month && filters.year) {
      try {
        const startDate = new Date(filters.year, filters.month - 1, 1);
        const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date');
        }
        
        query.saleDate = { $gte: startDate, $lte: endDate };
        console.log('✅ Month/Year filter added:', { month: filters.month, year: filters.year });
      } catch (error) {
        console.log('❌ Invalid month/year:', filters.month, filters.year);
        return res.status(400).json({ 
          message: 'Geçersiz ay/yıl formatı' 
        });
      }
    } else if (filters.year) {
      try {
        const startDate = new Date(filters.year, 0, 1);
        const endDate = new Date(filters.year, 11, 31, 23, 59, 59);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date');
        }
        
        query.saleDate = { $gte: startDate, $lte: endDate };
        console.log('✅ Year filter added:', filters.year);
      } catch (error) {
        console.log('❌ Invalid year:', filters.year);
        return res.status(400).json({ 
          message: 'Geçersiz yıl formatı' 
        });
      }
    }

    // Tarih aralığı filtresi
    if (filters.startDate && filters.endDate) {
      query.saleDate = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate + 'T23:59:59.999Z')
      };
    } else if (filters.startDate) {
      query.saleDate = { $gte: new Date(filters.startDate) };
    } else if (filters.endDate) {
      query.saleDate = { $lte: new Date(filters.endDate + 'T23:59:59.999Z') };
    }

    console.log('🔍 Preview query:', query);

    // Sadece önizleme - güncelleme yapmıyoruz
    console.log('🔄 Starting database query...');
    const affectedSales = await Sale.find(query)
      .populate('salesperson', 'name')
      .populate('primPeriod', 'name')
      .select('customerName contractNo primAmount primStatus salesperson primPeriod saleDate')
      .limit(100); // Performans için limit
    
    console.log('✅ Query completed, found:', affectedSales.length, 'sales');

    if (affectedSales.length === 0) {
      console.log('❌ No sales found with current filters');
      return res.status(404).json({ 
        message: 'Belirtilen kriterlere uygun satış bulunamadı' 
      });
    }

    // Toplam sayıyı da al
    console.log('🔄 Getting total count...');
    const totalCount = await Sale.countDocuments(query);
    console.log('✅ Total count:', totalCount);

    // Özet bilgi hazırla
    console.log('🔄 Preparing response summary...');
    const summary = {
      totalUpdated: totalCount,
      newStatus: primStatus,
      affectedSales: affectedSales.map(sale => ({
        id: sale._id,
        customerName: sale.customerName,
        contractNo: sale.contractNo,
        primAmount: sale.primAmount,
        oldStatus: sale.primStatus,
        salesperson: sale.salesperson?.name,
        period: sale.primPeriod?.name,
        saleDate: sale.saleDate
      }))
    };

    console.log('✅ Preview completed successfully');
    res.json({
      success: true,
      message: `${totalCount} satış etkilenecek`,
      summary
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      message: 'Önizleme yüklenirken hata oluştu',
      error: error.message 
    });
  }
});

// @route   PUT /api/sales/bulk-prim-status
// @desc    Toplu prim durumu değiştir (Admin only)  
// @access  Private (Admin only)
router.put('/bulk-prim-status', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🔄 Bulk prim status update started');
    console.log('📊 Request body:', req.body);
    console.log('👤 User:', req.user.name, req.user.role);
    
    const { 
      primStatus, // 'ödendi' veya 'ödenmedi'
      filters // { period, salesperson, month, year, startDate, endDate }
    } = req.body;

    if (!primStatus || !['ödendi', 'ödenmedi'].includes(primStatus)) {
      console.log('❌ Invalid prim status:', primStatus);
      return res.status(400).json({ 
        message: 'Geçerli prim durumu belirtilmeli (ödendi/ödenmedi)' 
      });
    }

    if (!filters) {
      console.log('❌ No filters provided');
      return res.status(400).json({ 
        message: 'Filtreler belirtilmeli' 
      });
    }

    // Filtre oluştur
    let query = { saleType: 'satis' }; // Sadece satışlar, kapora değil

    // Dönem filtresi
    if (filters.period && filters.period.trim() !== '') {
      try {
        query.primPeriod = new mongoose.Types.ObjectId(filters.period);
        console.log('✅ Period filter added:', filters.period);
      } catch (error) {
        console.log('❌ Invalid period ObjectId:', filters.period);
        return res.status(400).json({ 
          message: 'Geçersiz dönem ID formatı' 
        });
      }
    } else {
      console.log('ℹ️ Period filter skipped (empty value)');
    }

    // Temsilci filtresi (user name ile)
    if (filters.salesperson && filters.salesperson.trim() !== '') {
      const salespersonName = filters.salesperson.trim();
      
      console.log('🔍 Looking for salesperson by name:', salespersonName);
      
      // User'ı name ile bul
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: salespersonName,
        isActive: true,
        isApproved: true
      });
      
      if (user) {
        query.salesperson = user._id;
        console.log('✅ Salesperson found:', user.name, '→', user._id);
      } else {
        console.log('❌ Salesperson not found:', salespersonName);
        return res.status(400).json({ 
          message: `Temsilci bulunamadı: ${salespersonName}` 
        });
      }
    } else {
      console.log('ℹ️ Salesperson filter skipped (empty value)');
    }

    // Ay/Yıl filtresi (saleDate bazında)
    if (filters.month && filters.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      query.saleDate = { $gte: startDate, $lte: endDate };
    } else if (filters.year) {
      const startDate = new Date(filters.year, 0, 1);
      const endDate = new Date(filters.year, 11, 31, 23, 59, 59);
      query.saleDate = { $gte: startDate, $lte: endDate };
    }

    // Tarih aralığı filtresi
    if (filters.startDate && filters.endDate) {
      query.saleDate = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate + 'T23:59:59.999Z')
      };
    } else if (filters.startDate) {
      query.saleDate = { $gte: new Date(filters.startDate) };
    } else if (filters.endDate) {
      query.saleDate = { $lte: new Date(filters.endDate + 'T23:59:59.999Z') };
    }

    console.log('🔄 Bulk prim status update query:', query);
    console.log('📊 New status:', primStatus);

    // Önce kaç kayıt etkileneceğini kontrol et
    console.log('🔍 Finding affected sales with query:', query);
    const affectedSales = await Sale.find(query)
      .populate('salesperson', 'name')
      .populate('primPeriod', 'name')
      .select('customerName contractNo primAmount primStatus salesperson primPeriod saleDate');
    console.log('✅ Found affected sales:', affectedSales.length);

    if (affectedSales.length === 0) {
      return res.status(404).json({ 
        message: 'Belirtilen kriterlere uygun satış bulunamadı' 
      });
    }

    // Güncelleme işlemini gerçekleştir
    console.log('🔄 Starting updateMany operation...');
    console.log('🔄 Update query:', query);
    console.log('🔄 Update data:', { 
      primStatus,
      primStatusUpdatedAt: new Date(),
      primStatusUpdatedBy: req.user._id
    });
    const updateResult = await Sale.updateMany(
      query,
      { 
        $set: { 
          primStatus,
          primStatusUpdatedAt: new Date(),
          primStatusUpdatedBy: req.user._id
        }
      }
    );
    console.log('✅ UpdateMany completed:', updateResult);

    // Özet bilgi hazırla
    const summary = {
      totalUpdated: updateResult.modifiedCount,
      newStatus: primStatus,
      affectedSales: affectedSales.map(sale => ({
        id: sale._id,
        customerName: sale.customerName,
        contractNo: sale.contractNo,
        primAmount: sale.primAmount,
        oldStatus: sale.primStatus,
        salesperson: sale.salesperson?.name,
        period: sale.primPeriod?.name,
        saleDate: sale.saleDate
      }))
    };

    // Activity log ekle
    try {
      console.log('🔄 Creating activity log...');
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user: req.user._id,
        action: 'bulk_prim_status_update',
        details: `${updateResult.modifiedCount} satışın prim durumu "${primStatus}" olarak güncellendi`,
        metadata: {
          filters,
          primStatus,
          affectedCount: updateResult.modifiedCount
        }
      });
      console.log('✅ Activity log created');
    } catch (logError) {
      console.log('⚠️ Activity log failed (non-critical):', logError.message);
      console.log('⚠️ Activity log error stack:', logError.stack);
      // Activity log hatası kritik değil, devam et
    }

    res.json({
      success: true,
      message: `${updateResult.modifiedCount} satışın prim durumu "${primStatus}" olarak güncellendi`,
      summary
    });

  } catch (error) {
    console.error('Bulk prim status update error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      message: 'Toplu prim durumu güncellenirken hata oluştu',
      error: error.message 
    });
  }
});

// @route   POST /api/sales/debug-bulk
// @desc    Debug bulk prim status update
// @access  Private (Admin only)
router.post('/debug-bulk', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🧪 Debug bulk endpoint hit');
    console.log('📊 Request body:', req.body);
    console.log('👤 User:', req.user?.name, req.user?.role);
    
    const { primStatus, filters } = req.body;
    
    // User lookup test
    let userFound = null;
    if (filters.salesperson) {
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: filters.salesperson,
        isActive: true,
        isApproved: true
      });
      console.log('👤 User lookup result:', user ? user.name : 'NOT FOUND');
      userFound = user;
    }
    
    // Query building test (tam olarak asıl endpoint gibi)
    let query = { saleType: 'satis' };
    
    // Temsilci filtresi ekle
    if (userFound) {
      query.salesperson = userFound._id;
      console.log('✅ Salesperson added to query:', userFound.name, '→', userFound._id);
    }
    
    // Tarih filtresi ekle
    if (filters.month && filters.year) {
      const startDate = new Date(filters.year, filters.month - 1, 1);
      const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
      query.saleDate = { $gte: startDate, $lte: endDate };
      console.log('📅 Date range added:', startDate, 'to', endDate);
    }
    
    console.log('🔍 Final query:', query);
    
    // Test query ile kaç satış bulunacağını kontrol et
    const Sale = require('../models/Sale');
    const testCount = await Sale.countDocuments(query);
    console.log('📊 Sales found with this query:', testCount);
    
    // Populate test (asıl endpoint gibi)
    if (testCount > 0) {
      console.log('🔍 Testing Sale.find() with populate...');
      try {
        const testSales = await Sale.find(query)
          .populate('salesperson', 'name')
          .populate('primPeriod', 'name')
          .select('customerName contractNo primAmount primStatus salesperson primPeriod saleDate')
          .limit(3); // Sadece 3 tane test için
        console.log('✅ Populate test successful, sample:', testSales.length, 'sales');
        console.log('📋 Sample sale:', testSales[0] ? {
          customer: testSales[0].customerName,
          salesperson: testSales[0].salesperson?.name,
          period: testSales[0].primPeriod?.name
        } : 'No sales');
      } catch (populateError) {
        console.error('❌ Populate test failed:', populateError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Debug endpoint çalışıyor',
      user: req.user?.name,
      body: req.body,
      query: query
    });
  } catch (error) {
    console.error('❌ Debug bulk error:', error);
    res.status(500).json({ 
      message: 'Debug endpoint hatası',
      error: error.message 
    });
  }
});

// @route   POST /api/sales/test-bulk
// @desc    Test endpoint for bulk operations
// @access  Private (Admin only)
router.post('/test-bulk', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🧪 Test bulk endpoint hit');
    console.log('📊 Request body:', req.body);
    console.log('👤 User:', req.user?.name, req.user?.role);
    
    res.json({
      success: true,
      message: 'Test endpoint çalışıyor',
      user: req.user?.name,
      body: req.body
    });
  } catch (error) {
    console.error('❌ Test bulk error:', error);
    res.status(500).json({ 
      message: 'Test endpoint hatası',
      error: error.message 
    });
  }
});

module.exports = router;
