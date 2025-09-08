const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'danger'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // Boş ise tüm kullanıcılar
  expiresAt: {
    type: Date,
    default: null // null ise süresiz
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for better performance
AnnouncementSchema.index({ isActive: 1, createdAt: -1 });
AnnouncementSchema.index({ 'readBy.user': 1 });
AnnouncementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for unread count
AnnouncementSchema.virtual('unreadCount').get(function() {
  return this.readBy ? this.readBy.length : 0;
});

// Method to check if user has read this announcement
AnnouncementSchema.methods.isReadByUser = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Method to mark as read by user
AnnouncementSchema.methods.markAsRead = function(userId) {
  if (!this.isReadByUser(userId)) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  return this.save();
};

module.exports = mongoose.model('Announcement', AnnouncementSchema);
