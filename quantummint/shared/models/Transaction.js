const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fromWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  toWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  currency: {
    type: String,
    required: true,
    default: 'QMC'
  },
  type: {
    type: String,
    required: true,
    enum: ['transfer', 'deposit', 'withdrawal', 'generation', 'payment', 'refund', 'fee']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  description: {
    type: String,
    maxlength: 500
  },
  metadata: {
    paymentMethod: String,
    paymentProvider: String,
    externalTransactionId: String,
    generationMethod: String,
    ipAddress: String,
    userAgent: String,
    location: {
      country: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  },
  fees: {
    processingFee: { type: Number, default: 0 },
    networkFee: { type: Number, default: 0 },
    totalFee: { type: Number, default: 0 }
  },
  balances: {
    fromBalanceBefore: Number,
    fromBalanceAfter: Number,
    toBalanceBefore: Number,
    toBalanceAfter: Number
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  scheduledFor: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  confirmations: {
    required: { type: Number, default: 1 },
    received: { type: Number, default: 0 }
  },
  tags: [String],
  isInternal: {
    type: Boolean,
    default: true
  },
  parentTransactionId: {
    type: String
  },
  childTransactions: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ fromUserId: 1, createdAt: -1 });
transactionSchema.index({ toUserId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'metadata.externalTransactionId': 1 });

// Virtual for transaction direction from user perspective
transactionSchema.virtual('getDirection').get(function() {
  return function(userId) {
    if (this.fromUserId && this.fromUserId.toString() === userId.toString()) {
      return 'outgoing';
    } else if (this.toUserId && this.toUserId.toString() === userId.toString()) {
      return 'incoming';
    }
    return 'unknown';
  };
});

// Method to check if transaction is expired
transactionSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Method to check if transaction can be retried
transactionSchema.methods.canRetry = function() {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
};

// Method to mark transaction as processing
transactionSchema.methods.markAsProcessing = function() {
  this.status = 'processing';
  this.processedAt = new Date();
};

// Method to mark transaction as completed
transactionSchema.methods.markAsCompleted = function(balances = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (balances.fromBalanceAfter !== undefined) {
    this.balances.fromBalanceAfter = balances.fromBalanceAfter;
  }
  if (balances.toBalanceAfter !== undefined) {
    this.balances.toBalanceAfter = balances.toBalanceAfter;
  }
};

// Method to mark transaction as failed
transactionSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  this.retryCount += 1;
};

// Method to calculate total amount including fees
transactionSchema.methods.getTotalAmount = function() {
  return this.amount + this.fees.totalFee;
};

// Pre-save middleware to calculate total fees
transactionSchema.pre('save', function(next) {
  this.fees.totalFee = (this.fees.processingFee || 0) + (this.fees.networkFee || 0);
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
