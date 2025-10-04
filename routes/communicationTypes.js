const express = require('express');
const { body, validationResult } = require('express-validator');
const CommunicationType = require('../models/CommunicationType');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/communication-types
// @desc    Tüm iletişim türlerini getir
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { active, category } = req.query;
    
    let query = {};
    
    // Sadece aktif olanları getir
    if (active === 'true') {
      query.isActive = true;
    }
    
    // Kategoriye göre filtrele
    if (category) {
      query.category = category;
    }
    
    const types = await CommunicationType.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .populate('createdBy', 'name email');
    
    res.json(types);
  } catch (error) {
    console.error('Get communication types error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/communication-types/:id
// @desc    Tek iletişim türünü getir
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const type = await CommunicationType.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!type) {
      return res.status(404).json({ message: 'İletişim türü bulunamadı' });
    }
    
    res.json(type);
  } catch (error) {
    console.error('Get communication type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/communication-types
// @desc    Yeni iletişim türü oluştur
// @access  Private (Admin only)
router.post('/', [auth, adminAuth], [
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('İsim 1-50 karakter arasında olmalıdır'),
  body('code').trim().isLength({ min: 1, max: 20 }).withMessage('Kod 1-20 karakter arasında olmalıdır'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('Açıklama en fazla 200 karakter olabilir'),
  body('category').isIn(['incoming', 'outgoing', 'meeting', 'other']).withMessage('Geçersiz kategori'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Geçersiz renk kodu'),
  body('icon').optional().trim().isLength({ max: 50 }).withMessage('İkon en fazla 50 karakter olabilir'),
  body('minValue').optional().isInt({ min: 0 }).withMessage('Minimum değer 0 veya daha büyük olmalıdır'),
  body('maxValue').optional().isInt({ min: 0 }).withMessage('Maksimum değer 0 veya daha büyük olmalıdır'),
  body('isRequired').optional().isBoolean().withMessage('Zorunlu alan boolean olmalıdır'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sıralama 0 veya daha büyük olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const {
      name,
      code,
      description,
      category,
      color = '#007bff',
      icon = 'FiMessageCircle',
      minValue = 0,
      maxValue = 0,
      isRequired = false,
      sortOrder = 0
    } = req.body;

    // Kod benzersizlik kontrolü
    const existingType = await CommunicationType.findOne({ 
      $or: [
        { code: code.toUpperCase() },
        { name: name }
      ]
    });

    if (existingType) {
      return res.status(400).json({ 
        message: existingType.code === code.toUpperCase() 
          ? 'Bu kod zaten kullanılıyor' 
          : 'Bu isim zaten kullanılıyor'
      });
    }

    const newType = new CommunicationType({
      name,
      code: code.toUpperCase(),
      description,
      category,
      color,
      icon,
      minValue,
      maxValue,
      isRequired,
      sortOrder,
      createdBy: req.user.id
    });

    await newType.save();

    const populatedType = await CommunicationType.findById(newType._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'İletişim türü başarıyla oluşturuldu',
      type: populatedType
    });
  } catch (error) {
    console.error('Create communication type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/communication-types/:id
// @desc    İletişim türünü güncelle
// @access  Private (Admin only)
router.put('/:id', [auth, adminAuth], [
  body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('İsim 1-50 karakter arasında olmalıdır'),
  body('code').optional().trim().isLength({ min: 1, max: 20 }).withMessage('Kod 1-20 karakter arasında olmalıdır'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('Açıklama en fazla 200 karakter olabilir'),
  body('category').optional().isIn(['incoming', 'outgoing', 'meeting', 'other']).withMessage('Geçersiz kategori'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Geçersiz renk kodu'),
  body('icon').optional().trim().isLength({ max: 50 }).withMessage('İkon en fazla 50 karakter olabilir'),
  body('minValue').optional().isInt({ min: 0 }).withMessage('Minimum değer 0 veya daha büyük olmalıdır'),
  body('maxValue').optional().isInt({ min: 0 }).withMessage('Maksimum değer 0 veya daha büyük olmalıdır'),
  body('isRequired').optional().isBoolean().withMessage('Zorunlu alan boolean olmalıdır'),
  body('isActive').optional().isBoolean().withMessage('Aktif alan boolean olmalıdır'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sıralama 0 veya daha büyük olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const type = await CommunicationType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ message: 'İletişim türü bulunamadı' });
    }

    const updateData = { ...req.body };
    
    // Kod güncelleniyorsa benzersizlik kontrolü
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
      const existingType = await CommunicationType.findOne({ 
        _id: { $ne: req.params.id },
        $or: [
          { code: updateData.code },
          ...(updateData.name ? [{ name: updateData.name }] : [])
        ]
      });

      if (existingType) {
        return res.status(400).json({ 
          message: existingType.code === updateData.code 
            ? 'Bu kod zaten kullanılıyor' 
            : 'Bu isim zaten kullanılıyor'
        });
      }
    }

    Object.assign(type, updateData);
    await type.save();

    const updatedType = await CommunicationType.findById(type._id)
      .populate('createdBy', 'name email');

    res.json({
      message: 'İletişim türü başarıyla güncellendi',
      type: updatedType
    });
  } catch (error) {
    console.error('Update communication type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/communication-types/:id
// @desc    İletişim türünü sil
// @access  Private (Admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const type = await CommunicationType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ message: 'İletişim türü bulunamadı' });
    }

    // Kullanımda olup olmadığını kontrol et (CommunicationRecord'larda)
    const CommunicationRecord = require('../models/CommunicationRecord');
    const isInUse = await CommunicationRecord.findOne({
      $or: [
        { whatsappIncoming: { $gt: 0 } },
        { callIncoming: { $gt: 0 } },
        { callOutgoing: { $gt: 0 } },
        { meetingNewCustomer: { $gt: 0 } },
        { meetingAfterSale: { $gt: 0 } }
      ]
    });

    if (isInUse) {
      return res.status(400).json({ 
        message: 'Bu iletişim türü kullanımda olduğu için silinemez. Önce pasifleştirin.'
      });
    }

    await CommunicationType.findByIdAndDelete(req.params.id);

    res.json({ message: 'İletişim türü başarıyla silindi' });
  } catch (error) {
    console.error('Delete communication type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/communication-types/:id/toggle
// @desc    İletişim türünü aktif/pasif yap
// @access  Private (Admin only)
router.put('/:id/toggle', [auth, adminAuth], async (req, res) => {
  try {
    const type = await CommunicationType.findById(req.params.id);
    if (!type) {
      return res.status(404).json({ message: 'İletişim türü bulunamadı' });
    }

    type.isActive = !type.isActive;
    await type.save();

    res.json({
      message: `İletişim türü ${type.isActive ? 'aktif' : 'pasif'} yapıldı`,
      type
    });
  } catch (error) {
    console.error('Toggle communication type error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/communication-types/reorder
// @desc    İletişim türlerinin sıralamasını güncelle
// @access  Private (Admin only)
router.put('/reorder', [auth, adminAuth], [
  body('types').isArray().withMessage('Türler array olmalıdır'),
  body('types.*.id').isMongoId().withMessage('Geçersiz tür ID'),
  body('types.*.sortOrder').isInt({ min: 0 }).withMessage('Geçersiz sıralama')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const { types } = req.body;

    // Toplu güncelleme
    const updatePromises = types.map(type => 
      CommunicationType.findByIdAndUpdate(type.id, { sortOrder: type.sortOrder })
    );

    await Promise.all(updatePromises);

    res.json({ message: 'Sıralama başarıyla güncellendi' });
  } catch (error) {
    console.error('Reorder communication types error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/communication-types/create-defaults
// @desc    Varsayılan iletişim türlerini oluştur
// @access  Private (Admin only)
router.post('/create-defaults', [auth, adminAuth], async (req, res) => {
  try {
    // Mevcut türleri kontrol et
    const existingTypes = await CommunicationType.find({});
    
    if (existingTypes.length > 0) {
      return res.status(400).json({ 
        message: 'Zaten iletişim türleri mevcut. Önce mevcut türleri silin.',
        existingCount: existingTypes.length
      });
    }

    // Varsayılan türler
    const defaultTypes = [
      {
        name: 'WhatsApp Gelen Mesaj',
        code: 'WHATSAPP_INCOMING',
        description: 'WhatsApp üzerinden gelen mesajlar',
        category: 'incoming',
        color: '#25D366',
        icon: 'FiMessageCircle',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 1,
        createdBy: req.user.id
      },
      {
        name: 'Telefon Gelen Arama',
        code: 'CALL_INCOMING',
        description: 'Telefon üzerinden gelen aramalar',
        category: 'incoming',
        color: '#28a745',
        icon: 'FiPhone',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 2,
        createdBy: req.user.id
      },
      {
        name: 'Telefon Giden Arama',
        code: 'CALL_OUTGOING',
        description: 'Telefon üzerinden yapılan aramalar',
        category: 'outgoing',
        color: '#007bff',
        icon: 'FiPhone',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 3,
        createdBy: req.user.id
      },
      {
        name: 'Yeni Müşteri Toplantısı',
        code: 'MEETING_NEW_CUSTOMER',
        description: 'Yeni müşterilerle yapılan toplantılar',
        category: 'meeting',
        color: '#ffc107',
        icon: 'FiUsers',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 4,
        createdBy: req.user.id
      },
      {
        name: 'Satış Sonrası Toplantı',
        code: 'MEETING_AFTER_SALE',
        description: 'Satış sonrası müşteri takip toplantıları',
        category: 'meeting',
        color: '#fd7e14',
        icon: 'FiUserCheck',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 5,
        createdBy: req.user.id
      },
      {
        name: 'E-posta Gelen',
        code: 'EMAIL_INCOMING',
        description: 'E-posta üzerinden gelen mesajlar',
        category: 'incoming',
        color: '#6c757d',
        icon: 'FiMail',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 6,
        createdBy: req.user.id
      },
      {
        name: 'E-posta Giden',
        code: 'EMAIL_OUTGOING',
        description: 'E-posta üzerinden gönderilen mesajlar',
        category: 'outgoing',
        color: '#17a2b8',
        icon: 'FiMail',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 7,
        createdBy: req.user.id
      },
      {
        name: 'Video Konferans',
        code: 'VIDEO_CALL',
        description: 'Video konferans toplantıları',
        category: 'meeting',
        color: '#e83e8c',
        icon: 'FiVideo',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 8,
        createdBy: req.user.id
      },
      {
        name: 'Saha Ziyareti',
        code: 'FIELD_VISIT',
        description: 'Müşteri ziyaretleri ve saha çalışmaları',
        category: 'meeting',
        color: '#20c997',
        icon: 'FiMapPin',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 9,
        createdBy: req.user.id
      },
      {
        name: 'Sosyal Medya Mesajı',
        code: 'SOCIAL_MEDIA',
        description: 'Sosyal medya platformlarından gelen mesajlar',
        category: 'incoming',
        color: '#6f42c1',
        icon: 'FiMessageCircle',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 10,
        createdBy: req.user.id
      }
    ];

    // Türleri oluştur
    const createdTypes = await CommunicationType.insertMany(defaultTypes);

    res.status(201).json({
      message: `${createdTypes.length} varsayılan iletişim türü başarıyla oluşturuldu`,
      types: createdTypes
    });
  } catch (error) {
    console.error('Create default types error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
