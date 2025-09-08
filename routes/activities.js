const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const ActivityLog = require('../models/ActivityLog');

// @route   GET /api/activities
// @desc    Get recent activities for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 20, unreadOnly = 'false' } = req.query;
    
    let query = { user: req.user.id };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('user', 'name email')
      .lean();

    res.json(activities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/activities/unread-count
// @desc    Get unread activities count for current user
// @access  Private
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await ActivityLog.countDocuments({
      user: req.user.id,
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread activities count error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/activities/:id/read
// @desc    Mark activity as read
// @access  Private
router.post('/:id/read', auth, async (req, res) => {
  try {
    const activity = await ActivityLog.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!activity) {
      return res.status(404).json({ message: 'Aktivite bulunamadı' });
    }

    activity.isRead = true;
    await activity.save();

    res.json({ message: 'Aktivite okundu olarak işaretlendi' });
  } catch (error) {
    console.error('Mark activity as read error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/activities/mark-all-read
// @desc    Mark all activities as read for current user
// @access  Private
router.post('/mark-all-read', auth, async (req, res) => {
  try {
    await ActivityLog.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'Tüm aktiviteler okundu olarak işaretlendi' });
  } catch (error) {
    console.error('Mark all activities as read error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/activities/system
// @desc    Get system-wide activities (for admins)
// @access  Private (Admin only)
router.get('/system', [auth, adminAuth], async (req, res) => {
  try {
    const { limit = 50, severity, action } = req.query;
    
    let query = {};
    
    if (severity) {
      query.severity = severity;
    }
    
    if (action) {
      query.action = action;
    }

    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('user', 'name email')
      .lean();

    res.json(activities);
  } catch (error) {
    console.error('Get system activities error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/activities/stats
// @desc    Get activity statistics (for admins)
// @access  Private (Admin only)
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Activity count by action
    const actionStats = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Activity count by user
    const userStats = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          count: 1,
          'user.name': 1,
          'user.email': 1
        }
      }
    ]);

    // Activity count by day
    const dailyStats = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Severity distribution
    const severityStats = await ActivityLog.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      actionStats,
      userStats,
      dailyStats,
      severityStats,
      dateRange: { startDate, endDate: new Date() }
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
