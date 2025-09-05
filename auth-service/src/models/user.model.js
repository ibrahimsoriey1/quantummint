const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in query results by default
  },
  salt: {
    type: String,
    select: false
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
  },
  countryCode: {
    type: String,
    default: '+1',
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  address: {
    street: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    state: {
      type: String,
      default: ''
    },
    postalCode: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      required: [true, 'Country is required']
    }
  },
  idVerification: {
    idType: {
      type: String,
      enum: ['passport', 'drivers_license', 'national_id', 'other'],
      default: null
    },
    idNumber: {
      type: String,
      default: null
    },
    idExpiryDate: {
      type: Date,
      default: null
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'expired'],
      default: 'pending'
    },
    verificationDate: {
      type: Date,
      default: null
    },
    verifiedBy: {
      type: String,
      default: null
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'super_admin', 'moderator', 'support'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'banned', 'pending_verification'],
    default: 'pending_verification'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  kycLevel: {
    type: String,
    enum: ['none', 'tier_1', 'tier_2', 'tier_3'],
    default: 'none'
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: Date,
  refreshTokens: [{
    token: String,
    expires: Date,
    userAgent: String,
    ipAddress: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Pre-save hook to hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('passwordHash')) return next();
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.salt = salt;
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Normalize role and status to lowercase before validation/save
userSchema.pre('validate', function(next) {
  if (this.role && typeof this.role === 'string') {
    this.role = this.role.toLowerCase();
  }
  if (this.status && typeof this.status === 'string') {
    this.status = this.status.toLowerCase();
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  // Set expiration (24 hours)
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  return verificationToken;
};

// Method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and set to passwordResetToken field
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  // Set expiration (10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Method to add refresh token
userSchema.methods.addRefreshToken = function(token, expires, userAgent, ipAddress) {
  this.refreshTokens.push({
    token,
    expires,
    userAgent,
    ipAddress
  });
  
  // Limit the number of refresh tokens per user (keep only the 5 most recent)
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
};

// Method to remove refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for faster queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });
userSchema.index({ kycLevel: 1 });
userSchema.index({ createdAt: -1 });

// Create model from schema
const User = mongoose.model('User', userSchema);

module.exports = User;