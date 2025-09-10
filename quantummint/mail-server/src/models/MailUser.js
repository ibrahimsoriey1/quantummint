const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mailUserSchema = new mongoose.Schema({
  // Basic user information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  
  // User profile
  firstName: String,
  lastName: String,
  displayName: String,
  
  // Account settings
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Mail settings
  mailboxQuota: {
    type: Number,
    default: 1024 * 1024 * 1024 // 1GB default
  },
  usedQuota: {
    type: Number,
    default: 0
  },
  
  // Security settings
  allowedIPs: [{
    type: String
  }],
  blockedIPs: [{
    type: String
  }],
  
  // Rate limiting
  dailyEmailLimit: {
    type: Number,
    default: 1000
  },
  hourlyEmailLimit: {
    type: Number,
    default: 100
  },
  emailsSentToday: {
    type: Number,
    default: 0
  },
  emailsSentThisHour: {
    type: Number,
    default: 0
  },
  lastEmailSent: Date,
  
  // Authentication
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Aliases and forwarding
  aliases: [{
    alias: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  forwardingRules: [{
    from: String,
    to: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Autoresponder
  autoresponder: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    subject: String,
    message: String,
    startDate: Date,
    endDate: Date
  },
  
  // Spam settings
  spamThreshold: {
    type: Number,
    default: 5.0
  },
  spamAction: {
    type: String,
    enum: ['reject', 'quarantine', 'tag'],
    default: 'quarantine'
  },
  
  // Statistics
  stats: {
    totalEmailsSent: {
      type: Number,
      default: 0
    },
    totalEmailsReceived: {
      type: Number,
      default: 0
    },
    spamBlocked: {
      type: Number,
      default: 0
    },
    virusBlocked: {
      type: Number,
      default: 0
    }
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: Date
}, {
  timestamps: true
});

// Indexes
mailUserSchema.index({ email: 1 });
mailUserSchema.index({ username: 1 });
mailUserSchema.index({ isActive: 1 });
mailUserSchema.index({ createdAt: -1 });

// Virtual for account lock status
mailUserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
mailUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamps
mailUserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
mailUserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

mailUserSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

mailUserSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

mailUserSchema.methods.updateQuota = async function(sizeChange) {
  const newUsedQuota = Math.max(0, this.usedQuota + sizeChange);
  
  if (newUsedQuota > this.mailboxQuota) {
    throw new Error('Mailbox quota exceeded');
  }
  
  this.usedQuota = newUsedQuota;
  return this.save();
};

mailUserSchema.methods.canSendEmail = function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  // Reset daily counter if it's a new day
  if (!this.lastEmailSent || this.lastEmailSent < today) {
    this.emailsSentToday = 0;
  }
  
  // Reset hourly counter if it's a new hour
  if (!this.lastEmailSent || this.lastEmailSent < thisHour) {
    this.emailsSentThisHour = 0;
  }
  
  return this.emailsSentToday < this.dailyEmailLimit && 
         this.emailsSentThisHour < this.hourlyEmailLimit;
};

mailUserSchema.methods.recordEmailSent = async function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  
  // Reset counters if needed
  if (!this.lastEmailSent || this.lastEmailSent < today) {
    this.emailsSentToday = 0;
  }
  if (!this.lastEmailSent || this.lastEmailSent < thisHour) {
    this.emailsSentThisHour = 0;
  }
  
  // Increment counters
  this.emailsSentToday += 1;
  this.emailsSentThisHour += 1;
  this.stats.totalEmailsSent += 1;
  this.lastEmailSent = now;
  this.lastActivity = now;
  
  return this.save();
};

// Static methods
mailUserSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  }).select('+password');
};

mailUserSchema.statics.getActiveUsers = function() {
  return this.find({ isActive: true });
};

mailUserSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
        verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
        totalEmailsSent: { $sum: '$stats.totalEmailsSent' },
        totalEmailsReceived: { $sum: '$stats.totalEmailsReceived' },
        totalSpamBlocked: { $sum: '$stats.spamBlocked' },
        totalVirusBlocked: { $sum: '$stats.virusBlocked' }
      }
    }
  ]);
};

module.exports = mongoose.model('MailUser', mailUserSchema);
