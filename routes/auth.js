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

    // Kullanıcıyı bul
    const user = await User.findOne({ email });
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
        role: user.role
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
    const user = await User.findById(req.user.id).select('-password');
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

// @route   POST /api/auth/fix-admin
// @desc    Fix existing admin account (temporary endpoint)
// @access  Public (one-time use)
router.post('/fix-admin', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (email !== 'selcuktuncer@gmail.com') {
      return res.status(403).json({ message: 'Bu endpoint sadece belirli hesap için' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Admin hesabını düzelt
    user.isActive = true;
    user.isApproved = true;
    user.systemRole = 'admin'; // Yeni sistem için
    user.role = null; // Sistem admin'i için role null
    
    // firstName/lastName eksikse düzelt
    if (!user.firstName || !user.lastName) {
      const nameParts = user.name ? user.name.split(' ') : ['Admin', 'User'];
      user.firstName = nameParts[0] || 'Admin';
      user.lastName = nameParts.slice(1).join(' ') || 'User';
    }

    await user.save();

    console.log('✅ Admin hesabı düzeltildi:', email);

    res.json({
      message: 'Admin hesabı başarıyla düzeltildi',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        systemRole: user.systemRole,
        isActive: user.isActive,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error('Fix admin error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
