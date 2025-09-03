const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: [0, 'Pending balance cannot be negative']
  },
  totalGenerated: {
    type: Number,
    default: 0,
    min: [0, 'Total generated cannot be negative']
  },
  dailyGeneration: {
    type: Number,
    default: 0,
    min: [0, 'Daily generation cannot be negative']
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
  status: {
    type: String,
    enum: ['active', 'suspended', 'locked'],
    default: 'active'
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

// Index for faster queries
walletSchema.index({ userId: 1 }, { unique: true });

// Method to update daily generation
walletSchema.methods.updateDailyGeneration = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Reset daily generation if it's a new day
  if (!this.lastGenerationDate || new Date(this.lastGenerationDate).setHours(0, 0, 0, 0) < today.getTime()) {
    this.dailyGeneration = 0;
  }
  
  this.lastGenerationDate = new Date();
};

// Method to add funds
walletSchema.methods.addFunds = function(amount) {
  this.balance += amount;
  this.totalGenerated += amount;
  this.dailyGeneration += amount;
  this.updatedAt = new Date();
};

// Method to add pending funds
walletSchema.methods.addPendingFunds = function(amount) {
  this.pendingBalance += amount;
  this.updatedAt = new Date();
};

// Method to confirm pending funds
walletSchema.methods.confirmPendingFunds = function() {
  this.balance += this.pendingBalance;
  this.totalGenerated += this.pendingBalance;
  this.dailyGeneration += this.pendingBalance;
  this.pendingBalance = 0;
  this.updatedAt = new Date();
};

// Method to check if daily limit is reached
walletSchema.methods.isDailyLimitReached = function(limit) {
  this.updateDailyGeneration();
  return this.dailyGeneration >= limit;
};

// Create model from schema
const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;