const express = require('express');
const { body, validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const PrimRate = require('../models/PrimRate');
const PrimPeriod = require('../models/PrimPeriod');
const PrimTransaction = require('../models/PrimTransaction');
const { auth, adminAuth } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

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
  body('saleDate').isISO8601().withMessage('Geçerli bir satış tarihi giriniz'),
  body('contractNo').trim().notEmpty().withMessage('Sözleşme no gereklidir'),
  body('listPrice').isFloat({ min: 0 }).withMessage('Liste fiyatı 0\'dan büyük olmalıdır'),
  body('activitySalePrice').isFloat({ min: 0 }).withMessage('Aktivite satış fiyatı 0\'dan büyük olmalıdır'),
  body('paymentType').isIn(['Nakit', 'Kredi', 'Taksit', 'Diğer']).withMessage('Geçerli bir ödeme tipi seçiniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customerName, blockNo, apartmentNo, periodNo, saleDate,
      contractNo, listPrice, activitySalePrice, paymentType
    } = req.body;

    // Sözleşme no kontrolü
    const existingSale = await Sale.findOne({ contractNo });
    if (existingSale) {
      return res.status(400).json({ message: 'Bu sözleşme numarası ile kayıtlı satış bulunmaktadır' });
    }

    // Aktif prim oranını al
    const currentPrimRate = await PrimRate.findOne({ isActive: true }).sort({ createdAt: -1 });
    if (!currentPrimRate) {
      return res.status(400).json({ message: 'Aktif prim oranı bulunamadı' });
    }

    // Prim dönemini belirle
    const primPeriodId = await getOrCreatePrimPeriod(saleDate, req.user._id);

    // Yeni satış oluştur
    const sale = new Sale({
      customerName,
      blockNo,
      apartmentNo,
      periodNo,
      saleDate,
      contractNo,
      listPrice: parseFloat(listPrice),
      activitySalePrice: parseFloat(activitySalePrice),
      paymentType,
      salesperson: req.user._id,
      primRate: currentPrimRate.rate,
      primPeriod: primPeriodId
    });

    await sale.save();

    // Prim işlemi kaydet
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

    // Populate ile döndür
    const populatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.status(201).json({
      message: 'Satış başarıyla eklendi',
      sale: populatedSale
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
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

// @route   PUT /api/sales/:id
// @desc    Satış güncelle
// @access  Private
router.put('/:id', auth, [
  body('customerName').optional().trim().notEmpty().withMessage('Müşteri adı soyadı gereklidir'),
  body('blockNo').optional().trim().notEmpty().withMessage('Blok no gereklidir'),
  body('apartmentNo').optional().trim().notEmpty().withMessage('Daire no gereklidir'),
  body('listPrice').optional().isFloat({ min: 0 }).withMessage('Liste fiyatı 0\'dan büyük olmalıdır'),
  body('activitySalePrice').optional().isFloat({ min: 0 }).withMessage('Aktivite satış fiyatı 0\'dan büyük olmalıdır'),
  body('paymentType').optional().isIn(['Nakit', 'Kredi', 'Taksit', 'Diğer']).withMessage('Geçerli bir ödeme tipi seçiniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    // Yetki kontrolü
    if (req.user.role !== 'admin' && sale.salesperson.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bu satışı düzenleme yetkiniz bulunmamaktadır' });
    }

    // Güncelleme
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        sale[key] = updates[key];
      }
    });

    await sale.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Satış başarıyla güncellendi',
      sale: updatedSale
    });
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
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

    // Eğer prim ödenmişse kesinti işlemi oluştur
    if (sale.primStatus === 'ödendi') {
      const primTransaction = new PrimTransaction({
        salesperson: sale.salesperson,
        sale: sale._id,
        primPeriod: sale.primPeriod,
        transactionType: 'kesinti',
        amount: -sale.primAmount,
        description: `${sale.contractNo} sözleşme iptal kesintisi`,
        createdBy: req.user._id
      });
      await primTransaction.save();
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

    // Yeni prim işlemi oluştur
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newSalesperson } = req.body;

    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: 'Satış bulunamadı' });
    }

    if (sale.salesperson.toString() === newSalesperson) {
      return res.status(400).json({ message: 'Satış zaten bu temsilciye ait' });
    }

    const oldSalesperson = sale.salesperson;

    // Transfer işlemi
    sale.transferredFrom = oldSalesperson;
    sale.salesperson = newSalesperson;
    sale.transferredAt = new Date();
    sale.transferredBy = req.user._id;
    await sale.save();

    // Eski temsilciden kesinti
    const deductionTransaction = new PrimTransaction({
      salesperson: oldSalesperson,
      sale: sale._id,
      primPeriod: sale.primPeriod,
      transactionType: 'transfer_giden',
      amount: -sale.primAmount,
      description: `${sale.contractNo} sözleşme transfer kesintisi`,
      createdBy: req.user._id
    });
    await deductionTransaction.save();

    // Yeni temsilciye ekleme
    const additionTransaction = new PrimTransaction({
      salesperson: newSalesperson,
      sale: sale._id,
      primPeriod: sale.primPeriod,
      transactionType: 'transfer_gelen',
      amount: sale.primAmount,
      description: `${sale.contractNo} sözleşme transfer kazancı`,
      createdBy: req.user._id,
      relatedTransaction: deductionTransaction._id
    });
    await additionTransaction.save();

    const updatedSale = await Sale.findById(sale._id)
      .populate('salesperson', 'name email')
      .populate('transferredFrom', 'name email')
      .populate('primPeriod', 'name');

    res.json({
      message: 'Satış başarıyla transfer edildi',
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

module.exports = router;
