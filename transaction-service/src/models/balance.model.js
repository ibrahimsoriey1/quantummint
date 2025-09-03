const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true,
    index: true
  },
  available: {
    type: Number,
    default: 0,
    min: [0, 'Available balance cannot be negative']
  },
  pending: {
    type: Number,
    default: 0,
    min: [0, 'Pending balance cannot be negative']
  },
  reserved: {
    type: Number,
    default: 0,
    min: [0, 'Reserved balance cannot be negative']
  },
  total: {
    type: Number,
    default: 0,
    min: [0, 'Total balance cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD'
  },
  lastTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  lastTransactionDate: {
    type: Date,
    default: null
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

// Method to add funds
balanceSchema.methods.addFunds = function(amount, transactionId) {
  this.available += amount;
  this.total = this.available + this.pending;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Method to add pending funds
balanceSchema.methods.addPendingFunds = function(amount, transactionId) {
  this.pending += amount;
  this.total = this.available + this.pending;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Method to confirm pending funds
balanceSchema.methods.confirmPendingFunds = function(amount, transactionId) {
  this.pending -= amount;
  this.available += amount;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Method to reserve funds
balanceSchema.methods.reserveFunds = function(amount, transactionId) {
  if (this.available < amount) {
    throw new Error('Insufficient funds');
  }
  
  this.available -= amount;
  this.reserved += amount;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Method to release reserved funds
balanceSchema.methods.releaseReservedFunds = function(amount, transactionId) {
  if (this.reserved < amount) {
    throw new Error('Insufficient reserved funds');
  }
  
  this.reserved -= amount;
  this.available += amount;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Method to deduct funds
balanceSchema.methods.deductFunds = function(amount, transactionId) {
  if (this.available < amount) {
    throw new Error('Insufficient funds');
  }
  
  this.available -= amount;
  this.total = this.available + this.pending;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Method to deduct reserved funds
balanceSchema.methods.deductReservedFunds = function(amount, transactionId) {
  if (this.reserved < amount) {
    throw new Error('Insufficient reserved funds');
  }
  
  this.reserved -= amount;
  this.total = this.available + this.pending;
  this.lastTransactionId = transactionId;
  this.lastTransactionDate = new Date();
  this.updatedAt = new Date();
};

// Create model from schema
const Balance = mongoose.model('Balance', balanceSchema);

module.exports = Balance;