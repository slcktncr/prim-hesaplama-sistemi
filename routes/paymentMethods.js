const express = require('express');
const { body, validationResult } = require('express-validator');
const PaymentMethod = require('../models/PaymentMethod');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/payment-methods
// @desc    Tüm ödeme yöntemlerini listele
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    
    const query = includeInactive === 'true' ? {} : { isActive: true };
    
    const paymentMethods = await PaymentMethod.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      count: paymentMethods.length,
      data: paymentMethods
    });
  } catch (error) {
    console.error('❌ Get payment methods error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/payment-methods/active
// @desc    Sadece aktif ödeme yöntemlerini listele (dropdown için)
// @access  Private
router.get('/active', auth, async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ isActive: true })
      .select('name description isDefault')
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: paymentMethods
    });
  } catch (error) {
    console.error('❌ Get active payment methods error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/payment-methods
// @desc    Yeni ödeme yöntemi oluştur
// @access  Private (Admin only)
router.post('/', [auth, adminAuth], [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Ödeme yöntemi adı 1-50 karakter arası olmalıdır'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('Açıklama 200 karakterden uzun olamaz'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sıralama 0 veya pozitif sayı olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validasyon hatası',
        errors: errors.array() 
      });
    }

    const { name, description, isDefault, sortOrder } = req.body;

    // Aynı isimde ödeme yöntemi var mı kontrol et
    const existingMethod = await PaymentMethod.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingMethod) {
      return res.status(400).json({ message: 'Bu ödeme yöntemi zaten mevcut' });
    }

    const paymentMethod = new PaymentMethod({
      name: name.trim(),
      description: description?.trim(),
      isDefault: Boolean(isDefault),
      sortOrder: sortOrder || 0,
      createdBy: req.user._id
    });

    await paymentMethod.save();

    const populatedMethod = await PaymentMethod.findById(paymentMethod._id)
      .populate('createdBy', 'name email');

    console.log(`✅ Yeni ödeme yöntemi oluşturuldu: ${name} - Admin: ${req.user.name}`);

    res.status(201).json({
      success: true,
      message: 'Ödeme yöntemi başarıyla oluşturuldu',
      data: populatedMethod
    });
  } catch (error) {
    console.error('❌ Create payment method error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/payment-methods/:id
// @desc    Ödeme yöntemini güncelle
// @access  Private (Admin only)
router.put('/:id', [auth, adminAuth], [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Ödeme yöntemi adı 1-50 karakter arası olmalıdır'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('Açıklama 200 karakterden uzun olamaz'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sıralama 0 veya pozitif sayı olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validasyon hatası',
        errors: errors.array() 
      });
    }

    const { name, description, isActive, isDefault, sortOrder } = req.body;

    const paymentMethod = await PaymentMethod.findById(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Ödeme yöntemi bulunamadı' });
    }

    // Aynı isimde başka ödeme yöntemi var mı kontrol et
    if (name && name.toLowerCase() !== paymentMethod.name.toLowerCase()) {
      const existingMethod = await PaymentMethod.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      
      if (existingMethod) {
        return res.status(400).json({ message: 'Bu ödeme yöntemi adı zaten kullanılıyor' });
      }
    }

    // Güncelle
    paymentMethod.name = name?.trim() || paymentMethod.name;
    paymentMethod.description = description?.trim() || paymentMethod.description;
    paymentMethod.isActive = isActive !== undefined ? Boolean(isActive) : paymentMethod.isActive;
    paymentMethod.isDefault = isDefault !== undefined ? Boolean(isDefault) : paymentMethod.isDefault;
    paymentMethod.sortOrder = sortOrder !== undefined ? sortOrder : paymentMethod.sortOrder;
    paymentMethod.updatedBy = req.user._id;

    await paymentMethod.save();

    const populatedMethod = await PaymentMethod.findById(paymentMethod._id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    console.log(`🔄 Ödeme yöntemi güncellendi: ${paymentMethod.name} - Admin: ${req.user.name}`);

    res.json({
      success: true,
      message: 'Ödeme yöntemi başarıyla güncellendi',
      data: populatedMethod
    });
  } catch (error) {
    console.error('❌ Update payment method error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/payment-methods/:id
// @desc    Ödeme yöntemini sil
// @access  Private (Admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Ödeme yöntemi bulunamadı' });
    }

    // Bu ödeme yöntemi kullanılıyor mu kontrol et
    const Sale = require('../models/Sale');
    const salesCount = await Sale.countDocuments({ paymentType: paymentMethod.name });
    
    if (salesCount > 0) {
      return res.status(400).json({ 
        message: `Bu ödeme yöntemi ${salesCount} satışta kullanılıyor. Önce bu satışları güncelleyin veya ödeme yöntemini pasif yapın.`,
        salesCount 
      });
    }

    await PaymentMethod.findByIdAndDelete(req.params.id);

    console.log(`🗑️ Ödeme yöntemi silindi: ${paymentMethod.name} - Admin: ${req.user.name}`);

    res.json({
      success: true,
      message: 'Ödeme yöntemi başarıyla silindi'
    });
  } catch (error) {
    console.error('❌ Delete payment method error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/payment-methods/:id/toggle-status
// @desc    Ödeme yöntemi aktif/pasif durumunu değiştir
// @access  Private (Admin only)
router.put('/:id/toggle-status', [auth, adminAuth], async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(req.params.id);
    if (!paymentMethod) {
      return res.status(404).json({ message: 'Ödeme yöntemi bulunamadı' });
    }

    paymentMethod.isActive = !paymentMethod.isActive;
    paymentMethod.updatedBy = req.user._id;
    await paymentMethod.save();

    const status = paymentMethod.isActive ? 'aktif' : 'pasif';
    console.log(`🔄 Ödeme yöntemi ${status} yapıldı: ${paymentMethod.name} - Admin: ${req.user.name}`);

    res.json({
      success: true,
      message: `Ödeme yöntemi ${status} yapıldı`,
      data: { isActive: paymentMethod.isActive }
    });
  } catch (error) {
    console.error('❌ Toggle payment method status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
