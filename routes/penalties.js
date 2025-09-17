const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const { auth, adminAuth } = require('../middleware/auth');
const PenaltyRecord = require('../models/PenaltyRecord');
const User = require('../models/User');
const CommunicationRecord = require('../models/CommunicationRecord');

const router = express.Router();

// @route   GET /api/penalties
// @desc    Get penalty records with filters
// @access  Private (Admin only)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      userId, 
      status = 'all',
      page = 1,
      limit = 50 
    } = req.query;

    let query = {};

    // Date filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // User filter
    if (userId) {
      query.user = userId;
    }

    // Status filter
    if (status !== 'all') {
      switch (status) {
        case 'active':
          query.isCancelled = false;
          query.isResolved = false;
          break;
        case 'resolved':
          query.isResolved = true;
          break;
        case 'cancelled':
          query.isCancelled = true;
          break;
      }
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const penalties = await PenaltyRecord.find(query)
      .populate('user', 'name email')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PenaltyRecord.countDocuments(query);

    res.json({
      penalties,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });

  } catch (error) {
    console.error('Get penalties error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/penalties
// @desc    Add manual penalty
// @access  Private (Admin only)
router.post('/', [
  auth, 
  adminAuth,
  body('userId').isMongoId().withMessage('Geçerli kullanıcı ID\'si gereklidir'),
  body('points').isInt({ min: 1, max: 10 }).withMessage('Puan 1-10 arasında olmalıdır'),
  body('reason').trim().isLength({ min: 5 }).withMessage('Sebep en az 5 karakter olmalıdır'),
  body('date').isISO8601().withMessage('Geçerli tarih formatı gereklidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { userId, points, reason, date } = req.body;

    // User check
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Admin kendine ceza veremez
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Kendinize ceza puanı veremezsiniz' });
    }

    // Create penalty record
    const penalty = new PenaltyRecord({
      user: userId,
      points,
      reason,
      date: new Date(date),
      type: 'manual',
      createdBy: req.user._id
    });

    await penalty.save();

    // Update user penalty stats
    await updateUserPenaltyStats(userId);

    const populatedPenalty = await PenaltyRecord.findById(penalty._id)
      .populate('user', 'name email')
      .populate('createdBy', 'name email');

    console.log('✅ Manual penalty added:', {
      user: populatedPenalty.user.name,
      points,
      reason: reason.substring(0, 50),
      addedBy: req.user.name
    });

    res.status(201).json({
      message: 'Ceza puanı başarıyla eklendi',
      penalty: populatedPenalty
    });

  } catch (error) {
    console.error('Add penalty error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/penalties/:id/cancel
// @desc    Cancel penalty record
// @access  Private (Admin only)
router.put('/:id/cancel', [
  auth, 
  adminAuth,
  body('reason').trim().isLength({ min: 5 }).withMessage('İptal sebebi en az 5 karakter olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { reason } = req.body;

    const penalty = await PenaltyRecord.findById(req.params.id);
    if (!penalty) {
      return res.status(404).json({ message: 'Ceza kaydı bulunamadı' });
    }

    if (penalty.isCancelled) {
      return res.status(400).json({ message: 'Bu ceza kaydı zaten iptal edilmiş' });
    }

    penalty.isCancelled = true;
    penalty.cancelledBy = req.user._id;
    penalty.cancelledAt = new Date();
    penalty.cancelReason = reason;

    await penalty.save();

    // Update user penalty stats
    await updateUserPenaltyStats(penalty.user);

    console.log('✅ Penalty cancelled:', {
      penaltyId: penalty._id,
      reason: reason.substring(0, 50),
      cancelledBy: req.user.name
    });

    res.json({ message: 'Ceza puanı başarıyla iptal edildi' });

  } catch (error) {
    console.error('Cancel penalty error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/penalties/check-missed-entries
// @desc    Check for missed communication entries and add penalties
// @access  Private (Admin only)
router.post('/check-missed-entries', [auth, adminAuth], async (req, res) => {
  try {
    const settings = await getPenaltySettings();
    const checkDate = req.body.date ? new Date(req.body.date) : new Date();
    
    // Dün 23:00'dan önceki günleri kontrol et
    const yesterday = new Date(checkDate);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 0, 0, 0);

    // Son 7 günü kontrol et (ayarlanabilir)
    const checkStartDate = new Date(yesterday);
    checkStartDate.setDate(checkStartDate.getDate() - 7);

    console.log('🔍 Checking missed entries from', checkStartDate, 'to', yesterday);

    // Muaf olmayan aktif kullanıcıları al
    const eligibleUsers = await User.find({
      isActive: true,
      isApproved: true,
      requiresCommunicationEntry: true,
      role: { $exists: true }
    }).populate('role', 'name');

    const nonAdminUsers = eligibleUsers.filter(user => 
      user.role && user.role.name !== 'admin'
    );

    let newPenalties = 0;
    let checkedDays = 0;

    for (let d = new Date(checkStartDate); d <= yesterday; d.setDate(d.getDate() + 1)) {
      const checkDay = new Date(d);
      checkDay.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(checkDay);
      nextDay.setDate(nextDay.getDate() + 1);

      checkedDays++;

      for (const user of nonAdminUsers) {
        // Bu kullanıcının bu gün için iletişim kaydı var mı?
        const hasEntry = await CommunicationRecord.findOne({
          salesperson: user._id,
          date: {
            $gte: checkDay,
            $lt: nextDay
          }
        });

        if (!hasEntry) {
          // Bu gün için zaten ceza kaydı var mı?
          const existingPenalty = await PenaltyRecord.findOne({
            user: user._id,
            date: {
              $gte: checkDay,
              $lt: nextDay
            },
            type: 'missed_entry'
          });

          if (!existingPenalty) {
            // Yeni ceza kaydı oluştur
            const penalty = new PenaltyRecord({
              user: user._id,
              points: settings.dailyPenaltyPoints,
              reason: `${checkDay.toLocaleDateString('tr-TR')} tarihinde iletişim kaydı girilmedi`,
              date: checkDay,
              type: 'missed_entry',
              createdBy: req.user._id
            });

            await penalty.save();
            newPenalties++;

            console.log(`⚠️ Penalty added for ${user.name} - ${checkDay.toLocaleDateString('tr-TR')}`);
          }
        }
      }
    }

    // Tüm etkilenen kullanıcıların penalty stats'ını güncelle
    for (const user of nonAdminUsers) {
      await updateUserPenaltyStats(user._id);
    }

    console.log(`✅ Missed entry check completed: ${newPenalties} new penalties, ${checkedDays} days checked`);

    res.json({
      message: `Kontrol tamamlandı: ${newPenalties} yeni ceza puanı eklendi`,
      newPenalties,
      checkedDays,
      checkedUsers: nonAdminUsers.length
    });

  } catch (error) {
    console.error('Check missed entries error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/penalties/settings
// @desc    Get penalty settings
// @access  Private (Admin only)
router.get('/settings', [auth, adminAuth], async (req, res) => {
  try {
    const settings = await getPenaltySettings();
    res.json(settings);
  } catch (error) {
    console.error('Get penalty settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/penalties/settings
// @desc    Update penalty settings
// @access  Private (Admin only)
router.put('/settings', [
  auth, 
  adminAuth,
  body('dailyPenaltyPoints').isInt({ min: 1, max: 10 }).withMessage('Günlük ceza puanı 1-10 arasında olmalıdır'),
  body('maxPenaltyPoints').isInt({ min: 5, max: 50 }).withMessage('Maksimum ceza puanı 5-50 arasında olmalıdır'),
  body('autoDeactivateEnabled').isBoolean().withMessage('Otomatik pasifleştirme boolean olmalıdır'),
  body('penaltyResetDays').isInt({ min: 7, max: 365 }).withMessage('Sıfırlama süresi 7-365 gün arasında olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const settings = req.body;
    await savePenaltySettings(settings);

    console.log('✅ Penalty settings updated by', req.user.name);

    res.json({ 
      message: 'Ceza ayarları başarıyla güncellendi',
      settings 
    });

  } catch (error) {
    console.error('Update penalty settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Helper functions
async function updateUserPenaltyStats(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const settings = await getPenaltySettings();

    // Aktif ceza puanlarını hesapla (iptal edilmemiş)
    const activePenalties = await PenaltyRecord.find({
      user: userId,
      isCancelled: false,
      isResolved: false
    });

    const totalActivePoints = activePenalties.reduce((sum, p) => sum + p.points, 0);

    // Eğer maksimum puana ulaşmışsa ve otomatik pasifleştirme açıksa
    if (settings.autoDeactivateEnabled && totalActivePoints >= settings.maxPenaltyPoints) {
      if (!user.isPenaltyDeactivated) {
        user.isPenaltyDeactivated = true;
        user.penaltyDeactivatedAt = new Date();
        user.isActive = false;
        
        console.log(`⚠️ User ${user.name} deactivated due to penalty points: ${totalActivePoints}`);
      }
    }

    await user.save();

  } catch (error) {
    console.error('Update user penalty stats error:', error);
  }
}

async function getPenaltySettings() {
  // Bu fonksiyon sistem ayarlarından penalty ayarlarını alır
  // Şimdilik default değerler döndürüyoruz, daha sonra SystemSettings model'inde saklanabilir
  return {
    dailyPenaltyPoints: 1,
    maxPenaltyPoints: 10,
    autoDeactivateEnabled: true,
    penaltyResetDays: 30
  };
}

async function savePenaltySettings(settings) {
  // Bu fonksiyon sistem ayarlarına penalty ayarlarını kaydeder
  // Şimdilik bir şey yapmıyor, daha sonra SystemSettings model'inde saklanabilir
  console.log('Saving penalty settings:', settings);
  return settings;
}

module.exports = router;