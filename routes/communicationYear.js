const express = require('express');
const { body, validationResult } = require('express-validator');
const CommunicationYear = require('../models/CommunicationYear');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/communication-year/current
// @desc    Aktif iletişim yılı ayarlarını getir
// @access  Private
router.get('/current', auth, async (req, res) => {
  try {
    const currentYear = await CommunicationYear.findOne({ 
      isActive: true,
      type: 'active'
    });

    if (!currentYear) {
      return res.status(404).json({ message: 'Aktif iletişim yılı bulunamadı' });
    }

    res.json({
      year: currentYear.year,
      settings: currentYear.settings
    });
  } catch (error) {
    console.error('Get current communication year error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/communication-year/current/settings
// @desc    Aktif iletişim yılı ayarlarını güncelle
// @access  Private (Admin only)
router.put('/current/settings', [auth, adminAuth], [
  body('entryDeadlineTime.hour').isInt({ min: 0, max: 23 }).withMessage('Saat 0-23 arasında olmalıdır'),
  body('entryDeadlineTime.minute').isInt({ min: 0, max: 59 }).withMessage('Dakika 0-59 arasında olmalıdır'),
  body('dailyEntryRequired').isBoolean().withMessage('Günlük giriş zorunluluğu boolean olmalıdır'),
  body('penaltySystemActive').isBoolean().withMessage('Ceza sistemi boolean olmalıdır'),
  body('dailyPenaltyPoints').isInt({ min: 0 }).withMessage('Günlük ceza puanı 0 veya daha büyük olmalıdır'),
  body('maxPenaltyPoints').isInt({ min: 0 }).withMessage('Maksimum ceza puanı 0 veya daha büyük olmalıdır')
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
      entryDeadlineTime, 
      dailyEntryRequired, 
      penaltySystemActive, 
      dailyPenaltyPoints, 
      maxPenaltyPoints 
    } = req.body;

    const currentYear = await CommunicationYear.findOne({ 
      isActive: true,
      type: 'active'
    });

    if (!currentYear) {
      return res.status(404).json({ message: 'Aktif iletişim yılı bulunamadı' });
    }

    // Ayarları güncelle
    currentYear.settings.entryDeadlineTime = {
      hour: parseInt(entryDeadlineTime.hour),
      minute: parseInt(entryDeadlineTime.minute)
    };
    currentYear.settings.dailyEntryRequired = dailyEntryRequired;
    currentYear.settings.penaltySystemActive = penaltySystemActive;
    currentYear.settings.dailyPenaltyPoints = parseInt(dailyPenaltyPoints);
    currentYear.settings.maxPenaltyPoints = parseInt(maxPenaltyPoints);

    await currentYear.save();

    res.json({
      message: 'İletişim yılı ayarları başarıyla güncellendi',
      settings: currentYear.settings
    });
  } catch (error) {
    console.error('Update communication year settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
