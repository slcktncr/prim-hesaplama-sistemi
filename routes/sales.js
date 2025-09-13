const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Sale = require('../models/Sale');
const User = require('../models/User');
const PrimRate = require('../models/PrimRate');
const PrimPeriod = require('../models/PrimPeriod');
const SaleType = require('../models/SaleType');
const PaymentType = require('../models/PaymentType');

const router = express.Router();

// Helper functions
const isKaporaType = (saleType) => {
  return saleType === 'kapora';
};

const validateSaleType = async (value, { req }) => {
  if (!value) return true; // Optional field
  
  if (['satis', 'kapora'].includes(value)) {
    return true; // Varsayılan türler
  }
  
  // Özel satış türlerini kontrol et
  try {
    const saleTypes = await SaleType.find({ isActive: true });
    const normalizedValue = value.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '');
    
    const matchingType = saleTypes.find(type => {
      const normalizedTypeName = type.name.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '');
      return normalizedTypeName === normalizedValue;
    });
    
    if (!matchingType) {
      throw new Error(`Geçersiz satış türü: ${value}`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Satış türü doğrulama hatası: ${error.message}`);
  }
};

const validatePaymentType = async (value, { req }) => {
  if (!value) return true; // Optional field
  
  try {
    const paymentTypes = await PaymentType.find({ isActive: true });
    const matchingType = paymentTypes.find(type => type.name === value);
    
    if (!matchingType) {
      throw new Error(`Geçersiz ödeme türü: ${value}`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Ödeme türü doğrulama hatası: ${error.message}`);
  }
};

// Prim dönemini al veya oluştur
const getOrCreatePrimPeriod = async (saleDate, userId) => {
  try {
    const date = new Date(saleDate);
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const year = date.getFullYear();
    
    // Türkçe ay isimleri
    const monthNames = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    
    const periodName = `${monthNames[month - 1]} ${year}`;
    
    // Mevcut dönemi bul
    let period = await PrimPeriod.findOne({
      month: month,
      year: year
    });
    
    // Yoksa oluştur
    if (!period) {
      period = new PrimPeriod({
        name: periodName,
        month: month,
        year: year,
        createdBy: userId
      });
      await period.save();
      console.log(`✅ Yeni prim dönemi oluşturuldu: ${periodName}`);
    }
    
    return period._id;
  } catch (error) {
    console.error('Prim dönemi oluşturma hatası:', error);
    throw error;
  }
};

// Export helper function for use in other modules
module.exports.getOrCreatePrimPeriod = getOrCreatePrimPeriod;

// @route   POST /api/sales
// @desc    Yeni satış ekle
// @access  Private
router.post('/', auth, [
  body('customerName').trim().isLength({ min: 1 }).withMessage('Müşteri adı soyadı gereklidir'),
  body('phone').optional().custom((value) => {
    if (value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
      throw new Error('Geçerli bir telefon numarası giriniz');
    }
    return true;
  }),
  body('blockNo').trim().isLength({ min: 1 }).withMessage('Blok no gereklidir'),
  body('apartmentNo').trim().isLength({ min: 1 }).withMessage('Daire no gereklidir'),
  body('periodNo').trim().isLength({ min: 1 }).withMessage('Dönem no gereklidir'),
  body('contractNo').custom(async (value, { req }) => {
    if (!value || value.trim() === '') {
      throw new Error('Sözleşme no gereklidir');
    }
    
    // Sözleşme no benzersizlik kontrolü
    const existingSale = await Sale.findOne({ 
      contractNo: value.trim(),
      isDeleted: { $ne: true }
    });
    
    if (existingSale) {
      throw new Error('Bu sözleşme numarası zaten kullanılıyor');
    }
    
    return true;
  }),
  body('saleType').custom(validateSaleType),
  body('saleDate').custom((value, { req }) => {
    if (!isKaporaType(req.body.saleType) && !value) {
      throw new Error('Normal satış için satış tarihi gereklidir');
    }
    if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Geçerli bir satış tarihi giriniz (YYYY-MM-DD)');
    }
    return true;
  }),
  body('kaporaDate').custom((value, { req }) => {
    if (req.body.saleType === 'kapora' && !value) {
      throw new Error('Kapora için kapora tarihi gereklidir');
    }
    if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error('Geçerli bir kapora tarihi giriniz (YYYY-MM-DD)');
    }
    return true;
  }),
  body('listPrice').isNumeric().withMessage('Liste fiyatı sayısal olmalıdır'),
  body('activitySalePrice').optional().isNumeric().withMessage('Aktivite satış fiyatı sayısal olmalıdır'),
  body('paymentType').custom(validatePaymentType)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customerName, phone, blockNo, apartmentNo, periodNo, contractNo,
      saleType, saleDate, kaporaDate, listPrice, originalListPrice, 
      discountRate, discountedListPrice, activitySalePrice, paymentType
    } = req.body;

    let currentPrimRate = null;
    let primPeriodId = null;

    // Sayısal değerleri parse et
    const listPriceNum = parseFloat(listPrice) || 0;
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
      const basePrimPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      const primAmount = basePrimPrice * (currentPrimRate.rate / 100); // rate yüzde değeri olarak saklanıyor (1 = %1)

      console.log('💰 Prim hesaplama detayları:');
      console.log('  - Geçerli fiyatlar:', validPrices);
      console.log('  - En düşük fiyat (basePrimPrice):', basePrimPrice);
      console.log('  - Prim oranı:', currentPrimRate.rate, '%');
      console.log('  - Hesaplanan prim:', primAmount, 'TL');

      // Prim tutarı kontrolü
      if (!isFinite(primAmount) || primAmount < 0) {
        console.log('❌ Prim hesaplama hatası:', primAmount);
        return res.status(400).json({ message: 'Prim hesaplamasında hata oluştu' });
      }
    }

    // Satış kaydını oluştur
    const saleData = {
      customerName: customerName.trim(),
      phone: phone?.trim() || '',
      blockNo: blockNo.trim(),
      apartmentNo: apartmentNo.trim(),
      periodNo: periodNo.trim(),
      contractNo: contractNo.trim(),
      saleType,
      saleDate: saleDate || null,
      kaporaDate: kaporaDate || null,
      listPrice: listPriceNum,
      originalListPrice: originalListPriceNum,
      discountRate: discountRateNum,
      discountedListPrice: discountedListPriceNum,
      activitySalePrice: parseFloat(activitySalePrice) || 0,
      paymentType: paymentType || '',
      salesperson: req.user._id,
      createdBy: req.user._id
    };

    // Kapora değilse prim bilgilerini ekle
    if (!isKaporaType(saleType) && currentPrimRate) {
      const validPrices = [];
      
      if (originalListPriceNum > 0) validPrices.push(originalListPriceNum);
      if (discountRateNum > 0 && discountedListPriceNum > 0) validPrices.push(discountedListPriceNum);
      if (parseFloat(activitySalePrice) > 0) validPrices.push(parseFloat(activitySalePrice));
      
      const basePrimPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
      const primAmount = basePrimPrice * (currentPrimRate.rate / 100);

      saleData.primRate = currentPrimRate.rate;
      saleData.basePrimPrice = basePrimPrice;
      saleData.primAmount = primAmount;
      saleData.primPeriod = primPeriodId;
      saleData.primStatus = 'ödenmedi';
    }

    const sale = new Sale(saleData);
    await sale.save();

    // Populate edilmiş satışı döndür
    const populatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log('✅ Satış başarıyla oluşturuldu:', sale._id);

    res.status(201).json({
      message: 'Satış başarıyla eklendi',
      sale: populatedSale
    });

  } catch (error) {
    console.error('Sale creation error:', error);
    
    // Duplicate key error (sözleşme no)
    if (error.code === 11000 && error.keyPattern?.contractNo) {
      return res.status(400).json({ 
        message: 'Bu sözleşme numarası zaten kullanılıyor' 
      });
    }
    
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/sales/upcoming-entries
// @desc    Yaklaşan giriş tarihlerini getir
// @access  Private
router.get('/upcoming-entries', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = parseInt(days);
    
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      return res.status(400).json({ message: 'Geçerli bir gün sayısı giriniz (1-365)' });
    }

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysNum);

    // Kullanıcı rolüne göre sorgu oluştur
    let query = {
      saleType: 'kapora',
      kaporaDate: {
        $gte: today,
        $lte: futureDate
      },
      isDeleted: { $ne: true }
    };

    // Admin değilse sadece kendi satışlarını göster
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
    }

    const upcomingEntries = await Sale.find(query)
      .populate('salesperson', 'name email')
      .sort({ kaporaDate: 1 })
      .limit(100);

    // Gün gruplarına ayır
    const groupedEntries = {};
    upcomingEntries.forEach(sale => {
      const dateKey = sale.kaporaDate.toISOString().split('T')[0];
      if (!groupedEntries[dateKey]) {
        groupedEntries[dateKey] = [];
      }
      groupedEntries[dateKey].push(sale);
    });

    res.json({
      entries: upcomingEntries,
      groupedEntries,
      totalCount: upcomingEntries.length,
      dateRange: {
        start: today,
        end: futureDate,
        days: daysNum
      }
    });

  } catch (error) {
    console.error('Upcoming entries error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/sales
// @desc    Satışları listele
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    console.log('🔍 Sales GET request received');
    console.log('User:', req.user?.email);
    console.log('Query params:', req.query);

    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      saleType = '', 
      primStatus = '',
      salesperson = '',
      startDate = '',
      endDate = '',
      primPeriod = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Sayfa ve limit kontrolü
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Base query
    let query = { isDeleted: { $ne: true } };

    // Kullanıcı rolüne göre erişim kontrolü
    if (req.user.role === 'admin') {
      // Admin tüm satışları görebilir
    } else if (req.user.role === 'visitor') {
      // Ziyaretçi tüm satışları görebilir ama düzenleyemez
    } else {
      // Normal kullanıcı sadece kendi satışlarını görebilir
      query.salesperson = req.user._id;
    }

    // Arama filtresi
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { customerName: searchRegex },
        { contractNo: searchRegex },
        { blockNo: searchRegex },
        { apartmentNo: searchRegex }
      ];
    }

    // Satış türü filtresi
    if (saleType) {
      query.saleType = saleType;
    }

    // Prim durumu filtresi
    if (primStatus) {
      query.primStatus = primStatus;
    }

    // Temsilci filtresi (sadece admin için)
    if (salesperson && req.user.role === 'admin') {
      query.salesperson = salesperson;
    }

    // Tarih aralığı filtresi
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Günün sonuna kadar

      query.$or = [
        { 
          saleDate: { 
            $gte: start, 
            $lte: end 
          } 
        },
        { 
          kaporaDate: { 
            $gte: start, 
            $lte: end 
          } 
        }
      ];
    }

    // Prim dönemi filtresi
    if (primPeriod) {
      query.primPeriod = primPeriod;
    }

    // Sıralama
    const sortOptions = {};
    const validSortFields = ['createdAt', 'saleDate', 'kaporaDate', 'customerName', 'contractNo', 'primAmount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    sortOptions[sortField] = sortDirection;

    console.log('🔍 Final query:', JSON.stringify(query, null, 2));
    console.log('📊 Sort options:', sortOptions);
    console.log('📄 Pagination:', { page: pageNum, limit: limitNum, skip });

    // Satışları getir
    const salesQuery = Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

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
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
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
    
    // ObjectId kontrolü - bulk route'ları ile çakışmayı önle
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Geçersiz satış ID formatı' });
    }
    
    const sale = await Sale.findById(req.params.id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');
      
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && req.user.role !== 'visitor' && 
        sale.salesperson._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışa erişim yetkiniz yok' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Get sale by ID error:', error);
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
    if (!value || value.trim() === '') {
      throw new Error('Sözleşme no gereklidir');
    }
    
    // Sözleşme no benzersizlik kontrolü (kendi kaydı hariç)
    const existingSale = await Sale.findOne({ 
      contractNo: value.trim(),
      _id: { $ne: req.params.id },
      isDeleted: { $ne: true }
    });
    
    if (existingSale) {
      throw new Error('Bu sözleşme numarası zaten kullanılıyor');
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
    
    // ObjectId kontrolü - bulk route'ları ile çakışmayı önle
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Geçersiz satış ID formatı' });
    }
    console.log('Body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı düzenleme yetkiniz yok' });
    }

    // Güncelleme verilerini hazırla
    const updateData = {};
    const allowedFields = [
      'customerName', 'phone', 'blockNo', 'apartmentNo', 'periodNo', 'contractNo',
      'saleType', 'saleDate', 'kaporaDate', 'listPrice', 'originalListPrice',
      'discountRate', 'discountedListPrice', 'activitySalePrice', 'paymentType'
    ];

    // Prim yeniden hesaplanması gerekip gerekmediğini kontrol et
    let needsPrimRecalculation = false;
    const primAffectingFields = ['saleType', 'saleDate', 'listPrice', 'originalListPrice', 'discountRate', 'discountedListPrice', 'activitySalePrice'];

    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        const newValue = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        
        // Değişiklik var mı kontrol et
        if (sale[field] !== newValue) {
          updateData[field] = newValue;
          
          // Prim hesaplamasını etkileyen alanlar değişti mi?
          if (primAffectingFields.includes(field)) {
            needsPrimRecalculation = true;
          }
        }
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
      console.log('  - Geçerli fiyatlar:', validPrices);
      console.log('  - En düşük fiyat:', basePrimPrice);
      console.log('  - Prim oranı:', currentPrimRate.rate, '%');
      console.log('  - Yeni prim tutarı:', primAmount, 'TL');
    }

    // Güncelleme işlemi
    Object.keys(updateData).forEach(key => {
      sale[key] = updateData[key];
    });

    sale.updatedAt = new Date();
    await sale.save();

    // Güncellenmiş satışı populate et ve döndür
    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log('✅ Satış başarıyla güncellendi:', sale._id);

    res.json({
      message: 'Satış başarıyla güncellendi',
      sale: updatedSale
    });

  } catch (error) {
    console.error('Update sale error:', error);
    
    // Duplicate key error (sözleşme no)
    if (error.code === 11000 && error.keyPattern?.contractNo) {
      return res.status(400).json({ 
        message: 'Bu sözleşme numarası zaten kullanılıyor' 
      });
    }
    
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/cancel
// @desc    Satışı iptal et
// @access  Private
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı iptal etme yetkiniz yok' });
    }

    // Zaten iptal edilmiş mi kontrol et
    if (sale.isCancelled) {
      return res.status(400).json({ message: 'Bu satış zaten iptal edilmiş' });
    }

    sale.isCancelled = true;
    sale.cancelledAt = new Date();
    sale.cancelledBy = req.user._id;
    sale.updatedAt = new Date();

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('cancelledBy', 'name email')
      .populate('primPeriod', 'name');

    console.log('🚫 Satış iptal edildi:', req.user.email, 'Sale ID:', req.params.id);

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
// @desc    İptal edilmiş satışı geri al
// @access  Private
router.put('/:id/restore', auth, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı geri alma yetkiniz yok' });
    }

    // İptal edilmiş mi kontrol et
    if (!sale.isCancelled) {
      return res.status(400).json({ message: 'Bu satış zaten aktif durumda' });
    }

    sale.isCancelled = false;
    sale.cancelledAt = null;
    sale.cancelledBy = null;
    sale.updatedAt = new Date();

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log('♻️ Satış geri alındı:', req.user.email, 'Sale ID:', req.params.id);

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
// @desc    Satışı başka temsilciye transfer et (Admin only)
// @access  Private (Admin only)
router.put('/:id/transfer', [auth, adminAuth], [
  body('newSalespersonId').isMongoId().withMessage('Geçerli bir temsilci seçiniz'),
  body('transferReason').optional().trim().isLength({ min: 1 }).withMessage('Transfer nedeni gereklidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newSalespersonId, transferReason } = req.body;

    const sale = await Sale.findById(req.params.id)
      .populate('salesperson', 'name email');
    
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Yeni temsilciyi kontrol et
    const newSalesperson = await User.findById(newSalespersonId);
    if (!newSalesperson || newSalesperson.role !== 'salesperson') {
      return res.status(404).json({ message: 'Geçerli bir satış temsilcisi bulunamadı' });
    }

    // Aynı temsilciye transfer kontrolü
    if (sale.salesperson._id.toString() === newSalespersonId) {
      return res.status(400).json({ message: 'Satış zaten bu temsilciye ait' });
    }

    const oldSalesperson = sale.salesperson;

    // Transfer işlemi
    sale.salesperson = newSalespersonId;
    sale.transferHistory = sale.transferHistory || [];
    sale.transferHistory.push({
      fromSalesperson: oldSalesperson._id,
      toSalesperson: newSalespersonId,
      transferredBy: req.user._id,
      transferredAt: new Date(),
      reason: transferReason || 'Belirtilmedi'
    });
    sale.updatedAt = new Date();

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .populate('transferHistory.fromSalesperson', 'name email')
      .populate('transferHistory.toSalesperson', 'name email')
      .populate('transferHistory.transferredBy', 'name email');

    console.log('🔄 Satış transfer edildi:', {
      admin: req.user.email,
      saleId: req.params.id,
      from: oldSalesperson.name,
      to: newSalesperson.name,
      reason: transferReason
    });

    res.json({
      message: `Satış ${oldSalesperson.name} temsilcisinden ${newSalesperson.name} temsilcisine transfer edildi`,
      sale: updatedSale
    });

  } catch (error) {
    console.error('Transfer sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
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
    // ObjectId kontrolü - bulk route'ları ile çakışmayı önle
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Geçersiz satış ID formatı' });
    }
    
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    console.log('🗑️ Admin satış siliyor:', req.user.email, 'Sale ID:', req.params.id);

    // Soft delete yerine hard delete
    await Sale.findByIdAndDelete(req.params.id);

    res.json({ message: 'Satış başarıyla silindi' });
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/notes
// @desc    Satış notlarını güncelle
// @access  Private
router.put('/:id/notes', auth, async (req, res) => {
  try {
    const { notes } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışın notlarını düzenleme yetkiniz yok' });
    }

    sale.notes = notes || '';
    sale.updatedAt = new Date();
    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Notlar başarıyla güncellendi',
      sale: updatedSale
    });

  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/sales/:id/notes
// @desc    Satış notlarını sil
// @access  Private
router.delete('/:id/notes', auth, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışın notlarını silme yetkiniz yok' });
    }

    sale.notes = '';
    sale.updatedAt = new Date();
    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Notlar başarıyla silindi',
      sale: updatedSale
    });

  } catch (error) {
    console.error('Delete notes error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/convert-to-sale
// @desc    Kaporayı satışa çevir
// @access  Private
router.put('/:id/convert-to-sale', auth, async (req, res) => {
  try {
    const { saleDate, paymentType } = req.body;

    if (!saleDate || !saleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ message: 'Geçerli bir satış tarihi giriniz (YYYY-MM-DD)' });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı düzenleme yetkiniz yok' });
    }

    // Kapora kontrolü
    if (sale.saleType !== 'kapora') {
      return res.status(400).json({ message: 'Bu işlem sadece kapora kayıtları için geçerlidir' });
    }

    // Aktif prim oranını al
    const currentPrimRate = await PrimRate.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (!currentPrimRate) {
      return res.status(400).json({ message: 'Aktif prim oranı bulunamadı' });
    }

    // Prim dönemini belirle
    const primPeriodId = await getOrCreatePrimPeriod(saleDate, req.user._id);

    // Prim hesaplama
    const originalListPriceNum = parseFloat(sale.originalListPrice || sale.listPrice) || 0;
    const discountRateNum = parseFloat(sale.discountRate) || 0;
    const activitySalePriceNum = parseFloat(sale.activitySalePrice) || 0;

    let discountedListPriceNum = 0;
    if (discountRateNum > 0 && originalListPriceNum > 0) {
      discountedListPriceNum = originalListPriceNum * (1 - discountRateNum / 100);
    }

    const validPrices = [];
    if (originalListPriceNum > 0) validPrices.push(originalListPriceNum);
    if (discountRateNum > 0 && discountedListPriceNum > 0) validPrices.push(discountedListPriceNum);
    if (activitySalePriceNum > 0) validPrices.push(activitySalePriceNum);

    const basePrimPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
    const primAmount = basePrimPrice * (currentPrimRate.rate / 100);

    // Satışa çevir
    sale.saleType = 'satis';
    sale.saleDate = saleDate;
    sale.paymentType = paymentType || sale.paymentType;
    sale.primRate = currentPrimRate.rate;
    sale.basePrimPrice = basePrimPrice;
    sale.primAmount = primAmount;
    sale.primPeriod = primPeriodId;
    sale.primStatus = 'ödenmedi';
    sale.discountedListPrice = discountedListPriceNum;
    sale.updatedAt = new Date();

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log('🔄 Kapora satışa çevrildi:', req.user.email, 'Sale ID:', req.params.id);

    res.json({
      message: 'Kapora başarıyla satışa çevrildi',
      sale: updatedSale
    });

  } catch (error) {
    console.error('Convert to sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/transaction/:transactionId/period
// @desc    Satış işleminin prim dönemini güncelle (Admin only)
// @access  Private (Admin only)
router.put('/transaction/:transactionId/period', [auth, adminAuth], [
  body('newPeriodId').isMongoId().withMessage('Geçerli bir dönem seçiniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newPeriodId } = req.body;
    const { transactionId } = req.params;

    // Satışı bul
    const sale = await Sale.findById(transactionId)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    if (!sale) {
      return res.status(404).json({ message: 'Satış işlemi bulunamadı' });
    }

    // Yeni dönemi kontrol et
    const newPeriod = await PrimPeriod.findById(newPeriodId);
    if (!newPeriod) {
      return res.status(404).json({ message: 'Seçilen dönem bulunamadı' });
    }

    const oldPeriod = sale.primPeriod;

    // Dönem güncelle
    sale.primPeriod = newPeriodId;
    sale.updatedAt = new Date();
    await sale.save();

    // Güncellenmiş satışı getir
    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    console.log('📅 Prim dönemi güncellendi:', {
      admin: req.user.email,
      saleId: transactionId,
      oldPeriod: oldPeriod?.name,
      newPeriod: newPeriod.name
    });

    res.json({
      message: `Prim dönemi "${oldPeriod?.name || 'Belirsiz'}" döneminden "${newPeriod.name}" dönemine güncellendi`,
      sale: updatedSale
    });

  } catch (error) {
    console.error('Update transaction period error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/:id/modify
// @desc    Satış modifikasyonu (fiyat değişikliği)
// @access  Private
router.put('/:id/modify', [
  auth,
  body('modificationType').isIn(['price_increase', 'price_decrease', 'other']).withMessage('Geçerli bir modifikasyon türü seçiniz'),
  body('newListPrice').isNumeric().withMessage('Yeni liste fiyatı sayısal olmalıdır'),
  body('modificationReason').trim().isLength({ min: 1 }).withMessage('Modifikasyon nedeni gereklidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { modificationType, newListPrice, modificationReason, newActivitySalePrice } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Erişim kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı modifiye etme yetkiniz yok' });
    }

    const oldListPrice = sale.listPrice;
    const oldActivitySalePrice = sale.activitySalePrice;

    // Modifikasyon geçmişi
    sale.modificationHistory = sale.modificationHistory || [];
    sale.modificationHistory.push({
      modificationType,
      oldListPrice,
      newListPrice: parseFloat(newListPrice),
      oldActivitySalePrice,
      newActivitySalePrice: parseFloat(newActivitySalePrice) || 0,
      reason: modificationReason,
      modifiedBy: req.user._id,
      modifiedAt: new Date()
    });

    // Yeni fiyatları uygula
    sale.listPrice = parseFloat(newListPrice);
    if (newActivitySalePrice) {
      sale.activitySalePrice = parseFloat(newActivitySalePrice);
    }

    // Prim yeniden hesaplama (kapora değilse)
    if (!isKaporaType(sale.saleType)) {
      const currentPrimRate = await PrimRate.findOne({ isActive: true }).sort({ createdAt: -1 });
      if (currentPrimRate) {
        const originalListPriceNum = parseFloat(sale.originalListPrice || sale.listPrice) || 0;
        const discountRateNum = parseFloat(sale.discountRate) || 0;
        const activitySalePriceNum = parseFloat(sale.activitySalePrice) || 0;

        let discountedListPriceNum = 0;
        if (discountRateNum > 0 && originalListPriceNum > 0) {
          discountedListPriceNum = originalListPriceNum * (1 - discountRateNum / 100);
          sale.discountedListPrice = discountedListPriceNum;
        }

        const validPrices = [];
        if (originalListPriceNum > 0) validPrices.push(originalListPriceNum);
        if (discountRateNum > 0 && discountedListPriceNum > 0) validPrices.push(discountedListPriceNum);
        if (activitySalePriceNum > 0) validPrices.push(activitySalePriceNum);

        const basePrimPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
        const primAmount = basePrimPrice * (currentPrimRate.rate / 100);

        sale.primRate = currentPrimRate.rate;
        sale.basePrimPrice = basePrimPrice;
        sale.primAmount = primAmount;
      }
    }

    sale.updatedAt = new Date();
    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .populate('modificationHistory.modifiedBy', 'name email');

    console.log('🔧 Satış modifiye edildi:', {
      user: req.user.email,
      saleId: req.params.id,
      type: modificationType,
      oldPrice: oldListPrice,
      newPrice: newListPrice,
      reason: modificationReason
    });

    res.json({
      message: 'Satış başarıyla modifiye edildi',
      sale: updatedSale
    });

  } catch (error) {
    console.error('Sale modification error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/sales/bulk-prim-status
// @desc    Toplu prim durumu güncelle
// @access  Private (Admin only)
router.put('/bulk-prim-status', [auth, adminAuth], async (req, res) => {
  try {
    const { primStatus, filters } = req.body;

    // Validasyon
    if (!primStatus || !['ödendi', 'ödenmedi'].includes(primStatus)) {
      return res.status(400).json({ 
        message: 'Geçerli prim durumu belirtilmeli (ödendi/ödenmedi)' 
      });
    }

    // Query oluştur
    let query = { saleType: 'satis' }; // Sadece satışlar

    // Dönem filtresi
    if (filters.period) {
      query.primPeriod = new mongoose.Types.ObjectId(filters.period);
    }

    // Temsilci filtresi
    if (filters.salesperson) {
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: filters.salesperson,
        isActive: true,
        isApproved: true
      });
      
      if (!user) {
        return res.status(404).json({ 
          message: `"${filters.salesperson}" isimli temsilci bulunamadı` 
        });
      }
      
      query.salesperson = user._id;
    }

    // Tarih filtresi
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query.saleDate = { $gte: startDate, $lte: endDate };
    } else if (filters.month && filters.year) {
      const year = parseInt(filters.year);
      const month = parseInt(filters.month) - 1;
      
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      query.saleDate = { $gte: startDate, $lte: endDate };
    }

    // Güncelleme işlemi
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

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ 
        message: 'Belirtilen kriterlere uygun satış bulunamadı' 
      });
    }

    // Activity log
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user: req.user._id,
        action: 'bulk_prim_status_update',
        details: `${updateResult.modifiedCount} satışın prim durumu "${primStatus}" olarak güncellendi`,
        metadata: { filters, primStatus, affectedCount: updateResult.modifiedCount }
      });
    } catch (logError) {
      // Log hatası kritik değil
    }

    res.json({
      success: true,
      message: `${updateResult.modifiedCount} satışın prim durumu "${primStatus}" olarak güncellendi`,
      summary: {
        totalUpdated: updateResult.modifiedCount,
        newStatus: primStatus
      }
    });

  } catch (error) {
    console.error('Bulk prim status update error:', error);
    res.status(500).json({ 
      message: 'Toplu prim durumu güncellenirken hata oluştu',
      error: error.message 
    });
  }
});

// @route   POST /api/sales/bulk-prim-status/preview
// @desc    Toplu prim durumu önizleme
// @access  Private (Admin only)
router.post('/bulk-prim-status/preview', [auth, adminAuth], async (req, res) => {
  try {
    const { primStatus, filters } = req.body;

    // Validasyon
    if (!primStatus || !['ödendi', 'ödenmedi'].includes(primStatus)) {
      return res.status(400).json({ 
        message: 'Geçerli prim durumu belirtilmeli (ödendi/ödenmedi)' 
      });
    }

    // Query oluştur (aynı mantık)
    let query = { saleType: 'satis' };

    if (filters.period) {
      query.primPeriod = new mongoose.Types.ObjectId(filters.period);
    }

    if (filters.salesperson) {
      const User = require('../models/User');
      const user = await User.findOne({ 
        name: filters.salesperson,
        isActive: true,
        isApproved: true
      });
      
      if (!user) {
        return res.status(404).json({ 
          message: `"${filters.salesperson}" isimli temsilci bulunamadı` 
        });
      }
      
      query.salesperson = user._id;
    }

    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      query.saleDate = { $gte: startDate, $lte: endDate };
    } else if (filters.month && filters.year) {
      const year = parseInt(filters.year);
      const month = parseInt(filters.month) - 1;
      
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      
      query.saleDate = { $gte: startDate, $lte: endDate };
    }

    // Etkilenecek satışları bul
    const totalCount = await Sale.countDocuments(query);
    
    if (totalCount === 0) {
      return res.status(404).json({ 
        message: 'Belirtilen kriterlere uygun satış bulunamadı' 
      });
    }

    const sampleSales = await Sale.find(query)
      .populate('salesperson', 'name')
      .populate('primPeriod', 'name')
      .select('customerName contractNo primAmount primStatus salesperson primPeriod saleDate')
      .limit(50)
      .sort({ saleDate: -1 });

    res.json({
      success: true,
      message: `${totalCount} satış etkilenecek`,
      summary: {
        totalUpdated: totalCount,
        newStatus: primStatus,
        affectedSales: sampleSales.map(sale => ({
          id: sale._id,
          customerName: sale.customerName,
          contractNo: sale.contractNo,
          primAmount: sale.primAmount,
          oldStatus: sale.primStatus,
          salesperson: sale.salesperson?.name,
          period: sale.primPeriod?.name,
          saleDate: sale.saleDate
        }))
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      message: 'Önizleme yüklenirken hata oluştu',
      error: error.message 
    });
  }
});

module.exports = router;