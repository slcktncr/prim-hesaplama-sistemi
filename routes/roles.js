const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const Role = require('../models/Role');
const User = require('../models/User');

// @route   GET /api/roles
// @desc    Tüm rolleri getir
// @access  Admin only
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/roles/:id
// @desc    Belirli bir rolü getir
// @access  Admin only
router.get('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!role) {
      return res.status(404).json({ message: 'Rol bulunamadı' });
    }

    res.json(role);
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/roles
// @desc    Yeni rol oluştur
// @access  Admin only
router.post('/', [auth, adminAuth], async (req, res) => {
  try {
    const { name, displayName, description, permissions } = req.body;

    // Rol adı kontrolü
    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return res.status(400).json({ message: 'Bu rol adı zaten kullanılıyor' });
    }

    const role = new Role({
      name: name.toLowerCase(),
      displayName,
      description,
      permissions,
      createdBy: req.user._id
    });

    await role.save();

    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Rol başarıyla oluşturuldu',
      role: populatedRole
    });
  } catch (error) {
    console.error('Create role error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Bu rol adı zaten kullanılıyor' });
    }
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/roles/:id
// @desc    Rolü güncelle
// @access  Admin only
router.put('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { displayName, description, permissions } = req.body;

    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Rol bulunamadı' });
    }

    // Sadece admin rolünün değiştirilmesini engelle
    if (role.name === 'admin') {
      return res.status(400).json({ message: 'Admin rolü değiştirilemez' });
    }

    role.displayName = displayName || role.displayName;
    role.description = description || role.description;
    role.permissions = permissions || role.permissions;

    await role.save();

    const populatedRole = await Role.findById(role._id)
      .populate('createdBy', 'name email');

    res.json({
      message: 'Rol başarıyla güncellendi',
      role: populatedRole
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/roles/:id
// @desc    Rolü sil
// @access  Admin only
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Rol bulunamadı' });
    }

    // Sadece admin rolünün silinmesini engelle
    if (role.name === 'admin') {
      return res.status(400).json({ message: 'Admin rolü silinemez' });
    }

    // Bu rolü kullanan kullanıcıları kontrol et
    const usersWithRole = await User.countDocuments({ role: role._id });
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Bu rol ${usersWithRole} kullanıcı tarafından kullanılıyor. Önce kullanıcıların rollerini değiştirin.` 
      });
    }

    await Role.findByIdAndDelete(req.params.id);

    res.json({ message: 'Rol başarıyla silindi' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/roles/permissions/list
// @desc    Tüm mevcut yetkileri listele
// @access  Admin only
router.get('/permissions/list', [auth, adminAuth], async (req, res) => {
  try {
    const permissionCategories = {
      general: {
        name: 'Genel Yetkiler',
        permissions: {
          canViewDashboard: 'Dashboard\'u görüntüleyebilir',
          canViewReports: 'Raporları görüntüleyebilir',
          canExportData: 'Veri dışa aktarabilir'
        }
      },
      sales: {
        name: 'Satış Yetkileri',
        permissions: {
          canViewSales: 'Satışları görüntüleyebilir',
          canCreateSales: 'Satış oluşturabilir',
          canEditSales: 'Satışları düzenleyebilir',
          canDeleteSales: 'Satışları silebilir',
          canViewAllSales: 'Tüm satışları görüntüleyebilir',
          canTransferSales: 'Satış transferi yapabilir',
          canCancelSales: 'Satış iptal edebilir',
          canModifySales: 'Satış değişikliği yapabilir',
          canImportSales: 'Satış içe aktarabilir'
        }
      },
      prims: {
        name: 'Prim Yetkileri',
        permissions: {
          canViewPrims: 'Primleri görüntüleyebilir',
          canManagePrimPeriods: 'Prim dönemlerini yönetebilir',
          canEditPrimRates: 'Prim oranlarını düzenleyebilir',
          canProcessPayments: 'Ödeme işlemleri yapabilir',
          canViewAllEarnings: 'Tüm hakedişleri görüntüleyebilir'
        }
      },
      communications: {
        name: 'İletişim Yetkileri',
        permissions: {
          canViewCommunications: 'İletişimleri görüntüleyebilir',
          canEditCommunications: 'İletişimleri düzenleyebilir',
          canViewAllCommunications: 'Tüm iletişimleri görüntüleyebilir'
        }
      },
      users: {
        name: 'Kullanıcı Yönetimi',
        permissions: {
          canViewUsers: 'Kullanıcıları görüntüleyebilir',
          canCreateUsers: 'Kullanıcı oluşturabilir',
          canEditUsers: 'Kullanıcıları düzenleyebilir',
          canDeleteUsers: 'Kullanıcıları silebilir',
          canManageRoles: 'Rolleri yönetebilir'
        }
      },
      system: {
        name: 'Sistem Yönetimi',
        permissions: {
          canAccessSystemSettings: 'Sistem ayarlarına erişebilir',
          canManageBackups: 'Yedekleri yönetebilir',
          canViewSystemLogs: 'Sistem loglarını görüntüleyebilir',
          canManageAnnouncements: 'Duyuruları yönetebilir'
        }
      },
      special: {
        name: 'Özel Yetkiler',
        permissions: {
          canViewPenalties: 'Cezaları görüntüleyebilir',
          canApplyPenalties: 'Ceza uygulayabilir',
          canOverrideValidations: 'Validasyonları geçebilir'
        }
      }
    };

    res.json(permissionCategories);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/roles/:id/toggle-status
// @desc    Rol durumunu aktif/pasif yap
// @access  Admin only
router.post('/:id/toggle-status', [auth, adminAuth], async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Rol bulunamadı' });
    }

    if (role.name === 'admin') {
      return res.status(400).json({ message: 'Admin rolünün durumu değiştirilemez' });
    }

    role.isActive = !role.isActive;
    await role.save();

    res.json({
      message: `Rol ${role.isActive ? 'aktif' : 'pasif'} hale getirildi`,
      role
    });
  } catch (error) {
    console.error('Toggle role status error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
