const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'QMT']
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'frozen', 'closed'],
    default: 'active'
  },
  walletAddress: {
    type: String,
    unique: true,
    required: true
  },
  publicKey: {
    type: String
  },
  privateKey: {
    type: String,
    select: false // Don't include in queries by default
  },
  limits: {
    daily: {
      type: Number,
      default: 10000
    },
    monthly: {
      type: Number,
      default: 100000
    },
    yearly: {
      type: Number,
      default: 1000000
    }
  },
  usage: {
    daily: {
      amount: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now }
    },
    monthly: {
      amount: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now }
    },
    yearly: {
      amount: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now }
    }
  },
  security: {
    pin: {
      type: String,
      select: false
    },
    biometricEnabled: {
      type: Boolean,
      default: false
    },
    multiSigEnabled: {
      type: Boolean,
      default: false
    },
    backupPhrase: {
      type: String,
      select: false
    }
  },
  settings: {
    autoBackup: {
      type: Boolean,
      default: true
    },
    notifications: {
      type: Boolean,
      default: true
    },
    twoFactorRequired: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    deviceInfo: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted balance
walletSchema.virtual('formattedBalance').get(function() {
  return this.balance.toFixed(2);
});

// Virtual for wallet status
walletSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Indexes
walletSchema.index({ userId: 1 });
walletSchema.index({ walletAddress: 1 });
walletSchema.index({ status: 1 });
walletSchema.index({ currency: 1 });
walletSchema.index({ 'metadata.lastActivity': -1 });

// Pre-save middleware to generate wallet address if not exists
walletSchema.pre('save', function(next) {
  if (!this.walletAddress) {
    this.walletAddress = this.generateWalletAddress();
  }
  next();
});

// Method to generate wallet address
walletSchema.methods.generateWalletAddress = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `QM${timestamp}${random}`.toUpperCase();
};

// Method to check if transaction is within limits
walletSchema.methods.isWithinLimits = function(amount, period = 'daily') {
  const limit = this.limits[period];
  const usage = this.usage[period];
  
  // Check if we need to reset the usage counter
  const now = new Date();
  const lastReset = new Date(usage.lastReset);
  
  let shouldReset = false;
  if (period === 'daily') {
    shouldReset = now.getDate() !== lastReset.getDate() || 
                  now.getMonth() !== lastReset.getMonth() || 
                  now.getFullYear() !== lastReset.getFullYear();
  } else if (period === 'monthly') {
    shouldReset = now.getMonth() !== lastReset.getMonth() || 
                  now.getFullYear() !== lastReset.getFullYear();
  } else if (period === 'yearly') {
    shouldReset = now.getFullYear() !== lastReset.getFullYear();
  }
  
  if (shouldReset) {
    usage.amount = 0;
    usage.lastReset = now;
  }
  
  return (usage.amount + amount) <= limit;
};

// Method to update usage
walletSchema.methods.updateUsage = function(amount, period = 'daily') {
  const usage = this.usage[period];
  usage.amount += amount;
  usage.lastReset = new Date();
  return this.save();
};

// Method to freeze wallet
walletSchema.methods.freeze = function() {
  this.status = 'frozen';
  return this.save();
};

// Method to unfreeze wallet
walletSchema.methods.unfreeze = function() {
  this.status = 'active';
  return this.save();
};

// Method to close wallet
walletSchema.methods.close = function() {
  this.status = 'closed';
  return this.save();
};

module.exports = walletSchema;
