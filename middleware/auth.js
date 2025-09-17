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

// Admin yetkisi kontrolü - Tek rol sistemi
const adminAuth = async (req, res, next) => {
  try {
    // Sadece admin rolü kontrolü - TEK SİSTEM
    const hasAdminRole = req.user.role && req.user.role.name === 'admin';
    
    if (!hasAdminRole) {
      console.log('❌ Admin yetki kontrolü başarısız:', {
        userId: req.user._id,
        userRole: req.user.role?.name || 'rol yok',
        hasRole: !!req.user.role
      });
      return res.status(403).json({ message: 'Admin yetkisi gereklidir' });
    }
    
    console.log('✅ Admin yetki kontrolü başarılı:', req.user.role.name);
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ message: 'Yetki kontrolü hatası' });
  }
};

// Rol yetkisi kontrolü - Tek sistem
const hasPermission = (permission) => async (req, res, next) => {
  try {
    // Rolün yetkisini kontrol et
    if (req.user.role && req.user.role.permissions && req.user.role.permissions[permission]) {
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

// Birden fazla yetki kontrolü (herhangi biri yeterli) - Tek sistem
const hasAnyPermission = (permissions) => async (req, res, next) => {
  try {
    let hasAccess = false;

    // Kullanıcının rolü varsa onun yetkilerini kontrol et
    if (req.user.role && req.user.role.permissions) {
      hasAccess = permissions.some(permission => 
        req.user.role.permissions[permission]
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
  const userRole = req.user.role?.name;
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
