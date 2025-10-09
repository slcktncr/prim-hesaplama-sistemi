const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// Tüm route'lar admin yetkisi gerektirir
router.use(protect);
router.use(adminOnly);

// Tüm takımları listele
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('teamLeader', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email')
      .populate('createdBy', 'firstName lastName name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Takım listesi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takımlar listelenirken hata oluştu',
      error: error.message
    });
  }
});

// Tek bir takımı getir
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('teamLeader', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email')
      .populate('createdBy', 'firstName lastName name');

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Takım getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takım getirilirken hata oluştu',
      error: error.message
    });
  }
});

// Yeni takım oluştur
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      teamLeader,
      members,
      performanceSettings
    } = req.body;

    // Takım liderinin var olduğunu kontrol et
    const leaderExists = await User.findById(teamLeader);
    if (!leaderExists) {
      return res.status(400).json({
        success: false,
        message: 'Takım lideri bulunamadı'
      });
    }

    // Üyelerin var olduğunu kontrol et
    if (members && members.length > 0) {
      const memberCount = await User.countDocuments({
        _id: { $in: members }
      });
      if (memberCount !== members.length) {
        return res.status(400).json({
          success: false,
          message: 'Bazı takım üyeleri bulunamadı'
        });
      }
    }

    const team = await Team.create({
      name,
      description,
      teamLeader,
      members: members || [],
      performanceSettings: performanceSettings || {},
      createdBy: req.user._id
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email')
      .populate('createdBy', 'firstName lastName name');

    res.status(201).json({
      success: true,
      message: 'Takım başarıyla oluşturuldu',
      data: populatedTeam
    });
  } catch (error) {
    console.error('Takım oluşturma hatası:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bu isimde bir takım zaten mevcut'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Takım oluşturulurken hata oluştu',
      error: error.message
    });
  }
});

// Takımı güncelle
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      description,
      teamLeader,
      members,
      performanceSettings,
      isActive
    } = req.body;

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    // Takım liderinin var olduğunu kontrol et
    if (teamLeader) {
      const leaderExists = await User.findById(teamLeader);
      if (!leaderExists) {
        return res.status(400).json({
          success: false,
          message: 'Takım lideri bulunamadı'
        });
      }
      team.teamLeader = teamLeader;
    }

    // Üyelerin var olduğunu kontrol et
    if (members) {
      const memberCount = await User.countDocuments({
        _id: { $in: members }
      });
      if (memberCount !== members.length) {
        return res.status(400).json({
          success: false,
          message: 'Bazı takım üyeleri bulunamadı'
        });
      }
      team.members = members;
    }

    if (name) team.name = name;
    if (description !== undefined) team.description = description;
    if (performanceSettings) {
      team.performanceSettings = {
        ...team.performanceSettings,
        ...performanceSettings
      };
    }
    if (isActive !== undefined) team.isActive = isActive;

    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email')
      .populate('createdBy', 'firstName lastName name');

    res.json({
      success: true,
      message: 'Takım başarıyla güncellendi',
      data: updatedTeam
    });
  } catch (error) {
    console.error('Takım güncelleme hatası:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Bu isimde bir takım zaten mevcut'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Takım güncellenirken hata oluştu',
      error: error.message
    });
  }
});

// Takımı sil
router.delete('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    await Team.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Takım başarıyla silindi'
    });
  } catch (error) {
    console.error('Takım silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Takım silinirken hata oluştu',
      error: error.message
    });
  }
});

// Takıma üye ekle
router.post('/:id/members', async (req, res) => {
  try {
    const { userId } = req.body;

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    if (team.members.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı zaten takımda'
      });
    }

    team.members.push(userId);
    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email');

    res.json({
      success: true,
      message: 'Üye başarıyla eklendi',
      data: updatedTeam
    });
  } catch (error) {
    console.error('Üye ekleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Üye eklenirken hata oluştu',
      error: error.message
    });
  }
});

// Takımdan üye çıkar
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Takım bulunamadı'
      });
    }

    // Takım liderini çıkaramaz
    if (team.teamLeader.toString() === req.params.userId) {
      return res.status(400).json({
        success: false,
        message: 'Takım lideri takımdan çıkarılamaz. Önce başka bir lider atayın.'
      });
    }

    team.members = team.members.filter(
      member => member.toString() !== req.params.userId
    );
    await team.save();

    const updatedTeam = await Team.findById(team._id)
      .populate('teamLeader', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email');

    res.json({
      success: true,
      message: 'Üye başarıyla çıkarıldı',
      data: updatedTeam
    });
  } catch (error) {
    console.error('Üye çıkarma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Üye çıkarılırken hata oluştu',
      error: error.message
    });
  }
});

// Takım performans analizi
router.get('/:id/performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gereklidir'
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const performance = await Team.calculatePerformance(
      req.params.id,
      start,
      end
    );

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Performans analizi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Performans analizi yapılırken hata oluştu',
      error: error.message
    });
  }
});

// Tüm takımların performans karşılaştırması
router.get('/performance/comparison', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Başlangıç ve bitiş tarihi gereklidir'
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const teams = await Team.find({ isActive: true });
    
    const comparisons = await Promise.all(
      teams.map(async (team) => {
        try {
          const performance = await Team.calculatePerformance(
            team._id,
            start,
            end
          );
          return performance;
        } catch (error) {
          console.error(`Takım ${team.name} performans hatası:`, error);
          return null;
        }
      })
    );

    // Null değerleri filtrele
    const validComparisons = comparisons.filter(c => c !== null);

    res.json({
      success: true,
      data: validComparisons
    });
  } catch (error) {
    console.error('Performans karşılaştırma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Performans karşılaştırması yapılırken hata oluştu',
      error: error.message
    });
  }
});

module.exports = router;

