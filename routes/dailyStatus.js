const express = require('express');
const { body, validationResult } = require('express-validator');
const DailyStatus = require('../models/DailyStatus');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/daily-status/my-status
// @desc    Kullanıcının bugünkü durumunu getir
// @access  Private
router.get('/my-status', auth, async (req, res) => {
  try {
    const todayStatus = await DailyStatus.getTodayStatus(req.user.id);
    
    if (!todayStatus) {
      // Bugün için durum kaydı yoksa varsayılan olarak mesaide
      return res.json({
        status: 'mesaide',
        statusDisplay: 'Mesaide',
        isSet: false,
        canChange: true
      });
    }

    res.json({
      status: todayStatus.status,
      statusDisplay: todayStatus.statusDisplay,
      statusNote: todayStatus.statusNote,
      statusSetAt: todayStatus.statusSetAt,
      statusSetBy: todayStatus.statusSetBy,
      isSet: true,
      canChange: true,
      isPenaltyExempt: todayStatus.isPenaltyExempt
    });

  } catch (error) {
    console.error('Get my status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/daily-status/set-status
// @desc    Kullanıcının günlük durumunu ayarla
// @access  Private
router.post('/set-status', [
  auth,
  body('status').isIn(['mesaide', 'izinli', 'hastalik']).withMessage('Geçersiz durum'),
  body('statusNote').optional().isLength({ max: 200 }).withMessage('Not çok uzun')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array()
      });
    }

    const { status, statusNote } = req.body;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Kullanıcının iletişim kaydı zorunluluğu var mı kontrol et
    const user = await User.findById(req.user.id);
    if (!user.requiresCommunicationEntry) {
      return res.status(400).json({ 
        message: 'İletişim kaydı zorunluluğunuz olmadığı için durum ayarlayamazsınız' 
      });
    }

    // Bugünkü kaydı bul veya oluştur
    let dailyStatus = await DailyStatus.findOne({
      salesperson: req.user.id,
      date: {
        $gte: startOfDay,
        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (dailyStatus) {
      // Mevcut kaydı güncelle
      const previousStatus = dailyStatus.status;
      
      // Geçmiş kaydı ekle
      dailyStatus.statusHistory.push({
        previousStatus: previousStatus,
        newStatus: status,
        changedAt: new Date(),
        changedBy: req.user.id,
        changeReason: statusNote || 'Kullanıcı tarafından değiştirildi'
      });

      dailyStatus.status = status;
      dailyStatus.statusNote = statusNote;
      dailyStatus.statusSetAt = new Date();
      dailyStatus.statusSetBy = req.user.id;
      dailyStatus.isPenaltyExempt = ['izinli', 'hastalik'].includes(status);
      dailyStatus.exemptReason = ['izinli', 'hastalik'].includes(status) ? 
        `${status === 'izinli' ? 'İzinli' : 'Hastalık izni'} durumu` : null;

    } else {
      // Yeni kayıt oluştur
      dailyStatus = new DailyStatus({
        salesperson: req.user.id,
        date: startOfDay,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate(),
        status: status,
        statusNote: statusNote,
        statusSetAt: new Date(),
        statusSetBy: req.user.id,
        isPenaltyExempt: ['izinli', 'hastalik'].includes(status),
        exemptReason: ['izinli', 'hastalik'].includes(status) ? 
          `${status === 'izinli' ? 'İzinli' : 'Hastalık izni'} durumu` : null
      });
    }

    await dailyStatus.save();

    res.json({
      message: `Durumunuz "${dailyStatus.statusDisplay}" olarak ayarlandı`,
      status: dailyStatus.status,
      statusDisplay: dailyStatus.statusDisplay,
      statusNote: dailyStatus.statusNote,
      statusSetAt: dailyStatus.statusSetAt,
      isPenaltyExempt: dailyStatus.isPenaltyExempt
    });

  } catch (error) {
    console.error('Set status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/daily-status/team-status
// @desc    Takım durumlarını getir (bugün için)
// @access  Private
router.get('/team-status', auth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Tüm aktif satış temsilcilerini getir (sistem admin hariç)
    const allSalespeople = await User.find({
      systemRole: { $ne: 'admin' }, // Sistem admin'i hariç
      isActive: true,
      isApproved: true,
      requiresCommunicationEntry: true
    }).select('name email');

    // Bugünkü durum kayıtlarını getir
    const todayStatuses = await DailyStatus.find({
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }).populate('salesperson', 'name email');

    // Durum kayıtlarını map'e çevir
    const statusMap = {};
    todayStatuses.forEach(status => {
      statusMap[status.salesperson._id.toString()] = status;
    });

    // Tüm temsilciler için durum listesi oluştur
    const teamStatus = allSalespeople.map(person => {
      const status = statusMap[person._id.toString()];
      return {
        _id: person._id,
        name: person.name,
        email: person.email,
        status: status ? status.status : 'mesaide',
        statusDisplay: status ? status.statusDisplay : 'Mesaide',
        statusNote: status ? status.statusNote : null,
        statusSetAt: status ? status.statusSetAt : null,
        isPenaltyExempt: status ? status.isPenaltyExempt : false,
        isSet: !!status
      };
    });

    // İstatistikleri hesapla
    const stats = {
      mesaide: teamStatus.filter(t => t.status === 'mesaide').length,
      izinli: teamStatus.filter(t => t.status === 'izinli').length,
      hastalik: teamStatus.filter(t => t.status === 'hastalik').length,
      total: teamStatus.length
    };

    res.json({
      teamStatus: teamStatus,
      stats: stats,
      date: startOfDay
    });

  } catch (error) {
    console.error('Get team status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/daily-status/history
// @desc    Kullanıcının durum geçmişini getir
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const { startDate, endDate, limit = 30 } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      // Son 30 gün
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        date: { $gte: thirtyDaysAgo }
      };
    }

    const history = await DailyStatus.find({
      salesperson: req.user.id,
      ...dateFilter
    })
    .populate('statusSetBy', 'name')
    .sort({ date: -1 })
    .limit(parseInt(limit));

    res.json(history);

  } catch (error) {
    console.error('Get status history error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/daily-status/admin/set-status/:userId
// @desc    Admin tarafından kullanıcı durumu ayarlama
// @access  Private (Admin only)
router.post('/admin/set-status/:userId', [
  auth,
  adminAuth,
  body('status').isIn(['mesaide', 'izinli', 'hastalik', 'resmi_tatil']).withMessage('Geçersiz durum'),
  body('statusNote').optional().isLength({ max: 200 }).withMessage('Not çok uzun'),
  body('date').optional().isISO8601().withMessage('Geçersiz tarih formatı')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array()
      });
    }

    const { status, statusNote, date } = req.body;
    const userId = req.params.userId;
    
    // Kullanıcı kontrolü
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    // Mevcut kaydı bul veya oluştur
    let dailyStatus = await DailyStatus.findOne({
      salesperson: userId,
      date: {
        $gte: startOfDay,
        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (dailyStatus) {
      // Mevcut kaydı güncelle
      const previousStatus = dailyStatus.status;
      
      dailyStatus.statusHistory.push({
        previousStatus: previousStatus,
        newStatus: status,
        changedAt: new Date(),
        changedBy: req.user.id,
        changeReason: statusNote || 'Admin tarafından değiştirildi'
      });

      dailyStatus.status = status;
      dailyStatus.statusNote = statusNote;
      dailyStatus.statusSetAt = new Date();
      dailyStatus.statusSetBy = req.user.id;
      dailyStatus.isPenaltyExempt = ['izinli', 'hastalik', 'resmi_tatil'].includes(status);
      dailyStatus.exemptReason = ['izinli', 'hastalik', 'resmi_tatil'].includes(status) ? 
        `Admin tarafından ${status} olarak ayarlandı` : null;

    } else {
      // Yeni kayıt oluştur
      dailyStatus = new DailyStatus({
        salesperson: userId,
        date: startOfDay,
        year: targetDate.getFullYear(),
        month: targetDate.getMonth() + 1,
        day: targetDate.getDate(),
        status: status,
        statusNote: statusNote,
        statusSetAt: new Date(),
        statusSetBy: req.user.id,
        isPenaltyExempt: ['izinli', 'hastalik', 'resmi_tatil'].includes(status),
        exemptReason: ['izinli', 'hastalik', 'resmi_tatil'].includes(status) ? 
          `Admin tarafından ${status} olarak ayarlandı` : null
      });
    }

    await dailyStatus.save();

    res.json({
      message: `${user.name} kullanıcısının durumu "${dailyStatus.statusDisplay}" olarak ayarlandı`,
      status: dailyStatus.status,
      statusDisplay: dailyStatus.statusDisplay,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Admin set status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/daily-status/admin/all-statuses
// @desc    Tüm kullanıcıların durumlarını getir (admin için)
// @access  Private (Admin only)
router.get('/admin/all-statuses', [auth, adminAuth], async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const stats = await DailyStatus.getStatusStats(targetDate);
    
    // Tüm aktif satış temsilcilerini getir (sistem admin hariç)
    const allSalespeople = await User.find({
      systemRole: { $ne: 'admin' }, // Sistem admin'i hariç
      isActive: true,
      isApproved: true
    }).select('name email requiresCommunicationEntry');

    res.json({
      stats: stats,
      totalSalespeople: allSalespeople.length,
      date: targetDate
    });

  } catch (error) {
    console.error('Get all statuses error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
