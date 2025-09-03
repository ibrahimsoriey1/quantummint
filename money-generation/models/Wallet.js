const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  balances: [{
    currency: {
      type: String,
      required: true,
      enum: ['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT']
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    locked: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }],
  
  status: {
    type: String,
    required: true,
    enum: ['active', 'suspended', 'frozen', 'closed'],
    default: 'active'
  },
  
  security: {
    encryptionKey: String,
    publicKey: String,
    privateKey: String,
    mnemonic: String,
    derivationPath: String,
    lastBackup: Date
  },
  
  limits: {
    dailyGeneration: {
      type: Number,
      default: 1000
    },
    monthlyGeneration: {
      type: Number,
      default: 10000
    },
    yearlyGeneration: {
      type: Number,
      default: 100000
    },
    dailyWithdrawal: {
      type: Number,
      default: 500
    },
    monthlyWithdrawal: {
      type: Number,
      default: 5000
    },
    yearlyWithdrawal: {
      type: Number,
      default: 50000
    },
    maxBalance: {
      type: Number,
      default: 1000000
    }
  },
  
  usage: {
    totalGenerated: {
      type: Number,
      default: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0
    },
    totalFees: {
      type: Number,
      default: 0
    },
    generationCount: {
      type: Number,
      default: 0
    },
    withdrawalCount: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  
  settings: {
    autoBackup: {
      type: Boolean,
      default: true
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      hideBalance: {
        type: Boolean,
        default: false
      },
      hideTransactions: {
        type: Boolean,
        default: false
      }
    }
  },
  
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastLogin: Date,
    lastBackup: Date,
    version: {
      type: String,
      default: 'v1.0'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
walletSchema.index({ userId: 1 });
walletSchema.index({ walletAddress: 1 });
walletSchema.index({ status: 1 });
walletSchema.index({ 'balances.currency': 1 });
walletSchema.index({ 'usage.lastActivity': -1 });

// Virtuals
walletSchema.virtual('totalBalance').get(function() {
  return this.balances.reduce((total, balance) => total + balance.amount, 0);
});

walletSchema.virtual('totalLocked').get(function() {
  return this.balances.reduce((total, balance) => total + balance.locked, 0);
});

walletSchema.virtual('availableBalance').get(function() {
  return this.totalBalance - this.totalLocked;
});

walletSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

walletSchema.virtual('canGenerate').get(function() {
  return this.isActive && 
         this.usage.generationCount < this.limits.dailyGeneration &&
         this.usage.totalGenerated < this.limits.monthlyGeneration;
});

// Pre-save middleware
walletSchema.pre('save', function(next) {
  // Update last activity
  this.usage.lastActivity = new Date();
  
  // Ensure at least one balance exists
  if (this.balances.length === 0) {
    this.balances.push({
      currency: 'USD',
      amount: 0,
      locked: 0,
      lastUpdated: new Date()
    });
  }
  
  next();
});

// Instance methods
walletSchema.methods.getBalance = function(currency = 'USD') {
  const balance = this.balances.find(b => b.currency === currency);
  return balance ? balance.amount : 0;
};

walletSchema.methods.getLockedBalance = function(currency = 'USD') {
  const balance = this.balances.find(b => b.currency === currency);
  return balance ? balance.locked : 0;
};

walletSchema.methods.updateBalance = function(currency, amount, type = 'add') {
  let balance = this.balances.find(b => b.currency === currency);
  
  if (!balance) {
    balance = {
      currency,
      amount: 0,
      locked: 0,
      lastUpdated: new Date()
    };
    this.balances.push(balance);
  }
  
  if (type === 'add') {
    balance.amount += amount;
  } else if (type === 'subtract') {
    balance.amount = Math.max(0, balance.amount - amount);
  } else if (type === 'set') {
    balance.amount = amount;
  }
  
  balance.lastUpdated = new Date();
  this.usage.lastActivity = new Date();
  
  return this.save();
};

walletSchema.methods.lockBalance = function(currency, amount) {
  const balance = this.balances.find(b => b.currency === currency);
  if (!balance || balance.amount < amount) {
    throw new Error('Insufficient balance to lock');
  }
  
  balance.amount -= amount;
  balance.locked += amount;
  balance.lastUpdated = new Date();
  
  return this.save();
};

walletSchema.methods.unlockBalance = function(currency, amount) {
  const balance = this.balances.find(b => b.currency === currency);
  if (!balance || balance.locked < amount) {
    throw new Error('Insufficient locked balance to unlock');
  }
  
  balance.locked -= amount;
  balance.amount += amount;
  balance.lastUpdated = new Date();
  
  return this.save();
};

walletSchema.methods.canGenerateAmount = function(amount, currency = 'USD') {
  const dailyRemaining = this.limits.dailyGeneration - this.usage.generationCount;
  const monthlyRemaining = this.limits.monthlyGeneration - this.usage.totalGenerated;
  
  return this.isActive && 
         dailyRemaining > 0 && 
         monthlyRemaining >= amount &&
         this.getBalance(currency) + amount <= this.limits.maxBalance;
};

walletSchema.methods.recordGeneration = function(amount, currency = 'USD', fees = 0) {
  this.usage.totalGenerated += amount;
  this.usage.generationCount += 1;
  this.usage.totalFees += fees;
  this.usage.lastActivity = new Date();
  
  // Update balance
  this.updateBalance(currency, amount, 'add');
  
  return this.save();
};

walletSchema.methods.recordWithdrawal = function(amount, currency = 'USD', fees = 0) {
  this.usage.totalWithdrawn += amount;
  this.usage.withdrawalCount += 1;
  this.usage.totalFees += fees;
  this.usage.lastActivity = new Date();
  
  // Update balance
  this.updateBalance(currency, amount, 'subtract');
  
  return this.save();
};

walletSchema.methods.freeze = function(reason = 'Security measure') {
  this.status = 'frozen';
  this.metadata.lastBackup = new Date();
  return this.save();
};

walletSchema.methods.unfreeze = function() {
  this.status = 'active';
  return this.save();
};

walletSchema.methods.suspend = function(reason = 'Policy violation') {
  this.status = 'suspended';
  return this.save();
};

walletSchema.methods.close = function() {
  this.status = 'closed';
  this.metadata.lastBackup = new Date();
  return this.save();
};

// Static methods
walletSchema.statics.createWallet = async function(userId, initialCurrency = 'USD') {
  const walletAddress = this.generateWalletAddress();
  
  const wallet = new this({
    userId,
    walletAddress,
    balances: [{
      currency: initialCurrency,
      amount: 0,
      locked: 0,
      lastUpdated: new Date()
    }]
  });
  
  return wallet.save();
};

walletSchema.statics.generateWalletAddress = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'QMT';
  
  for (let i = 0; i < 37; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

walletSchema.statics.getUserWallet = async function(userId) {
  return this.findOne({ userId }).populate('userId', 'username email');
};

walletSchema.statics.getWalletStats = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBalance: { $sum: '$totalBalance' },
        totalGenerated: { $sum: '$usage.totalGenerated' }
      }
    }
  ]);
};

module.exports = mongoose.model('Wallet', walletSchema);
