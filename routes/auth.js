const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// JWT token oluşturma
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'prim_hesaplama_jwt_secret_key_2024', {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/register
// @desc    Kullanıcı kaydı
// @access  Public (sadece ilk admin için, sonra admin tarafından)
router.post('/register', [
  body('name').trim().notEmpty().withMessage('İsim gereklidir'),
  body('email').isEmail().withMessage('Geçerli bir email giriniz'),
  body('password').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalıdır'),
  body('role').optional().isIn(['admin', 'temsilci']).withMessage('Geçerli bir rol seçiniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    // Kullanıcı var mı kontrol et
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Bu email ile kayıtlı kullanıcı bulunmaktadır' });
    }

    // İlk kullanıcı admin olacak ve otomatik onaylanacak
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    // Yeni kullanıcı oluştur
    const user = new User({
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || '',
      name,
      email,
      password,
      role: isFirstUser ? 'admin' : 'salesperson',
      isActive: isFirstUser, // İlk kullanıcı aktif
      isApproved: isFirstUser // İlk kullanıcı onaylı
    });

    await user.save();

    // Token oluştur
    const token = generateToken(user._id);

    res.status(201).json({
      message: isFirstUser 
        ? 'İlk admin kullanıcı başarıyla oluşturuldu' 
        : 'Kayıt başarılı! Hesabınız admin onayı bekliyor.',
      token: isFirstUser ? token : null, // Sadece admin için token ver
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        requiresApproval: !isFirstUser
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/auth/login
// @desc    Kullanıcı girişi
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Geçerli bir email giriniz'),
  body('password').notEmpty().withMessage('Şifre gereklidir')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Kullanıcıyı bul (role populate ile)
    const user = await User.findOne({ email }).populate('role', 'name displayName permissions');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Geçersiz kullanıcı bilgileri' });
    }

    // Şifre kontrolü
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Geçersiz kullanıcı bilgileri' });
    }

    // Token oluştur
    const token = generateToken(user._id);

    res.json({
      message: 'Giriş başarılı',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        systemRole: user.systemRole,
        isActive: user.isActive,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/auth/me
// @desc    Kullanıcı bilgilerini getir
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('role', 'name displayName permissions');
    
    console.log('🔍 /api/auth/me - User info:', {
      id: user._id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
      role: user.role,
      isActive: user.isActive,
      isApproved: user.isApproved
    });
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/auth/profile
// @desc    Kullanıcı profil bilgilerini güncelle
// @access  Private
router.put('/profile', auth, [
  body('firstName').trim().notEmpty().withMessage('Ad gereklidir'),
  body('lastName').trim().notEmpty().withMessage('Soyad gereklidir'),
  body('email').isEmail().withMessage('Geçerli bir email giriniz'),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('Yeni şifre en az 6 karakter olmalıdır')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, currentPassword, newPassword } = req.body;

    // Kullanıcıyı bul
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Email değişikliği varsa, başka kullanıcı tarafından kullanılıp kullanılmadığını kontrol et
    if (email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Bu email başka bir kullanıcı tarafından kullanılıyor' });
      }
    }

    // Şifre değişikliği varsa
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Şifre değiştirmek için mevcut şifrenizi girmelisiniz' });
      }

      // Mevcut şifre kontrolü
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Mevcut şifre yanlış' });
      }

      user.password = newPassword; // Pre-save hook otomatik hash'leyecek
    }

    // Profil bilgilerini güncelle
    user.firstName = firstName;
    user.lastName = lastName;
    user.name = `${firstName} ${lastName}`;
    user.email = email;

    await user.save();

    // Güncellenmiş kullanıcı bilgilerini döndür (şifre hariç)
    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      message: 'Profil başarıyla güncellendi',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET/POST /api/auth/fix-admin
// @desc    Fix existing admin account (temporary endpoint)
// @access  Public (one-time use)
const fixAdmin = async (req, res) => {
  try {
    // GET veya POST'dan email al
    const email = req.body?.email || req.query?.email || 'selcuktuncer@gmail.com';
    
    if (email !== 'selcuktuncer@gmail.com') {
      return res.status(403).json({ message: 'Bu endpoint sadece belirli hesap için' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Admin hesabını düzelt - TEK SİSTEM
    const Role = require('../models/Role');
    let adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      // Admin rolü yoksa oluştur
      adminRole = new Role({
        name: 'admin',
        displayName: 'Sistem Yöneticisi',
        description: 'Tüm sistem yetkilerine sahip süper kullanıcı',
        isSystemRole: true,
        permissions: {
          canViewDashboard: true,
          canViewReports: true,
          canExportData: true,
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: true,
          canViewAllSales: true,
          canTransferSales: true,
          canCancelSales: true,
          canModifySales: true,
          canImportSales: true,
          canViewPrims: true,
          canManagePrimPeriods: true,
          canEditPrimRates: true,
          canProcessPayments: true,
          canViewAllEarnings: true,
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true,
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canManageRoles: true,
          canAccessSystemSettings: true,
          canManageBackups: true,
          canViewSystemLogs: true,
          canManageAnnouncements: true,
          canViewPenalties: true,
          canApplyPenalties: true,
          canOverrideValidations: true
        },
        createdBy: null
      });
      await adminRole.save();
    }
    
    user.isActive = true;
    user.isApproved = true;
    user.role = adminRole._id; // TEK SİSTEM: Sadece role field'ı
    
    // firstName/lastName eksikse düzelt
    if (!user.firstName || !user.lastName) {
      const nameParts = user.name ? user.name.split(' ') : ['Admin', 'User'];
      user.firstName = nameParts[0] || 'Admin';
      user.lastName = nameParts.slice(1).join(' ') || 'User';
    }

    await user.save();

    console.log('✅ Admin hesabı düzeltildi:', email);

    // Populate edilmiş kullanıcıyı döndür
    const updatedUser = await User.findById(user._id)
      .populate('role', 'name displayName permissions');

    res.json({
      message: 'Admin hesabı başarıyla düzeltildi (TEK SİSTEM)',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        isApproved: updatedUser.isApproved
      }
    });
  } catch (error) {
    console.error('Fix admin error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

// @route   GET /api/auth/emergency-admin-fix
// @desc    Emergency admin fix - NEW ROLE SYSTEM
// @access  Public (emergency use only)
router.get('/emergency-admin-fix', async (req, res) => {
  try {
    const User = require('../models/User');
    const Role = require('../models/Role');
    
    console.log('🚨 Emergency admin fix başlatılıyor (YENİ SİSTEM)...');
    
    // Admin rolünü bul
    let adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
      console.log('⚠️ Admin rolü bulunamadı, oluşturuluyor...');
      // Admin rolü yoksa oluştur
      adminRole = new Role({
        name: 'admin',
        displayName: 'Sistem Yöneticisi',
        description: 'Tüm sistem yetkilerine sahip süper kullanıcı',
        isSystemRole: true,
        permissions: {
          // Tüm yetkiler true
          canViewDashboard: true,
          canViewReports: true,
          canExportData: true,
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: true,
          canViewAllSales: true,
          canTransferSales: true,
          canCancelSales: true,
          canModifySales: true,
          canImportSales: true,
          canViewPrims: true,
          canManagePrimPeriods: true,
          canEditPrimRates: true,
          canProcessPayments: true,
          canViewAllEarnings: true,
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true,
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canManageRoles: true,
          canAccessSystemSettings: true,
          canManageBackups: true,
          canViewSystemLogs: true,
          canManageAnnouncements: true,
          canViewPenalties: true,
          canApplyPenalties: true,
          canOverrideValidations: true
        },
        createdBy: null // Sistem oluşturdu
      });
      await adminRole.save();
      console.log('✅ Admin rolü oluşturuldu');
    }
    
    // Selçuk TUNÇER'i bul
    const user = await User.findOne({ 
      email: 'selcuktuncer@gmail.com' 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Kullanıcı bulunamadı: selcuktuncer@gmail.com' 
      });
    }

    console.log('📋 Mevcut durum:', {
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isApproved: user.isApproved
    });

    // YENİ SİSTEM: Sadece role field'ı
    user.role = adminRole._id;
    user.isActive = true;
    user.isApproved = true;
    user.approvedAt = new Date();

    // firstName/lastName eksikse düzelt
    if (!user.firstName || !user.lastName) {
      const nameParts = user.name ? user.name.split(' ') : ['Selçuk', 'TUNÇER'];
      user.firstName = nameParts[0] || 'Selçuk';
      user.lastName = nameParts.slice(1).join(' ') || 'TUNÇER';
    }

    await user.save();

    // Populate edilmiş kullanıcıyı döndür
    const updatedUser = await User.findById(user._id)
      .populate('role', 'name displayName permissions');

    console.log('✅ Emergency admin fix tamamlandı (YENİ SİSTEM)');

    res.json({
      success: true,
      message: 'Admin yetkisi başarıyla düzeltildi (YENİ SİSTEM)',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        isApproved: updatedUser.isApproved
      }
    });

  } catch (error) {
    console.error('❌ Emergency admin fix error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Sunucu hatası',
      error: error.message 
    });
  }
});

// @route   GET /api/auth/create-default-roles
// @desc    Create default roles (emergency endpoint)
// @access  Public (emergency use only)
router.get('/create-default-roles', async (req, res) => {
  try {
    const Role = require('../models/Role');
    
    console.log('🔧 Varsayılan roller oluşturuluyor...');

    // Admin kullanıcısını bul (TEK SİSTEM)
    let adminRole = await Role.findOne({ name: 'admin' });
    
    // Admin rolü yoksa önce oluştur
    if (!adminRole) {
      console.log('⚠️ Admin rolü bulunamadı, oluşturuluyor...');
      adminRole = new Role({
        name: 'admin',
        displayName: 'Sistem Yöneticisi',
        description: 'Tüm sistem yetkilerine sahip süper kullanıcı',
        isSystemRole: true,
        permissions: {
          // Tüm yetkiler true
          canViewDashboard: true,
          canViewReports: true,
          canExportData: true,
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: true,
          canViewAllSales: true,
          canTransferSales: true,
          canCancelSales: true,
          canModifySales: true,
          canImportSales: true,
          canViewPrims: true,
          canManagePrimPeriods: true,
          canEditPrimRates: true,
          canProcessPayments: true,
          canViewAllEarnings: true,
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true,
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canManageRoles: true,
          canAccessSystemSettings: true,
          canManageBackups: true,
          canViewSystemLogs: true,
          canManageAnnouncements: true,
          canViewPenalties: true,
          canApplyPenalties: true,
          canOverrideValidations: true
        },
        createdBy: null // Sistem oluşturdu
      });
      await adminRole.save();
    }
    
    // Admin kullanıcı var mı kontrol et
    const adminUser = await User.findOne({ email: 'selcuktuncer@gmail.com' })
      .populate('role');
    
    if (!adminUser) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin kullanıcı bulunamadı' 
      });
    }

    // Mevcut rolleri kontrol et
    const existingRoles = await Role.find({});
    console.log(`📊 Mevcut rol sayısı: ${existingRoles.length}`);

    const defaultRoles = [
      {
        name: 'admin',
        displayName: 'Sistem Yöneticisi',
        description: 'Tüm sistem yetkilerine sahip süper kullanıcı',
        isSystemRole: true,
        permissions: {
          // Genel Yetkiler - Tümü true
          canViewDashboard: true,
          canViewReports: true,
          canExportData: true,
          
          // Satış Yetkileri - Tümü true
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: true,
          canViewAllSales: true,
          canTransferSales: true,
          canCancelSales: true,
          canModifySales: true,
          canImportSales: true,
          
          // Prim Yetkileri - Tümü true
          canViewPrims: true,
          canManagePrimPeriods: true,
          canEditPrimRates: true,
          canProcessPayments: true,
          canViewAllEarnings: true,
          
          // İletişim Yetkileri - Tümü true
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: true,
          
          // Kullanıcı Yönetimi - Tümü true
          canViewUsers: true,
          canCreateUsers: true,
          canEditUsers: true,
          canDeleteUsers: true,
          canManageRoles: true,
          
          // Sistem Yönetimi - Tümü true
          canAccessSystemSettings: true,
          canManageBackups: true,
          canViewSystemLogs: true,
          canManageAnnouncements: true,
          
          // Özel Yetkiler - Tümü true
          canViewPenalties: true,
          canApplyPenalties: true,
          canOverrideValidations: true
        }
      },
      {
        name: 'salesperson',
        displayName: 'Satış Temsilcisi',
        description: 'Standart satış temsilcisi yetkileri',
        isSystemRole: true,
        permissions: {
          // Genel Yetkiler
          canViewDashboard: true,
          canViewReports: true,
          canExportData: false,
          
          // Satış Yetkileri
          canViewSales: true,
          canCreateSales: true,
          canEditSales: true,
          canDeleteSales: false,
          canViewAllSales: false,
          canTransferSales: false,
          canCancelSales: false,
          canModifySales: false,
          canImportSales: false,
          
          // Prim Yetkileri
          canViewPrims: true,
          canManagePrimPeriods: false,
          canEditPrimRates: false,
          canProcessPayments: false,
          canViewAllEarnings: false,
          
          // İletişim Yetkileri
          canViewCommunications: true,
          canEditCommunications: true,
          canViewAllCommunications: false,
          
          // Kullanıcı Yönetimi
          canViewUsers: false,
          canCreateUsers: false,
          canEditUsers: false,
          canDeleteUsers: false,
          canManageRoles: false,
          
          // Sistem Yönetimi
          canAccessSystemSettings: false,
          canManageBackups: false,
          canViewSystemLogs: false,
          canManageAnnouncements: false,
          
          // Özel Yetkiler
          canViewPenalties: false,
          canApplyPenalties: false,
          canOverrideValidations: false
        }
      },
      {
        name: 'visitor',
        displayName: 'Ziyaretçi',
        description: 'Sadece görüntüleme yetkisi olan kullanıcı',
        isSystemRole: true,
        permissions: {
          canViewDashboard: true,
          canViewReports: true,
          canExportData: false,
          canViewSales: true,
          canCreateSales: false,
          canEditSales: false,
          canDeleteSales: false,
          canViewAllSales: true,
          canTransferSales: false,
          canCancelSales: false,
          canModifySales: false,
          canImportSales: false,
          canViewPrims: true,
          canManagePrimPeriods: false,
          canEditPrimRates: false,
          canProcessPayments: false,
          canViewAllEarnings: true,
          canViewCommunications: true,
          canEditCommunications: false,
          canViewAllCommunications: true,
          canViewUsers: false,
          canCreateUsers: false,
          canEditUsers: false,
          canDeleteUsers: false,
          canManageRoles: false,
          canAccessSystemSettings: false,
          canManageBackups: false,
          canViewSystemLogs: false,
          canManageAnnouncements: false,
          canViewPenalties: false,
          canApplyPenalties: false,
          canOverrideValidations: false
        }
      }
    ];

    const createdRoles = [];
    
    for (const roleData of defaultRoles) {
      const existingRole = await Role.findOne({ name: roleData.name });
      
      if (existingRole) {
        console.log(`⚠️ Rol zaten mevcut: ${roleData.displayName}`);
        continue;
      }

      const role = new Role({
        ...roleData,
        createdBy: adminRole._id // adminUser yerine adminRole kullan
      });

      await role.save();
      createdRoles.push(role);
      console.log(`✅ Rol oluşturuldu: ${roleData.displayName}`);
    }

    res.json({
      success: true,
      message: `${createdRoles.length} varsayılan rol oluşturuldu`,
      roles: createdRoles.map(r => ({
        name: r.name,
        displayName: r.displayName,
        description: r.description
      }))
    });

  } catch (error) {
    console.error('❌ Rol oluşturma hatası:', error);
    res.status(500).json({ 
      success: false,
      message: 'Rol oluşturma hatası',
      error: error.message 
    });
  }
});

// @route   GET /api/auth/debug-user
// @desc    Debug current user status (public for emergency)
// @access  Public (emergency use only)
router.get('/debug-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.toLowerCase() })
      .populate('role', 'name displayName permissions')
      .select('firstName lastName name email role isActive isApproved');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Kullanıcı bulunamadı' 
      });
    }

    // Role listesi de al
    const Role = require('../models/Role');
    const allRoles = await Role.find({}).select('name displayName isActive');

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved
      },
      allRoles: allRoles,
      debug: {
        hasRoleAdmin: user.role && user.role.name === 'admin',
        roleCount: allRoles.length,
        isAdmin: user.role && user.role.name === 'admin'
      }
    });

  } catch (error) {
    console.error('❌ Debug user hatası:', error);
    res.status(500).json({ 
      success: false,
      message: 'Debug hatası',
      error: error.message 
    });
  }
});

// @route   GET /api/auth/migrate-users-to-roles
// @desc    Migrate existing users to new role system
// @access  Public (emergency use only)
router.get('/migrate-users-to-roles', async (req, res) => {
  try {
    const User = require('../models/User');
    const Role = require('../models/Role');
    
    console.log('🔄 Kullanıcı migration başlatılıyor...');
    
    // Rolleri bul
    const salespersonRole = await Role.findOne({ name: 'salesperson' });
    if (!salespersonRole) {
      return res.status(404).json({ 
        success: false,
        message: 'Satış temsilcisi rolü bulunamadı. Önce rolleri oluşturun.' 
      });
    }

    // Role'ü null olan kullanıcıları bul
    const usersWithoutRole = await User.find({ 
      role: null,
      email: { $ne: 'selcuktuncer@gmail.com' } // Admin hariç
    });

    console.log(`📊 Migration yapılacak kullanıcı sayısı: ${usersWithoutRole.length}`);

    let migratedCount = 0;
    const results = [];

    for (const user of usersWithoutRole) {
      try {
        user.role = salespersonRole._id;
        await user.save();
        migratedCount++;
        results.push({
          name: user.name,
          email: user.email,
          status: 'success'
        });
        console.log(`✅ ${user.name} → Satış Temsilcisi`);
      } catch (error) {
        results.push({
          name: user.name,
          email: user.email,
          status: 'error',
          error: error.message
        });
        console.error(`❌ ${user.name} migration hatası:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `${migratedCount}/${usersWithoutRole.length} kullanıcı migration tamamlandı`,
      migratedCount,
      totalCount: usersWithoutRole.length,
      results: results
    });

  } catch (error) {
    console.error('❌ User migration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Migration hatası',
      error: error.message 
    });
  }
});

// @route   GET /api/auth/check-roles-status
// @desc    Check current roles and users status
// @access  Public (debug use only)
router.get('/check-roles-status', async (req, res) => {
  try {
    const User = require('../models/User');
    const Role = require('../models/Role');
    
    // Tüm rolleri getir
    const allRoles = await Role.find({}).select('name displayName isActive');
    
    // Tüm kullanıcıları getir
    const allUsers = await User.find({})
      .populate('role', 'name displayName')
      .select('name email role isActive isApproved')
      .sort({ name: 1 });

    // Rol dağılımını hesapla
    const roleDistribution = {};
    allUsers.forEach(user => {
      const roleName = user.role ? user.role.name : 'no_role';
      roleDistribution[roleName] = (roleDistribution[roleName] || 0) + 1;
    });

    res.json({
      success: true,
      summary: {
        totalRoles: allRoles.length,
        totalUsers: allUsers.length,
        roleDistribution
      },
      roles: allRoles,
      users: allUsers.map(user => ({
        name: user.name,
        email: user.email,
        role: user.role ? user.role.displayName : 'Rol Yok',
        roleName: user.role ? user.role.name : null,
        isActive: user.isActive,
        isApproved: user.isApproved
      }))
    });

  } catch (error) {
    console.error('❌ Check roles status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Status check hatası',
      error: error.message 
    });
  }
});

// @route   POST /api/auth/assign-role-by-email
// @desc    Assign specific role to user by email (emergency use)
// @access  Public (emergency use only)
router.post('/assign-role-by-email', async (req, res) => {
  try {
    const { email, roleName } = req.body;
    
    if (!email || !roleName) {
      return res.status(400).json({ 
        success: false,
        message: 'Email ve roleName gerekli' 
      });
    }

    const User = require('../models/User');
    const Role = require('../models/Role');
    
    // Kullanıcıyı bul
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: `Kullanıcı bulunamadı: ${email}` 
      });
    }

    // Rolü bul
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(404).json({ 
        success: false,
        message: `Rol bulunamadı: ${roleName}` 
      });
    }

    // Rolü ata
    user.role = role._id;
    await user.save();

    // Güncellenmiş kullanıcıyı döndür
    const updatedUser = await User.findById(user._id)
      .populate('role', 'name displayName')
      .select('name email role');

    res.json({
      success: true,
      message: `${user.name} kullanıcısına "${role.displayName}" rolü atandı`,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });

  } catch (error) {
    console.error('❌ Assign role error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Rol atama hatası',
      error: error.message 
    });
  }
});

// Hem GET hem POST için register et
router.get('/fix-admin', fixAdmin);
router.post('/fix-admin', fixAdmin);

module.exports = router;
