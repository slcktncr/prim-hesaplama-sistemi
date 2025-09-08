const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout',
      'sale_created', 'sale_updated', 'sale_cancelled', 'sale_modified',
      'communication_added', 'communication_updated',
      'announcement_created', 'announcement_updated',
      'user_created', 'user_updated', 'user_role_changed',
      'system_settings_updated', 'report_generated',
      'password_changed', 'profile_updated',
      'historical_data_added', 'historical_data_updated'
    ]
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Flexible data storage
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  relatedModel: {
    type: String,
    enum: ['Sale', 'CommunicationRecord', 'User', 'Announcement', 'CommunicationYear'],
    default: null
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
ActivityLogSchema.index({ user: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ isRead: 1, createdAt: -1 });
ActivityLogSchema.index({ severity: 1, createdAt: -1 });
ActivityLogSchema.index({ relatedModel: 1, relatedId: 1 });

// TTL index - automatically delete logs older than 90 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Static method to log activity
ActivityLogSchema.statics.logActivity = async function(data) {
  try {
    const activity = new this(data);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
};

// Static method to get recent activities for a user
ActivityLogSchema.statics.getRecentActivities = async function(userId, limit = 20) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .lean();
};

// Static method to get system-wide recent activities (for admins)
ActivityLogSchema.statics.getSystemActivities = async function(limit = 50) {
  return this.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email')
    .lean();
};

// Method to mark as read
ActivityLogSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
