const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'ZAR', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF']
  },
  walletType: {
    type: String,
    enum: ['primary', 'savings', 'business', 'escrow'],
    default: 'primary'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'locked', 'closed'],
    default: 'active'
  },
  dailyGenerationLimit: {
    type: Number,
    default: 1000,
    min: [0, 'Daily generation limit cannot be negative']
  },
  monthlyGenerationLimit: {
    type: Number,
    default: 10000,
    min: [0, 'Monthly generation limit cannot be negative']
  },
  totalGenerated: {
    type: Number,
    default: 0,
    min: [0, 'Total generated cannot be negative']
  },
  dailyGenerated: {
    type: Number,
    default: 0,
    min: [0, 'Daily generated cannot be negative']
  },
  monthlyGenerated: {
    type: Number,
    default: 0,
    min: [0, 'Monthly generated cannot be negative']
  },
  lastGenerationDate: {
    type: Date,
    default: null
  },
  generationMethod: {
    type: String,
    enum: ['standard', 'accelerated', 'premium'],
    default: 'standard'
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: [0, 'Pending balance cannot be negative']
  },
  reservedBalance: {
    type: Number,
    default: 0,
    min: [0, 'Reserved balance cannot be negative']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
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

// Indexes for faster queries
walletSchema.index({ userId: 1 }, { unique: true });
walletSchema.index({ status: 1 });
walletSchema.index({ currency: 1 });
walletSchema.index({ walletType: 1 });
walletSchema.index({ createdAt: -1 });

// Method to update daily and monthly generation tracking
walletSchema.methods.updateGenerationTracking = function() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Reset daily generation if it's a new day
  if (!this.lastGenerationDate || new Date(this.lastGenerationDate).setHours(0, 0, 0, 0) < today.getTime()) {
    this.dailyGenerated = 0;
  }
  
  // Reset monthly generation if it's a new month
  if (!this.lastGenerationDate || new Date(this.lastGenerationDate) < firstDayOfMonth) {
    this.monthlyGenerated = 0;
  }
  
  this.lastGenerationDate = now;
};

// Method to add funds
walletSchema.methods.addFunds = function(amount) {
  this.updateGenerationTracking();
  this.balance += amount;
  this.totalGenerated += amount;
  this.dailyGenerated += amount;
  this.monthlyGenerated += amount;
  this.updatedAt = new Date();
};

// Method to add pending funds
walletSchema.methods.addPendingFunds = function(amount) {
  this.pendingBalance += amount;
  this.updatedAt = new Date();
};

// Method to confirm pending funds
walletSchema.methods.confirmPendingFunds = function() {
  this.updateGenerationTracking();
  this.balance += this.pendingBalance;
  this.totalGenerated += this.pendingBalance;
  this.dailyGenerated += this.pendingBalance;
  this.monthlyGenerated += this.pendingBalance;
  this.pendingBalance = 0;
  this.updatedAt = new Date();
};

// Method to reserve funds
walletSchema.methods.reserveFunds = function(amount) {
  if (this.balance < amount) {
    throw new Error('Insufficient balance to reserve funds');
  }
  this.balance -= amount;
  this.reservedBalance += amount;
  this.updatedAt = new Date();
};

// Method to release reserved funds
walletSchema.methods.releaseReservedFunds = function(amount) {
  if (this.reservedBalance < amount) {
    throw new Error('Insufficient reserved balance to release');
  }
  this.reservedBalance -= amount;
  this.balance += amount;
  this.updatedAt = new Date();
};

// Method to check if daily limit is reached
walletSchema.methods.isDailyLimitReached = function() {
  this.updateGenerationTracking();
  return this.dailyGenerated >= this.dailyGenerationLimit;
};

// Method to check if monthly limit is reached
walletSchema.methods.isMonthlyLimitReached = function() {
  this.updateGenerationTracking();
  return this.monthlyGenerated >= this.monthlyGenerationLimit;
};

// Method to get available balance (balance - reserved)
walletSchema.methods.getAvailableBalance = function() {
  return this.balance - this.reservedBalance;
};

// Create model from schema
const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;