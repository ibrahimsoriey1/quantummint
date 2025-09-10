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
    default: 'QMC', // QuantumMint Coin
    enum: ['QMC', 'USD', 'EUR', 'GBP']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  frozenReason: {
    type: String
  },
  frozenAt: {
    type: Date
  },
  frozenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dailyLimit: {
    type: Number,
    default: 10000
  },
  monthlyLimit: {
    type: Number,
    default: 100000
  },
  totalGenerated: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  totalReceived: {
    type: Number,
    default: 0
  },
  lastTransactionAt: {
    type: Date
  },
  metadata: {
    createdIP: String,
    lastAccessIP: String,
    lastAccessAt: Date
  }
}, {
  timestamps: true
});

// Indexes
walletSchema.index({ userId: 1 });
walletSchema.index({ isActive: 1 });
walletSchema.index({ isFrozen: 1 });

// Virtual for available balance (considering frozen status)
walletSchema.virtual('availableBalance').get(function() {
  return this.isFrozen ? 0 : this.balance;
});

// Method to check if wallet can perform transaction
walletSchema.methods.canTransact = function(amount) {
  if (this.isFrozen || !this.isActive) {
    return { allowed: false, reason: 'Wallet is frozen or inactive' };
  }
  
  if (this.balance < amount) {
    return { allowed: false, reason: 'Insufficient balance' };
  }
  
  return { allowed: true };
};

// Method to freeze wallet
walletSchema.methods.freeze = function(reason, frozenBy) {
  this.isFrozen = true;
  this.frozenReason = reason;
  this.frozenAt = new Date();
  this.frozenBy = frozenBy;
};

// Method to unfreeze wallet
walletSchema.methods.unfreeze = function() {
  this.isFrozen = false;
  this.frozenReason = undefined;
  this.frozenAt = undefined;
  this.frozenBy = undefined;
};

// Method to update balance
walletSchema.methods.updateBalance = function(amount, type = 'credit') {
  if (type === 'credit') {
    this.balance += amount;
    this.totalReceived += amount;
  } else if (type === 'debit') {
    this.balance -= amount;
    this.totalSpent += amount;
  } else if (type === 'generation') {
    this.balance += amount;
    this.totalGenerated += amount;
  }
  
  this.lastTransactionAt = new Date();
};

module.exports = mongoose.model('Wallet', walletSchema);
