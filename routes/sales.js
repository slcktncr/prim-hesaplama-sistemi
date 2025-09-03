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
  body('contractNo').trim().isLength({ min: 6, max: 6 }).withMessage('Sözleşme no tam olarak 6 hane olmalıdır'),
  body('listPrice').isFloat({ min: 0 }).withMessage('Liste fiyatı 0\'dan büyük olmalıdır'),
  body('activitySalePrice').isFloat({ min: 0 }).withMessage('Aktivite satış fiyatı 0\'dan büyük olmalıdır'),
  body('paymentType').isIn(['Nakit', 'Kredi', 'Taksit', 'Diğer']).withMessage('Geçerli bir ödeme tipi seçiniz')
], async (req, res) => {
  try {
    console.log('🔍 Sale POST request received');
    console.log('User:', req.user?.email);
    console.log('Body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
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

    // Prim hesaplama
    const listPriceNum = parseFloat(listPrice);
    const activitySalePriceNum = parseFloat(activitySalePrice);
    const basePrimPrice = Math.min(listPriceNum, activitySalePriceNum);
    const primAmount = (basePrimPrice * currentPrimRate.rate) / 100;

    console.log('💰 Prim hesaplama:');
    console.log('Liste fiyatı:', listPriceNum);
    console.log('Aktivite fiyatı:', activitySalePriceNum);
    console.log('Base prim fiyatı:', basePrimPrice);
    console.log('Prim oranı:', currentPrimRate.rate);
    console.log('Hesaplanan prim:', primAmount);

    // Yeni satış oluştur
    const sale = new Sale({
      customerName,
      blockNo,
      apartmentNo,
      periodNo,
      saleDate,
      contractNo,
      listPrice: listPriceNum,
      activitySalePrice: activitySalePriceNum,
      paymentType,
      salesperson: req.user._id,
      primRate: currentPrimRate.rate,
      basePrimPrice,
      primAmount,
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
      // Prim ödenmişse kesinti işlemi oluştur
      console.log('💸 Prim ödendi - Kesinti transaction ekleniyor');
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

module.exports = router;
