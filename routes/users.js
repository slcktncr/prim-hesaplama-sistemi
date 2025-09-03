const express = require('express');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all active users (for admin)
// @access  Private (Admin only)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email role createdAt')
      .sort({ name: 1 });

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
      role: 'salesperson'
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
      .select('name email role')
      .sort({ name: 1 });

    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
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
// @desc    Change user role (admin only)
// @access  Private (Admin only)
router.put('/:id/role', [auth, adminAuth], async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['admin', 'salesperson'].includes(role)) {
      return res.status(400).json({ message: 'Geçersiz rol' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Kendini admin yapamaz (güvenlik)
    if (req.user._id.toString() === user._id.toString() && role === 'admin') {
      return res.status(400).json({ message: 'Kendi rolünüzü değiştiremezsiniz' });
    }

    user.role = role;
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('firstName lastName name email role isActive isApproved');

    res.json({
      message: `Kullanıcı rolü ${role === 'admin' ? 'Admin' : 'Satış Temsilcisi'} olarak güncellendi`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
