const express = require('express');
const mongoose = require('mongoose');

const PenaltyRecord = require('../models/PenaltyRecord');
const CommunicationRecord = require('../models/CommunicationRecord');
const CommunicationYear = require('../models/CommunicationYear');
const DailyStatus = require('../models/DailyStatus');
const User = require('../models/User');

const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// @route   GET /api/penalties/my-status
// @desc    Kullanıcının ceza puanı durumunu getir
// @access  Private
router.get('/my-status', auth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const penaltyRecord = await PenaltyRecord.findOne({
      salesperson: req.user.id,
      year: currentYear
    });

    if (!penaltyRecord) {
      return res.json({
        totalPenaltyPoints: 0,
        isAccountActive: true,
        penaltyHistory: []
      });
    }

    res.json(penaltyRecord);
  } catch (error) {
    console.error('Penalty status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/penalties/all-users
// @desc    Tüm kullanıcıların ceza puanı durumunu getir (Admin)
// @access  Private (Admin)
router.get('/all-users', [auth, adminAuth], async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const penaltyRecords = await PenaltyRecord.find({ year: parseInt(year) })
      .populate('salesperson', 'name email isActive')
      .sort({ totalPenaltyPoints: -1 });

    // Tüm aktif kullanıcıları getir
    const allUsers = await User.find({ 
      role: 'salesperson',
      isApproved: true 
    }).select('name email isActive isPenaltyDeactivated');

    // Ceza kaydı olmayan kullanıcılar için boş kayıt oluştur
    const usersWithPenalties = allUsers.map(user => {
      const penaltyRecord = penaltyRecords.find(p => 
        p.salesperson._id.toString() === user._id.toString()
      );

      return {
        salesperson: user,
        totalPenaltyPoints: penaltyRecord ? penaltyRecord.totalPenaltyPoints : 0,
        isAccountActive: penaltyRecord ? penaltyRecord.isAccountActive : true,
        penaltyHistory: penaltyRecord ? penaltyRecord.penaltyHistory : [],
        deactivatedAt: penaltyRecord ? penaltyRecord.deactivatedAt : null,
        reactivatedAt: penaltyRecord ? penaltyRecord.reactivatedAt : null
      };
    });

    res.json(usersWithPenalties);
  } catch (error) {
    console.error('All users penalty status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/penalties/reactivate/:userId
// @desc    Kullanıcı hesabını aktifleştir (Admin)
// @access  Private (Admin)
router.post('/reactivate/:userId', [auth, adminAuth], async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const currentYear = new Date().getFullYear();

    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Ceza kaydını bul
    let penaltyRecord = await PenaltyRecord.findOne({
      salesperson: userId,
      year: currentYear
    });

    if (!penaltyRecord) {
      return res.status(404).json({ message: 'Ceza kaydı bulunamadı' });
    }

    // Hesabı aktifleştir
    await penaltyRecord.reactivateAccount(req.user.id, reason);

    // User modelindeki ceza durumunu güncelle
    user.isPenaltyDeactivated = false;
    user.penaltyDeactivatedAt = null;
    await user.save();

    res.json({
      message: 'Kullanıcı hesabı başarıyla aktifleştirildi',
      penaltyRecord
    });

  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/penalties/check-daily
// @desc    Günlük ceza puanı kontrolü (Sistem tarafından çağrılır)
// @access  Private (Admin)
router.post('/check-daily', [auth, adminAuth], async (req, res) => {
  try {
    const { date } = req.body;
    const checkDate = date ? new Date(date) : new Date();
    checkDate.setHours(0, 0, 0, 0);
    
    const year = checkDate.getFullYear();

    // Aktif yıl ayarlarını getir
    const yearSettings = await CommunicationYear.findOne({ 
      year: year,
      isActive: true 
    });

    if (!yearSettings || !yearSettings.settings.penaltySystemActive) {
      return res.json({ message: 'Bu yıl için ceza sistemi aktif değil' });
    }

    // İletişim kaydı zorunlu olan aktif temsilcileri getir
    const activeUsers = await User.find({
      role: 'salesperson',
      isActive: true,
      isApproved: true,
      isPenaltyDeactivated: false,
      requiresCommunicationEntry: true // Sadece iletişim kaydı zorunlu olanlar
    });

    const results = [];

    for (const user of activeUsers) {
      // Kullanıcının o günkü durum kaydını kontrol et
      const dailyStatus = await DailyStatus.getStatusForDate(user._id, checkDate);
      
      // İzinli, hastalık veya resmi tatilde ise ceza verme
      if (dailyStatus && ['izinli', 'hastalik', 'resmi_tatil'].includes(dailyStatus.status)) {
        results.push({
          user: user.name,
          status: 'exempt',
          reason: `${dailyStatus.statusDisplay} durumunda`,
          date: checkDate
        });
        continue;
      }

      // Kullanıcının o günkü iletişim kaydını kontrol et
      const communicationRecord = await CommunicationRecord.findOne({
        salesperson: user._id,
        date: checkDate
      });

      // Kayıt yoksa veya girilmemişse ceza puanı ekle
      if (!communicationRecord || !communicationRecord.isEntered) {
        let penaltyRecord = await PenaltyRecord.findOne({
          salesperson: user._id,
          year: year
        });

        if (!penaltyRecord) {
          penaltyRecord = new PenaltyRecord({
            salesperson: user._id,
            year: year
          });
        }

        // Ceza puanı ekle
        await penaltyRecord.addPenalty(
          yearSettings.settings.dailyPenaltyPoints,
          `${checkDate.toISOString().split('T')[0]} tarihinde veri girişi yapılmadı`,
          yearSettings.settings.maxPenaltyPoints
        );

        // Eğer hesap pasifleştirildiyse User modelini güncelle
        if (!penaltyRecord.isAccountActive) {
          user.isPenaltyDeactivated = true;
          user.penaltyDeactivatedAt = new Date();
          await user.save();
        }

        // İletişim kaydını güncelle
        if (communicationRecord) {
          communicationRecord.penaltyApplied = true;
          communicationRecord.penaltyDate = new Date();
          await communicationRecord.save();
        }

        results.push({
          user: user.name,
          penaltyApplied: true,
          newTotalPoints: penaltyRecord.totalPenaltyPoints,
          accountDeactivated: !penaltyRecord.isAccountActive
        });
      } else {
        results.push({
          user: user.name,
          penaltyApplied: false,
          reason: 'Veri girişi yapılmış'
        });
      }
    }

    res.json({
      message: 'Günlük ceza puanı kontrolü tamamlandı',
      date: checkDate.toISOString().split('T')[0],
      results
    });

  } catch (error) {
    console.error('Daily penalty check error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/penalties/manual-penalty
// @desc    Manuel ceza puanı ekle (Admin)
// @access  Private (Admin)
router.post('/manual-penalty', [auth, adminAuth], async (req, res) => {
  try {
    const { userId, points, reason, year = new Date().getFullYear() } = req.body;

    if (!userId || !points || !reason) {
      return res.status(400).json({ 
        message: 'Kullanıcı ID, puan ve sebep gereklidir' 
      });
    }

    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Yıl ayarlarını getir
    const yearSettings = await CommunicationYear.findOne({ year: parseInt(year) });
    const maxPoints = yearSettings ? yearSettings.settings.maxPenaltyPoints : 100;

    // Ceza kaydını bul veya oluştur
    let penaltyRecord = await PenaltyRecord.findOne({
      salesperson: userId,
      year: parseInt(year)
    });

    if (!penaltyRecord) {
      penaltyRecord = new PenaltyRecord({
        salesperson: userId,
        year: parseInt(year)
      });
    }

    // Ceza puanı ekle
    await penaltyRecord.addPenalty(parseInt(points), reason, maxPoints);

    // Eğer hesap pasifleştirildiyse User modelini güncelle
    if (!penaltyRecord.isAccountActive) {
      user.isPenaltyDeactivated = true;
      user.penaltyDeactivatedAt = new Date();
      await user.save();
    }

    res.json({
      message: 'Ceza puanı başarıyla eklendi',
      penaltyRecord
    });

  } catch (error) {
    console.error('Manual penalty error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
