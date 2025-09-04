const express = require('express');
const { body, validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const PrimRate = require('../models/PrimRate');
const PrimPeriod = require('../models/PrimPeriod');
const PrimTransaction = require('../models/PrimTransaction');
const PaymentMethod = require('../models/PaymentMethod');
const { auth, adminAuth } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// Ödeme tipi validasyonu için custom validator
const validatePaymentType = async (value) => {
  if (!value || value === '') return true; // Optional field
  
  try {
    const activePaymentMethods = await PaymentMethod.find({ isActive: true }).select('name');
    const validPaymentTypes = activePaymentMethods.map(method => method.name);
    
    // Eğer PaymentMethod tablosu boşsa, varsayılan değerleri kabul et
    if (validPaymentTypes.length === 0) {
      const defaultTypes = ['Nakit', 'Kredi', 'Taksit', 'Diğer'];
      return defaultTypes.includes(value);
    }
    
    if (!validPaymentTypes.includes(value)) {
      throw new Error(`Geçersiz ödeme tipi. Geçerli değerler: ${validPaymentTypes.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error('Payment type validation error:', error);
    // Hata durumunda varsayılan değerleri kabul et
    const defaultTypes = ['Nakit', 'Kredi', 'Taksit', 'Diğer'];
    return defaultTypes.includes(value);
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

// @route   POST /api/sales
// @desc    Yeni satış ekle
// @access  Private
router.post('/', auth, [
  body('customerName').trim().notEmpty().withMessage('Müşteri adı soyadı gereklidir'),
  body('blockNo').trim().notEmpty().withMessage('Blok no gereklidir'),
  body('apartmentNo').trim().notEmpty().withMessage('Daire no gereklidir'),
  body('periodNo').trim().notEmpty().withMessage('Dönem no gereklidir'),
  body('contractNo').trim().isLength({ min: 1, max: 10 }).withMessage('Sözleşme no 1-10 karakter arasında olmalıdır'),
  body('saleType').isIn(['kapora', 'satis']).withMessage('Geçerli bir satış tipi seçiniz'),
  // Koşullu validasyonlar
  body('saleDate').if(body('saleType').equals('satis')).isISO8601().withMessage('Geçerli bir satış tarihi giriniz'),
  body('kaporaDate').if(body('saleType').equals('kapora')).isISO8601().withMessage('Geçerli bir kapora tarihi giriniz'),
  body('listPrice').if(body('saleType').equals('satis')).isFloat({ min: 0 }).withMessage('Liste fiyatı 0\'dan büyük olmalıdır'),
  body('activitySalePrice').if(body('saleType').equals('satis')).isFloat({ min: 0 }).withMessage('Aktivite satış fiyatı 0\'dan büyük olmalıdır'),
  body('paymentType').if(body('saleType').equals('satis')).custom(validatePaymentType)
], async (req, res) => {
  try {
    console.log('🔍 Sale POST request received');
    console.log('User:', req.user?.email);
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

    const {
      customerName, blockNo, apartmentNo, periodNo, saleDate, kaporaDate,
      contractNo, listPrice, activitySalePrice, paymentType, saleType,
      entryDate, exitDate, notes, discountRate, originalListPrice, discountedListPrice
    } = req.body;

    // Sözleşme no kontrolü
    const existingSale = await Sale.findOne({ contractNo });
    if (existingSale) {
      return res.status(400).json({ message: 'Bu sözleşme numarası ile kayıtlı satış bulunmaktadır' });
    }

    let currentPrimRate, primPeriodId, listPriceNum, activitySalePriceNum, basePrimPrice, primAmount;
    
    // Değişkenleri global scope'da tanımla
    const originalListPriceNum = parseFloat(originalListPrice || listPrice) || 0;
    const discountRateNum = parseFloat(discountRate) || 0;
    let discountedListPriceNum = 0;

    // Kapora değilse prim hesapla
    if (saleType === 'satis') {
      // Aktif prim oranını al
      currentPrimRate = await PrimRate.findOne({ isActive: true }).sort({ createdAt: -1 });
      if (!currentPrimRate) {
        return res.status(400).json({ message: 'Aktif prim oranı bulunamadı' });
      }

      // Prim dönemini belirle
      primPeriodId = await getOrCreatePrimPeriod(saleDate, req.user._id);

      // İndirim hesaplama
      if (discountRateNum > 0 && originalListPriceNum > 0) {
        discountedListPriceNum = parseFloat(discountedListPrice) || (originalListPriceNum * (1 - discountRateNum / 100));
        console.log(`💸 İndirim uygulandı: %${discountRateNum} - ${originalListPriceNum} TL → ${discountedListPriceNum} TL`);
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
      primAmount = basePrimPrice * currentPrimRate.rate;

      console.log('💰 Prim hesaplama:');
      console.log('Orijinal liste fiyatı:', originalListPriceNum);
      console.log('İndirim oranı:', discountRateNum + '%');
      console.log('İndirimli liste fiyatı:', discountedListPriceNum);
      console.log('Aktivite fiyatı:', activitySalePriceNum);
      console.log('Geçerli fiyatlar:', validPrices);
      console.log('Base prim fiyatı:', basePrimPrice);
      console.log('Prim oranı:', currentPrimRate.rate);
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
    if (saleType === 'satis') {
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

    const sale = new Sale(saleData);

    await sale.save();

    // Sadece normal satış için prim işlemi kaydet
    if (saleType === 'satis') {
      const primTransaction = new PrimTransaction({
        salesperson: req.user._id,
        sale: sale._id,
        primPeriod: primPeriodId,
        transactionType: 'kazanç',
        amount: sale.primAmount,
        description: `${contractNo} sözleşme numaralı satış primi`,
        createdBy: req.user._id
      });

      await primTransaction.save();
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

// @route   GET /api/sales
// @desc    Satışları listele
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'aktif', search, period } = req.query;
    
    let query = { status };
    
    // Admin değilse sadece kendi satışlarını görsün
    if (req.user.role !== 'admin') {
      query.salesperson = req.user._id;
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

    const sales = await Sale.find(query)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Sale.countDocuments(query);

    res.json({
      sales,
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
  body('blockNo').optional().trim().isLength({ min: 1 }).withMessage('Blok no gereklidir'),
  body('apartmentNo').optional().trim().isLength({ min: 1 }).withMessage('Daire no gereklidir'),
  body('periodNo').optional().trim().isLength({ min: 1 }).withMessage('Dönem no gereklidir'),
  body('contractNo').optional().trim().isLength({ min: 1, max: 10 }).withMessage('Sözleşme no 1-10 karakter arasında olmalıdır'),
  body('saleType').optional().isIn(['kapora', 'satis']).withMessage('Geçerli bir satış tipi seçiniz'),
  body('saleDate').optional().custom((value, { req }) => {
    if (!value) return true; // Optional field
    if (req.body.saleType === 'satis' && !value) {
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
    if (sale.saleType === 'satis' || updates.saleType === 'satis') {
      // Prim etkileyecek alanlar değişti mi?
      if (updates.listPrice !== undefined || updates.activitySalePrice !== undefined || 
          updates.discountRate !== undefined || updates.originalListPrice !== undefined || 
          updates.discountedListPrice !== undefined) {
        needsPrimRecalculation = true;
      }
    }

    // Güncelleme işlemi
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        sale[key] = updates[key];
      }
    });

    // Prim yeniden hesaplama
    if (needsPrimRecalculation && sale.saleType === 'satis') {
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
      const primAmount = basePrimPrice * currentPrimRate.rate;

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
      // Prim ödenmişse kesinti işlemi oluştur - İPTAL TARİHİNE GÖRE DÖNEM BELİRLE
      console.log('💸 Prim ödendi - Kesinti transaction ekleniyor (iptal tarihine göre dönem)');
      
      // İptal işlemi yapılan tarihe göre dönem oluştur/bul
      const cancelDate = new Date(); // Şu anki tarih (iptal tarihi)
      const cancelPeriodId = await getOrCreatePrimPeriod(cancelDate.toISOString().split('T')[0], req.user._id);
      
      const primTransaction = new PrimTransaction({
        salesperson: sale.salesperson,
        sale: sale._id,
        primPeriod: cancelPeriodId, // İptal tarihinin dönemi
        transactionType: 'kesinti',
        amount: -sale.primAmount,
        description: `${sale.contractNo} sözleşme iptal kesintisi (${sale.cancelledAt ? sale.cancelledAt.toLocaleDateString('tr-TR') : 'bugün'})`,
        createdBy: req.user._id
      });
      await primTransaction.save();
      
      console.log(`✅ Kesinti eklendi: ${sale.primAmount} TL - Dönem: ${cancelPeriodId}`);
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
    if (sale.saleType === 'satis') {
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

    if (sale.saleType !== 'kapora') {
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
    const primAmount = (basePrimPrice * currentPrimRate.rate) / 100;

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

module.exports = router;
