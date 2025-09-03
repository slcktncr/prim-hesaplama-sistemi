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
    const user = await User.findById(decoded.id);

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
  protect, 
  authorize 
};
