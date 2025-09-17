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
      .select('_id name email role createdAt updatedAt firstName lastName')
      .populate('role', 'name displayName permissions')
      .sort({ name: 1 });
    
    console.log('🔍 Total users found:', users.length);
    console.log('🔍 Sample user (first):', users[0]);
    console.log('🔍 Users with role:', users.filter(u => u.role).map(u => ({ 
      name: u.name, 
      role: u.role,
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
    // Önce salesperson rolünü bul
    const Role = require('../models/Role');
    const salespersonRole = await Role.findOne({ name: 'salesperson' });
    
    if (!salespersonRole) {
      console.log('❌ Salesperson role not found');
      return res.status(404).json({ message: 'Satış temsilcisi rolü bulunamadı' });
    }

    const salespeople = await User.find({ 
      isActive: true,
      isApproved: true,
      role: salespersonRole._id // ObjectId kullan
    })
      .populate('role', 'name displayName permissions')
      .select('name email firstName lastName role')
      .sort({ name: 1 });

    console.log(`✅ Found ${salespeople.length} salespeople`);
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
      .select('_id name email role individualPermissions createdAt updatedAt firstName lastName')
      .populate('role', 'name displayName permissions')
      .sort({ name: 1 });

    console.log('🔍 ALL-USERS: Total users found:', users.length);
    if (users.length > 0) {
      console.log('🔍 ALL-USERS: Sample user (first):', {
        name: users[0].name,
        email: users[0].email,
        role: users[0].role
      });
    }
    console.log('🔍 ALL-USERS: Users with role:', users.filter(u => u.role).map(u => ({ 
      name: u.name, 
      role: u.role,
      createdAt: u.createdAt 
    })));
    console.log('🔍 ALL-USERS: Users without createdAt:', users.filter(u => !u.createdAt).map(u => u.name));

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

    // Varsayılan rol ata (salesperson)
    if (!user.role) {
      const Role = require('../models/Role');
      const defaultRole = await Role.findOne({ name: 'salesperson', isActive: true });
      
      if (!defaultRole) {
        console.error('❌ Default salesperson role not found');
        return res.status(500).json({ message: 'Varsayılan rol bulunamadı' });
      }
      
      user.role = defaultRole._id;
      console.log(`✅ Assigned default role to ${user.name}: ${defaultRole.displayName}`);
    }

    user.isApproved = true;
    user.isActive = true;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    await user.save();

    const approvedUser = await User.findById(user._id)
      .select('firstName lastName name email role isActive isApproved approvedAt')
      .populate('role', 'name displayName permissions')
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
// @desc    Change user role (new unified role system)
// @access  Private (Admin only)
router.put('/:id/role', [auth, adminAuth], async (req, res) => {
  try {
    const { role } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Kendini admin yapamaz (güvenlik)
    if (req.user._id.toString() === user._id.toString() && role === 'admin') {
      return res.status(400).json({ message: 'Kendi rolünüzü değiştiremezsiniz' });
    }

    if (!role) {
      return res.status(400).json({ message: 'Rol belirtilmeli' });
    }

    // Rol kontrolü ve atama - Tek sistem
    const Role = require('../models/Role');
    const roleExists = await Role.findById(role);
    
    if (!roleExists) {
      return res.status(400).json({ message: 'Geçersiz rol' });
    }

    console.log(`🔄 ROLE CHANGE: ${user.name} → ${roleExists.displayName}`);
    console.log(`📋 Before: role = ${user.role}`);
    
    user.role = role;
    await user.save();
    
    console.log(`📋 After save: role = ${user.role}`);

    const updatedUser = await User.findById(user._id)
      .select('firstName lastName name email role isActive isApproved')
      .populate('role', 'name displayName permissions');

    console.log(`📋 After populate: role =`, updatedUser.role);

    const roleDisplayName = updatedUser.role?.displayName || 'Rol';

    res.json({
      message: `Kullanıcı rolü "${roleDisplayName}" olarak güncellendi`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/users/:id/permissions
// @desc    Update user role permissions (admin only) - YENİ SİSTEM
// @access  Private (Admin only)
router.put('/:id/permissions', [auth, adminAuth], async (req, res) => {
  try {
    console.log('🔧 BACKEND: Permissions update request:', {
      userId: req.params.id,
      requestBody: req.body,
      adminUser: req.user.name
    });

    const { permissions } = req.body;
    
    const user = await User.findById(req.params.id).populate('role');
    if (!user) {
      console.log('❌ BACKEND: User not found:', req.params.id);
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    console.log('👤 BACKEND: User found:', {
      name: user.name,
      email: user.email,
      role: user.role
    });

    // Admin rolündeki kullanıcıların izinleri değiştirilemez
    if (user.role && user.role.name === 'admin') {
      console.log('❌ BACKEND: Cannot update admin permissions');
      return res.status(400).json({ message: 'Admin kullanıcıların izinleri değiştirilemez' });
    }

    if (!user.role) {
      console.log('❌ BACKEND: User has no role');
      return res.status(400).json({ message: 'Kullanıcının rolü bulunamadı' });
    }

    // Kullanıcıya özel yetki override'larını güncelle (rol oluşturmak yerine)
    console.log('🔄 BACKEND: Updating individual permissions for user:', user.name);
    console.log('📋 BACKEND: Current individual permissions:', user.individualPermissions);
    console.log('📋 BACKEND: Incoming permissions:', permissions);

    // Individual permissions'ı güncelle
    const oldIndividualPermissions = { ...user.individualPermissions };
    
    // Sadece gönderilen permission'ları güncelle, diğerleri null kalır (rol yetkisini kullanır)
    Object.keys(permissions).forEach(permission => {
      if (user.individualPermissions.hasOwnProperty(permission)) {
        user.individualPermissions[permission] = permissions[permission];
      }
    });
    
    console.log('🔄 BACKEND: Individual permissions change:', {
      before: oldIndividualPermissions,
      incoming: permissions,
      after: user.individualPermissions
    });

    try {
      await user.save();
      console.log('✅ BACKEND: Individual permissions updated successfully');
    } catch (updateError) {
      console.error('❌ BACKEND: Error updating individual permissions:', updateError);
      throw updateError;
    }

    // Güncellenmiş kullanıcıyı döndür
    const updatedUser = await User.findById(user._id)
      .select('firstName lastName name email role individualPermissions')
      .populate('role', 'name displayName permissions');

    console.log('📤 BACKEND: Returning updated user:', {
      name: updatedUser.name,
      role: updatedUser.role
    });

    res.json({
      message: 'Kullanıcı yetkileri başarıyla güncellendi',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ BACKEND: Update user permissions error:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
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
    if (req.user._id.toString() === req.params.id && req.user.role && req.user.role.name === 'admin' && role !== 'admin') {
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

    // Rol kontrolü ve atama (TEK SİSTEM)
    if (role) {
      // Tanımlı rol kontrolü
      const Role = require('../models/Role');
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(400).json({ message: 'Geçersiz rol' });
      }
      user.role = role;
    } else {
      return res.status(400).json({ message: 'Rol seçilmelidir' });
    }

    // Kullanıcı bilgilerini güncelle
    user.firstName = firstName.trim();
    user.lastName = lastName.trim();
    user.name = `${firstName.trim()} ${lastName.trim()}`;
    user.email = email.toLowerCase();
    user.isActive = isActive !== undefined ? isActive : user.isActive;
    user.updatedAt = new Date();

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('firstName lastName name email role isActive isApproved createdAt updatedAt')
      .populate('role', 'name displayName permissions')
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
    const allUsers = await User.find({ 
      isApproved: true 
    })
    .populate('role', 'name')
    .populate('communicationExemptBy', 'name')
    .select('name email isActive requiresCommunicationEntry communicationExemptReason communicationExemptBy communicationExemptAt role')
    .sort({ name: 1 });
    
    // Admin rolünü filtrele (TEK SİSTEM)
    const users = allUsers.filter(user => 
      !(user.role && user.role.name === 'admin')
    );

    res.json(users);
  } catch (error) {
    console.error('Get communication settings error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
