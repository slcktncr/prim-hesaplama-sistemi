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
    const user = await User.findById(decoded.id).populate('customRole', 'name displayName permissions');

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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin yetkisi gereklidir' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Yetki kontrolü hatası' });
  }
};

// Özel rol yetkisi kontrolü
const hasPermission = (permission) => async (req, res, next) => {
  try {
    // Admin her şeyi yapabilir
    if (req.user.role === 'admin') {
      return next();
    }

    // Özel rol varsa onun yetkilerini kontrol et
    if (req.user.customRole && req.user.customRole.permissions) {
      if (req.user.customRole.permissions[permission]) {
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
    // Admin her şeyi yapabilir
    if (req.user.role === 'admin') {
      return next();
    }

    let hasAccess = false;

    // Özel rol varsa onun yetkilerini kontrol et
    if (req.user.customRole && req.user.customRole.permissions) {
      hasAccess = permissions.some(permission => 
        req.user.customRole.permissions[permission]
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
  if (!roles.includes(req.user.role)) {
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
