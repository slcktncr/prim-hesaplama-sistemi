const adminAuth = (req, res, next) => {
  try {
    // auth middleware'den sonra çalışır, req.user zaten set edilmiş olmalı
    if (!req.user) {
      return res.status(401).json({ message: 'Erişim reddedildi. Giriş yapmanız gerekiyor.' });
    }

    // Admin kontrolü - yeni sistem
    const isSystemAdmin = req.user.systemRole === 'admin';
    const hasAdminRole = req.user.role && req.user.role.name === 'admin';
    
    if (!isSystemAdmin && !hasAdminRole) {
      return res.status(403).json({ 
        message: 'Erişim reddedildi. Bu işlem için admin yetkisi gerekliyor.' 
      });
    }

    // Admin ise devam et
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
};

module.exports = adminAuth;
