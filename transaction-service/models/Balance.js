const mongoose = require('mongoose');
const { Schema } = mongoose;

const balanceSchema = new Schema({
  // User and wallet identification
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  walletId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Balance information by currency
  balances: {
    type: Map,
    of: {
      available: {
        type: Number,
        default: 0,
        min: 0
      },
      locked: {
        type: Number,
        default: 0,
        min: 0
      },
      pending: {
        type: Number,
        default: 0,
        min: 0
      },
      total: {
        type: Number,
        default: 0,
        min: 0
      },
      lastUpdated: {
        type: Date,
        default: Date.now
      }
    },
    default: {}
  },

  // Default currency
  defaultCurrency: {
    type: String,
    default: 'USD',
    uppercase: true,
    trim: true
  },

  // Balance limits and restrictions
  limits: {
    daily: {
      type: Map,
      of: {
        amount: {
          type: Number,
          default: 0
        },
        used: {
          type: Number,
          default: 0
        },
        resetTime: {
          type: Date
        }
      }
    },
    monthly: {
      type: Map,
      of: {
        amount: {
          type: Number,
          default: 0
        },
        used: {
          type: Number,
          default: 0
        },
        resetTime: {
          type: Date
        }
      }
    },
    transaction: {
      minAmount: {
        type: Map,
        of: Number,
        default: new Map([['USD', 1.00]])
      },
      maxAmount: {
        type: Map,
        of: Number,
        default: new Map([['USD', 1000000.00]])
      }
    }
  },

  // Balance status
  status: {
    type: String,
    enum: ['active', 'suspended', 'frozen', 'closed'],
    default: 'active',
    index: true
  },

  // Security settings
  security: {
    requireConfirmation: {
      type: Boolean,
      default: false
    },
    confirmationThreshold: {
      type: Map,
      of: Number,
      default: new Map([['USD', 1000.00]])
    },
    autoLockThreshold: {
      type: Map,
      of: Number,
      default: new Map([['USD', 10000.00]])
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },

  // Balance history and audit
  history: [{
    action: {
      type: String,
      enum: ['credit', 'debit', 'lock', 'unlock', 'adjustment', 'fee', 'exchange']
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true,
      uppercase: true
    },
    type: {
      type: String,
      enum: ['available', 'locked', 'pending']
    },
    transactionId: {
      type: String
    },
    reference: {
      type: String
    },
    description: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    previousBalance: {
      type: Number
    },
    newBalance: {
      type: Number
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed
    }
  }],

  // Exchange rates and conversions
  exchangeRates: {
    type: Map,
    of: {
      rate: Number,
      lastUpdated: Date,
      source: String
    }
  },

  // Notifications and alerts
  alerts: {
    lowBalance: {
      type: Map,
      of: {
        enabled: {
          type: Boolean,
          default: true
        },
        threshold: {
          type: Number,
          default: 10.00
        },
        lastSent: Date
      }
    },
    highBalance: {
      type: Map,
      of: {
        enabled: {
          type: Boolean,
          default: false
        },
        threshold: {
          type: Number,
          default: 10000.00
        },
        lastSent: Date
      }
    },
    unusualActivity: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 1000.00
      },
      lastSent: Date
    }
  },

  // Compliance and verification
  compliance: {
    kycLevel: {
      type: String,
      enum: ['basic', 'verified', 'enhanced'],
      default: 'basic'
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    lastVerified: Date,
    verificationDocuments: [{
      type: String,
      verifiedAt: Date,
      verifiedBy: String
    }]
  },

  // Performance metrics
  metrics: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    totalVolume: {
      type: Map,
      of: Number,
      default: new Map()
    },
    averageTransactionSize: {
      type: Map,
      of: Number,
      default: new Map()
    },
    lastTransactionAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
balanceSchema.index({ userId: 1, status: 1 });
balanceSchema.index({ 'balances.USD.total': -1 });
balanceSchema.index({ 'balances.USD.available': -1 });
balanceSchema.index({ 'compliance.kycLevel': 1 });
balanceSchema.index({ 'security.lastActivity': -1 });

// Virtual fields
balanceSchema.virtual('totalBalanceUSD').get(function() {
  const usdBalance = this.balances.get('USD');
  return usdBalance ? usdBalance.total : 0;
});

balanceSchema.virtual('totalAvailableUSD').get(function() {
  const usdBalance = this.balances.get('USD');
  return usdBalance ? usdBalance.available : 0;
});

balanceSchema.virtual('totalLockedUSD').get(function() {
  const usdBalance = this.balances.get('USD');
  return usdBalance ? usdBalance.locked : 0;
});

balanceSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

balanceSchema.virtual('isFrozen').get(function() {
  return this.status === 'frozen';
});

balanceSchema.virtual('isSuspended').get(function() {
  return this.status === 'suspended';
});

// Pre-save middleware
balanceSchema.pre('save', function(next) {
  // Update total balance for each currency
  for (const [currency, balance] of this.balances) {
    balance.total = balance.available + balance.locked + balance.pending;
    balance.lastUpdated = new Date();
  }

  // Update last activity
  this.security.lastActivity = new Date();

  next();
});

// Instance methods
balanceSchema.methods.getBalance = function(currency = 'USD') {
  const balance = this.balances.get(currency);
  return balance || {
    available: 0,
    locked: 0,
    pending: 0,
    total: 0,
    lastUpdated: new Date()
  };
};

balanceSchema.methods.updateBalance = function(currency, amount, type = 'available', action = 'credit') {
  const balance = this.balances.get(currency) || {
    available: 0,
    locked: 0,
    pending: 0,
    total: 0,
    lastUpdated: new Date()
  };

  const previousBalance = balance[type];
  
  if (action === 'credit') {
    balance[type] += amount;
  } else if (action === 'debit') {
    balance[type] = Math.max(0, balance[type] - amount);
  }

  // Add to history
  this.history.push({
    action: action === 'credit' ? 'credit' : 'debit',
    amount,
    currency,
    type,
    previousBalance,
    newBalance: balance[type],
    timestamp: new Date()
  });

  this.balances.set(currency, balance);
  return balance;
};

balanceSchema.methods.lockBalance = function(currency, amount) {
  const balance = this.getBalance(currency);
  
  if (balance.available < amount) {
    throw new Error(`Insufficient available balance for ${currency}`);
  }

  this.updateBalance(currency, amount, 'available', 'debit');
  this.updateBalance(currency, amount, 'locked', 'credit');
  
  return this.getBalance(currency);
};

balanceSchema.methods.unlockBalance = function(currency, amount) {
  const balance = this.getBalance(currency);
  
  if (balance.locked < amount) {
    throw new Error(`Insufficient locked balance for ${currency}`);
  }

  this.updateBalance(currency, amount, 'locked', 'debit');
  this.updateBalance(currency, amount, 'available', 'credit');
  
  return this.getBalance(currency);
};

balanceSchema.methods.canTransact = function(currency, amount) {
  const balance = this.getBalance(currency);
  const limits = this.limits.transaction;
  
  // Check minimum amount
  const minAmount = limits.minAmount.get(currency) || 0;
  if (amount < minAmount) {
    return { allowed: false, reason: `Amount below minimum (${minAmount} ${currency})` };
  }
  
  // Check maximum amount
  const maxAmount = limits.maxAmount.get(currency) || Infinity;
  if (amount > maxAmount) {
    return { allowed: false, reason: `Amount above maximum (${maxAmount} ${currency})` };
  }
  
  // Check available balance
  if (balance.available < amount) {
    return { allowed: false, reason: 'Insufficient available balance' };
  }
  
  // Check daily limit
  const dailyLimit = this.limits.daily.get(currency);
  if (dailyLimit && dailyLimit.used + amount > dailyLimit.amount) {
    return { allowed: false, reason: 'Daily limit exceeded' };
  }
  
  // Check monthly limit
  const monthlyLimit = this.limits.monthly.get(currency);
  if (monthlyLimit && monthlyLimit.used + amount > monthlyLimit.amount) {
    return { allowed: false, reason: 'Monthly limit exceeded' };
  }
  
  return { allowed: true };
};

// Static methods
balanceSchema.statics.getUserBalance = async function(userId) {
  let balance = await this.findOne({ userId });
  
  if (!balance) {
    // Create default balance if doesn't exist
    balance = new this({
      userId,
      walletId: `WALLET_${userId}`,
      balances: new Map([
        ['USD', {
          available: 0,
          locked: 0,
          pending: 0,
          total: 0,
          lastUpdated: new Date()
        }]
      ])
    });
    await balance.save();
  }
  
  return balance;
};

balanceSchema.statics.getTopBalances = async function(currency = 'USD', limit = 10) {
  return await this.find({
    status: 'active',
    [`balances.${currency}.total`]: { $gt: 0 }
  })
  .sort({ [`balances.${currency}.total`]: -1 })
  .limit(limit)
  .select(`userId balances.${currency} compliance.kycLevel`);
};

module.exports = mongoose.model('Balance', balanceSchema);
