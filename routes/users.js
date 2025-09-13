const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all active users (for admin)
// @access  Private (Admin only)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('_id name email role createdAt updatedAt permissions customRole firstName lastName')
      .populate('customRole', 'name displayName')
      .sort({ name: 1 });
    
    console.log('🔍 Total users found:', users.length);
    console.log('🔍 Sample user (first):', users[0]);
    console.log('🔍 Users with customRole:', users.filter(u => u.customRole).map(u => ({ 
      name: u.name, 
      role: u.role, 
      customRole: u.customRole,
      createdAt: u.createdAt 
    })));
    console.log('🔍 Users without createdAt:', users.filter(u => !u.createdAt).map(u => u.name));

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/users/salespeople
// @desc    Get all salespeople (for transfer operations)
// @access  Private
router.get('/salespeople', auth, async (req, res) => {
  try {
    const salespeople = await User.find({ 
      isActive: true,
      isApproved: true,
      role: 'salesperson' // Sadece satış temsilcileri, ziyaretçiler dahil değil
    })
      .select('name email firstName lastName')
      .sort({ name: 1 });

    res.json(salespeople);
  } catch (error) {
    console.error('Get salespeople error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/users/all-users
// @desc    Get all active users (for filtering)
// @access  Private (Admin only)
router.get('/all-users', [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.find({ 
      isActive: true,
      isApproved: true
    })
      .select('name email role permissions')
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/users/for-filters
// @desc    Get all active users for filtering (accessible to all users)
// @access  Private (All authenticated users)
router.get('/for-filters', auth, async (req, res) => {
  try {
    const users = await User.find({ 
      isActive: true,
      isApproved: true
    })
      .select('name email role')
      .sort({ name: 1 });

    console.log(`✅ Returning ${users.length} users for filters`);
    res.json(users);
  } catch (error) {
    console.error('Get users for filters error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/users/pending
// @desc    Get pending approval users
// @access  Private (Admin only)
router.get('/pending', [auth, adminAuth], async (req, res) => {
  try {
    const pendingUsers = await User.find({ 
      isApproved: false,
      isActive: false 
    })
      .select('firstName lastName name email role createdAt')
      .sort({ createdAt: -1 });

    res.json(pendingUsers);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/users/:id/approve
// @desc    Approve user
// @access  Private (Admin only)
router.put('/:id/approve', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    if (user.isApproved) {
      return res.status(400).json({ message: 'Kullanıcı zaten onaylanmış' });
    }

    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    await user.save();

    const approvedUser = await User.findById(user._id)
      .select('firstName lastName name email role isActive isApproved approvedAt')
      .populate('approvedBy', 'name email');

    res.json({
      message: 'Kullanıcı başarıyla onaylandı',
      user: approvedUser
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/users/:id/reject
// @desc    Reject user
// @access  Private (Admin only)
router.delete('/:id/reject', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    if (user.isApproved) {
      return res.status(400).json({ message: 'Onaylanmış kullanıcı reddedilemez' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'Kullanıcı kaydı reddedildi ve silindi' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Change user role (supports both system roles and custom roles)
// @access  Private (Admin only)
router.put('/:id/role', [auth, adminAuth], async (req, res) => {
  try {
    const { role, customRole } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Kendini admin yapamaz (güvenlik)
    if (req.user._id.toString() === user._id.toString() && role === 'admin') {
      return res.status(400).json({ message: 'Kendi rolünüzü değiştiremezsiniz' });
    }

    // Sistem rolü değiştiriliyorsa
    if (role) {
      if (!['admin', 'salesperson', 'visitor'].includes(role)) {
        return res.status(400).json({ message: 'Geçersiz sistem rolü' });
      }

      user.role = role;
      user.customRole = null; // Sistem rolü seçildiğinde özel rolü temizle
      await user.save();

      const updatedUser = await User.findById(user._id)
        .select('firstName lastName name email role isActive isApproved customRole')
        .populate('customRole', 'name displayName');

      return res.json({
        message: `Kullanıcı sistem rolü ${role === 'admin' ? 'Admin' : role === 'visitor' ? 'Ziyaretçi' : 'Satış Temsilcisi'} olarak güncellendi`,
        user: updatedUser
      });
    }

    // Özel rol atanıyorsa
    if (customRole) {
      const Role = require('../models/Role');
      const roleExists = await Role.findById(customRole);
      
      if (!roleExists) {
        return res.status(400).json({ message: 'Geçersiz özel rol' });
      }

      user.customRole = customRole;
      user.role = 'salesperson'; // Özel rol atanırken sistem rolü salesperson yap
      await user.save();

      const updatedUser = await User.findById(user._id)
        .select('firstName lastName name email role isActive isApproved customRole')
        .populate('customRole', 'name displayName');

      return res.json({
        message: `Kullanıcıya "${roleExists.displayName}" rolü atandı`,
        user: updatedUser
      });
    }

    return res.status(400).json({ message: 'Rol veya özel rol belirtilmeli' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/users/:id/permissions
// @desc    Update user permissions (admin only)
// @access  Private (Admin only)
router.put('/:id/permissions', [auth, adminAuth], async (req, res) => {
  try {
    const { permissions } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Admin rolündeki kullanıcıların izinleri değiştirilemez
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Admin kullanıcıların izinleri değiştirilemez' });
    }

    user.permissions = { ...user.permissions, ...permissions };
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('firstName lastName name email role permissions');

    res.json({
      message: 'Kullanıcı yetkileri başarıyla güncellendi',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user information (admin only)
// @access  Private (Admin only)
router.put('/:id', [
  auth, 
  adminAuth,
  body('firstName').notEmpty().withMessage('Ad gereklidir'),
  body('lastName').notEmpty().withMessage('Soyad gereklidir'),
  body('email').isEmail().withMessage('Geçerli bir email adresi gereklidir'),
  body('role').isIn(['admin', 'salesperson', 'visitor']).withMessage('Geçerli bir rol seçilmelidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veriler', 
        errors: errors.array() 
      });
    }

    const { firstName, lastName, email, role, isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Kendi kendini admin'den çıkaramaz
    if (req.user._id.toString() === req.params.id && req.user.role === 'admin' && role !== 'admin') {
      return res.status(400).json({ message: 'Kendi admin rolünüzü değiştiremezsiniz' });
    }

    // Email benzersizlik kontrolü
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      _id: { $ne: req.params.id }
    });
    if (existingUser) {
      return res.status(400).json({ message: 'Bu email adresi zaten kullanılıyor' });
    }

    // Kullanıcı bilgilerini güncelle
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    user.name = `${firstName.trim()} ${lastName.trim()}`;
    user.email = email.toLowerCase();
    user.role = role;
    user.isActive = isActive !== undefined ? isActive : user.isActive;
    user.updatedAt = new Date();

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('firstName lastName name email role isActive isApproved createdAt updatedAt permissions')
      .populate('approvedBy', 'name email');

    res.json({
      message: 'Kullanıcı bilgileri başarıyla güncellendi',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/users/:id/communication-requirement
// @desc    İletişim kaydı zorunluluğunu güncelle
// @access  Private (Admin only)
router.put('/:id/communication-requirement', [auth, adminAuth], async (req, res) => {
  try {
    const { requiresCommunicationEntry, exemptReason } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // İletişim zorunluluğu durumunu güncelle
    user.requiresCommunicationEntry = requiresCommunicationEntry;
    
    if (!requiresCommunicationEntry) {
      // Muafiyet veriliyor
      user.communicationExemptReason = exemptReason;
      user.communicationExemptBy = req.user.id;
      user.communicationExemptAt = new Date();
    } else {
      // Muafiyet kaldırılıyor
      user.communicationExemptReason = undefined;
      user.communicationExemptBy = undefined;
      user.communicationExemptAt = undefined;
    }

    await user.save();

    res.json({
      message: requiresCommunicationEntry 
        ? 'İletişim kaydı zorunluluğu aktifleştirildi'
        : 'İletişim kaydı zorunluluğu kaldırıldı',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        requiresCommunicationEntry: user.requiresCommunicationEntry,
        communicationExemptReason: user.communicationExemptReason,
        communicationExemptAt: user.communicationExemptAt
      }
    });

  } catch (error) {
    console.error('Update communication requirement error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/users/communication-settings
// @desc    Tüm kullanıcıların iletişim ayarlarını getir
// @access  Private (Admin only)
router.get('/communication-settings', [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.find({ 
      role: 'salesperson', // Sadece satış temsilcileri, ziyaretçiler dahil değil
      isApproved: true 
    })
    .select('name email isActive requiresCommunicationEntry communicationExemptReason communicationExemptBy communicationExemptAt')
    .populate('communicationExemptBy', 'name')
    .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Get communication settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
