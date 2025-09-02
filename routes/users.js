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
// @access  Private (Admin only)
router.get('/salespeople', [auth, adminAuth], async (req, res) => {
  try {
    const salespeople = await User.find({ 
      isActive: true,
      role: 'temsilci'
    })
      .select('name email')
      .sort({ name: 1 });

    res.json(salespeople);
  } catch (error) {
    console.error('Get salespeople error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
