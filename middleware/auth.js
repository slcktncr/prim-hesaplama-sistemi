const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT token doğrulama
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı, erişim reddedildi' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prim_hesaplama_jwt_secret_key_2024');
    const user = await User.findById(decoded.id).populate('role', 'name displayName permissions');

    if (!user || !user.isActive || !user.isApproved) {
      return res.status(401).json({ message: 'Hesabınız henüz onaylanmamış veya aktif değil' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Geçersiz token' });
  }
};

// Admin yetkisi kontrolü
const adminAuth = async (req, res, next) => {
  try {
    // Sistem admin'i veya admin yetkilerine sahip rol
    const isSystemAdmin = req.user.systemRole === 'admin';
    const hasAdminRole = req.user.role && req.user.role.name === 'admin';
    
    if (!isSystemAdmin && !hasAdminRole) {
      return res.status(403).json({ message: 'Admin yetkisi gereklidir' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Yetki kontrolü hatası' });
  }
};

// Rol yetkisi kontrolü
const hasPermission = (permission) => async (req, res, next) => {
  try {
    // Sistem admin'i her şeyi yapabilir
    if (req.user.systemRole === 'admin') {
      return next();
    }

    // Kullanıcının rolü varsa onun yetkilerini kontrol et
    if (req.user.role && req.user.role.permissions) {
      if (req.user.role.permissions[permission]) {
        return next();
      }
    }

    // Eski yetki sistemini de kontrol et (geriye uyumluluk)
    if (req.user.permissions && req.user.permissions[permission]) {
      return next();
    }

    return res.status(403).json({ 
      message: `Bu işlem için "${permission}" yetkisi gereklidir` 
    });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ message: 'Yetki kontrolü hatası' });
  }
};

// Birden fazla yetki kontrolü (herhangi biri yeterli)
const hasAnyPermission = (permissions) => async (req, res, next) => {
  try {
    // Sistem admin'i her şeyi yapabilir
    if (req.user.systemRole === 'admin') {
      return next();
    }

    let hasAccess = false;

    // Kullanıcının rolü varsa onun yetkilerini kontrol et
    if (req.user.role && req.user.role.permissions) {
      hasAccess = permissions.some(permission => 
        req.user.role.permissions[permission]
      );
    }

    // Eski yetki sistemini de kontrol et (geriye uyumluluk)
    if (!hasAccess && req.user.permissions) {
      hasAccess = permissions.some(permission => 
        req.user.permissions[permission]
      );
    }

    if (hasAccess) {
      return next();
    }

    return res.status(403).json({ 
      message: `Bu işlem için şu yetkilerden biri gereklidir: ${permissions.join(', ')}` 
    });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ message: 'Yetki kontrolü hatası' });
  }
};

// Eski isimlerle de export et (backward compatibility)
const protect = auth;
const authorize = (roles) => (req, res, next) => {
  const userRole = req.user.systemRole || req.user.role?.name;
  if (!roles.includes(userRole)) {
    return res.status(403).json({ message: 'Bu işlem için yetkiniz bulunmamaktadır' });
  }
  next();
};

module.exports = { 
  auth, 
  adminAuth, 
  hasPermission,
  hasAnyPermission,
  protect, 
  authorize 
};
