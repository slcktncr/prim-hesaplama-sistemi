const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Ad gereklidir'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Soyad gereklidir'],
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email gereklidir'],
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Şifre gereklidir'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'salesperson'],
    default: 'salesperson'
  },
  isActive: {
    type: Boolean,
    default: false // Varsayılan olarak pasif, admin onayı bekler
  },
  isApproved: {
    type: Boolean,
    default: false // Admin onayı
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Name field'ini otomatik oluştur
userSchema.pre('save', function(next) {
  if (this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`;
  }
  next();
});

// Şifre hashleme
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Şifre kontrolü
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
