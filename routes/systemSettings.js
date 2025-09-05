const express = require('express');
const { body, validationResult } = require('express-validator');
const SaleType = require('../models/SaleType');
const PaymentType = require('../models/PaymentType');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// ========== SATIŞ TÜRLERİ ==========

// @route   GET /api/system-settings/sale-types
// @desc    Satış türlerini listele
// @access  Private (Admin only)
router.get('/sale-types', [auth, adminAuth], async (req, res) => {
  try {
    const saleTypes = await SaleType.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(saleTypes);
  } catch (error) {
    console.error('Get sale types error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/system-settings/sale-types
// @desc    Yeni satış türü oluştur
// @access  Private (Admin only)
router.post('/sale-types', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('Satış türü adı gereklidir'),
  body('name').isLength({ max: 50 }).withMessage('Satış türü adı 50 karakterden uzun olamaz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { name, description, isDefault, color, sortOrder, requiredFields } = req.body;

    // Aynı isimde kayıt var mı kontrol et
    const existingSaleType = await SaleType.findOne({ name: name.trim() });
    if (existingSaleType) {
      return res.status(400).json({ message: 'Bu isimde bir satış türü zaten mevcut' });
    }

    const saleType = new SaleType({
      name: name.trim(),
      description: description?.trim(),
      isDefault: isDefault || false,
      color: color || 'success',
      sortOrder: sortOrder || 0,
      requiredFields: requiredFields || {
        contractNo: true,
        listPrice: true,
        activitySalePrice: true,
        paymentType: true,
        saleDate: true,
        kaporaDate: false
      },
      createdBy: req.user._id
    });

    await saleType.save();

    const populatedSaleType = await SaleType.findById(saleType._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Satış türü başarıyla oluşturuldu',
      saleType: populatedSaleType
    });
  } catch (error) {
    console.error('Create sale type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/system-settings/sale-types/:id
// @desc    Satış türünü güncelle
// @access  Private (Admin only)
router.put('/sale-types/:id', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('Satış türü adı gereklidir'),
  body('name').isLength({ max: 50 }).withMessage('Satış türü adı 50 karakterden uzun olamaz')
], async (req, res) => {
  try {
    console.log('🔍 Sale type update request:', {
      id: req.params.id,
      body: req.body,
      user: req.user?.email
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { name, description, isActive, isDefault, color, sortOrder, requiredFields } = req.body;

    const saleType = await SaleType.findById(req.params.id);
    if (!saleType) {
      return res.status(404).json({ message: 'Satış türü bulunamadı' });
    }

    // Aynı isimde başka kayıt var mı kontrol et
    const existingSaleType = await SaleType.findOne({ 
      name: name.trim(),
      _id: { $ne: req.params.id }
    });
    if (existingSaleType) {
      return res.status(400).json({ message: 'Bu isimde bir satış türü zaten mevcut' });
    }

    saleType.name = name.trim();
    saleType.description = description?.trim();
    saleType.isActive = isActive;
    saleType.isDefault = isDefault || false;
    
    // Yeni alanları güncelle
    if (color) {
      saleType.color = color;
    }
    if (typeof sortOrder === 'number') {
      saleType.sortOrder = sortOrder;
    }
    if (requiredFields && typeof requiredFields === 'object') {
      saleType.requiredFields = {
        ...saleType.requiredFields,
        ...requiredFields
      };
    }

    console.log('💾 Saving sale type with data:', {
      name: saleType.name,
      color: saleType.color,
      sortOrder: saleType.sortOrder,
      requiredFields: saleType.requiredFields
    });

    await saleType.save();

    const populatedSaleType = await SaleType.findById(saleType._id)
      .populate('createdBy', 'name email');

    res.json({
      message: 'Satış türü başarıyla güncellendi',
      saleType: populatedSaleType
    });
  } catch (error) {
    console.error('Update sale type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/system-settings/sale-types/:id
// @desc    Satış türünü sil
// @access  Private (Admin only)
router.delete('/sale-types/:id', [auth, adminAuth], async (req, res) => {
  try {
    const saleType = await SaleType.findById(req.params.id);
    if (!saleType) {
      return res.status(404).json({ message: 'Satış türü bulunamadı' });
    }

    // Default satış türü silinemez
    if (saleType.isDefault) {
      return res.status(400).json({ message: 'Varsayılan satış türü silinemez' });
    }

    await SaleType.findByIdAndDelete(req.params.id);

    res.json({ message: 'Satış türü başarıyla silindi' });
  } catch (error) {
    console.error('Delete sale type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// ========== ÖDEME TİPLERİ ==========

// @route   GET /api/system-settings/payment-types
// @desc    Ödeme tiplerini listele
// @access  Private (Admin only)
router.get('/payment-types', [auth, adminAuth], async (req, res) => {
  try {
    const paymentTypes = await PaymentType.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(paymentTypes);
  } catch (error) {
    console.error('Get payment types error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/system-settings/payment-types
// @desc    Yeni ödeme tipi oluştur
// @access  Private (Admin only)
router.post('/payment-types', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('Ödeme tipi adı gereklidir'),
  body('name').isLength({ max: 50 }).withMessage('Ödeme tipi adı 50 karakterden uzun olamaz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { name, description, isDefault } = req.body;

    // Aynı isimde kayıt var mı kontrol et
    const existingPaymentType = await PaymentType.findOne({ name: name.trim() });
    if (existingPaymentType) {
      return res.status(400).json({ message: 'Bu isimde bir ödeme tipi zaten mevcut' });
    }

    const paymentType = new PaymentType({
      name: name.trim(),
      description: description?.trim(),
      isDefault: isDefault || false,
      createdBy: req.user._id
    });

    await paymentType.save();

    const populatedPaymentType = await PaymentType.findById(paymentType._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Ödeme tipi başarıyla oluşturuldu',
      paymentType: populatedPaymentType
    });
  } catch (error) {
    console.error('Create payment type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/system-settings/payment-types/:id
// @desc    Ödeme tipini güncelle
// @access  Private (Admin only)
router.put('/payment-types/:id', [
  auth,
  adminAuth,
  body('name').notEmpty().withMessage('Ödeme tipi adı gereklidir'),
  body('name').isLength({ max: 50 }).withMessage('Ödeme tipi adı 50 karakterden uzun olamaz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { name, description, isActive, isDefault } = req.body;

    const paymentType = await PaymentType.findById(req.params.id);
    if (!paymentType) {
      return res.status(404).json({ message: 'Ödeme tipi bulunamadı' });
    }

    // Aynı isimde başka kayıt var mı kontrol et
    const existingPaymentType = await PaymentType.findOne({ 
      name: name.trim(),
      _id: { $ne: req.params.id }
    });
    if (existingPaymentType) {
      return res.status(400).json({ message: 'Bu isimde bir ödeme tipi zaten mevcut' });
    }

    paymentType.name = name.trim();
    paymentType.description = description?.trim();
    paymentType.isActive = isActive;
    paymentType.isDefault = isDefault || false;

    await paymentType.save();

    const populatedPaymentType = await PaymentType.findById(paymentType._id)
      .populate('createdBy', 'name email');

    res.json({
      message: 'Ödeme tipi başarıyla güncellendi',
      paymentType: populatedPaymentType
    });
  } catch (error) {
    console.error('Update payment type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/system-settings/payment-types/:id
// @desc    Ödeme tipini sil
// @access  Private (Admin only)
router.delete('/payment-types/:id', [auth, adminAuth], async (req, res) => {
  try {
    const paymentType = await PaymentType.findById(req.params.id);
    if (!paymentType) {
      return res.status(404).json({ message: 'Ödeme tipi bulunamadı' });
    }

    // Default ödeme tipi silinemez
    if (paymentType.isDefault) {
      return res.status(400).json({ message: 'Varsayılan ödeme tipi silinemez' });
    }

    await PaymentType.findByIdAndDelete(req.params.id);

    res.json({ message: 'Ödeme tipi başarıyla silindi' });
  } catch (error) {
    console.error('Delete payment type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
