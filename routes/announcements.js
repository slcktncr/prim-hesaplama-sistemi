const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Announcement = require('../models/Announcement');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// @route   GET /api/announcements
// @desc    Get all active announcements for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { includeRead = 'false' } = req.query;
    
    let query = {
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    // If targetUsers is empty, it's for all users
    // If targetUsers has items, check if current user is included
    const announcements = await Announcement.find(query)
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    // Filter announcements for current user
    let userAnnouncements = announcements.filter(announcement => {
      // If no target users specified, it's for everyone
      if (!announcement.targetUsers || announcement.targetUsers.length === 0) {
        return true;
      }
      // Check if current user is in target users
      return announcement.targetUsers.some(userId => 
        userId.toString() === req.user.id.toString()
      );
    });

    // Filter read/unread if requested
    if (includeRead === 'false') {
      userAnnouncements = userAnnouncements.filter(announcement => {
        return !announcement.readBy.some(read => 
          read.user.toString() === req.user.id.toString()
        );
      });
    }

    // Add isRead flag for frontend
    userAnnouncements = userAnnouncements.map(announcement => ({
      ...announcement,
      isRead: announcement.readBy.some(read => 
        read.user.toString() === req.user.id.toString()
      )
    }));

    res.json(userAnnouncements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/announcements/unread-count
// @desc    Get unread announcements count for current user
// @access  Private
router.get('/unread-count', auth, async (req, res) => {
  try {
    const query = {
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    const announcements = await Announcement.find(query).lean();
    
    // Filter for current user and count unread
    let unreadCount = 0;
    announcements.forEach(announcement => {
      // Check if it's for this user
      const isForUser = !announcement.targetUsers || 
                       announcement.targetUsers.length === 0 ||
                       announcement.targetUsers.some(userId => 
                         userId.toString() === req.user.id.toString()
                       );
      
      if (isForUser) {
        // Check if user has read it
        const hasRead = announcement.readBy.some(read => 
          read.user.toString() === req.user.id.toString()
        );
        
        if (!hasRead) {
          unreadCount++;
        }
      }
    });

    res.json({ count: unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/announcements/:id/read
// @desc    Mark announcement as read
// @access  Private
router.post('/:id/read', auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Duyuru bulunamadı' });
    }

    // Check if user already read it
    const hasRead = announcement.readBy.some(read => 
      read.user.toString() === req.user.id.toString()
    );

    if (!hasRead) {
      announcement.readBy.push({
        user: req.user.id,
        readAt: new Date()
      });
      await announcement.save();
    }

    res.json({ message: 'Duyuru okundu olarak işaretlendi' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/announcements/admin
// @desc    Get all announcements for admin management
// @access  Private (Admin only)
router.get('/admin', [auth, adminAuth], async (req, res) => {
  try {
    const announcements = await Announcement.find({})
      .populate('createdBy', 'name email')
      .populate('targetUsers', 'name email')
      .sort({ createdAt: -1 });

    // Add read statistics
    const announcementsWithStats = announcements.map(announcement => {
      const totalUsers = announcement.targetUsers.length || 0;
      const readCount = announcement.readBy.length;
      
      return {
        ...announcement.toObject(),
        readCount,
        totalUsers: totalUsers === 0 ? 'Tüm Kullanıcılar' : totalUsers,
        readPercentage: totalUsers > 0 ? Math.round((readCount / totalUsers) * 100) : 0
      };
    });

    res.json(announcementsWithStats);
  } catch (error) {
    console.error('Get admin announcements error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/announcements
// @desc    Create new announcement
// @access  Private (Admin only)
router.post('/', [auth, adminAuth], async (req, res) => {
  try {
    const {
      title,
      content,
      type = 'info',
      priority = 'medium',
      targetUsers = [],
      expiresAt = null
    } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ message: 'Başlık ve içerik zorunludur' });
    }

    // If targetUsers provided, validate they exist
    if (targetUsers.length > 0) {
      const existingUsers = await User.find({ 
        _id: { $in: targetUsers },
        isActive: true 
      });
      
      if (existingUsers.length !== targetUsers.length) {
        return res.status(400).json({ message: 'Geçersiz kullanıcı ID\'leri' });
      }
    }

    const announcement = new Announcement({
      title,
      content,
      type,
      priority,
      targetUsers: targetUsers.length > 0 ? targetUsers : [],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user.id
    });

    await announcement.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user.id,
      action: 'announcement_created',
      description: `Yeni duyuru oluşturuldu: ${title}`,
      details: {
        announcementId: announcement._id,
        type,
        priority,
        targetUsersCount: targetUsers.length
      },
      relatedModel: 'Announcement',
      relatedId: announcement._id,
      severity: priority === 'urgent' ? 'high' : 'medium'
    });

    await announcement.populate('createdBy', 'name email');
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private (Admin only)
router.put('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const {
      title,
      content,
      type,
      priority,
      targetUsers,
      expiresAt,
      isActive
    } = req.body;

    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Duyuru bulunamadı' });
    }

    // Update fields
    if (title !== undefined) announcement.title = title;
    if (content !== undefined) announcement.content = content;
    if (type !== undefined) announcement.type = type;
    if (priority !== undefined) announcement.priority = priority;
    if (targetUsers !== undefined) announcement.targetUsers = targetUsers;
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) announcement.isActive = isActive;

    await announcement.save();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user.id,
      action: 'announcement_updated',
      description: `Duyuru güncellendi: ${announcement.title}`,
      details: {
        announcementId: announcement._id,
        changes: req.body
      },
      relatedModel: 'Announcement',
      relatedId: announcement._id,
      severity: 'medium'
    });

    await announcement.populate('createdBy', 'name email');
    res.json(announcement);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private (Admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Duyuru bulunamadı' });
    }

    await announcement.deleteOne();

    // Log activity
    await ActivityLog.logActivity({
      user: req.user.id,
      action: 'announcement_deleted',
      description: `Duyuru silindi: ${announcement.title}`,
      details: {
        announcementId: announcement._id,
        title: announcement.title
      },
      severity: 'medium'
    });

    res.json({ message: 'Duyuru silindi' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
