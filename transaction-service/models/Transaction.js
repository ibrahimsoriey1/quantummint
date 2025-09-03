const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
  // Basic transaction information
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['transfer', 'withdrawal', 'deposit', 'generation', 'fee', 'refund', 'exchange'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'],
    default: 'pending',
    index: true
  },

  // User and wallet information
  userId: {
    type: String,
    required: true,
    index: true
  },
  sourceWalletId: {
    type: String,
    required: true,
    index: true
  },
  destinationWalletId: {
    type: String,
    index: true
  },
  destinationAddress: {
    type: String,
    trim: true
  },

  // Amount and currency information
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    uppercase: true,
    trim: true
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  convertedAmount: {
    type: Number
  },
  convertedCurrency: {
    type: String,
    uppercase: true,
    trim: true
  },

  // Fee information
  feeAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  feeCurrency: {
    type: String,
    default: 'USD',
    uppercase: true,
    trim: true
  },
  feePercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  netAmount: {
    type: Number,
    required: true
  },

  // Transaction details
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  reference: {
    type: String,
    trim: true,
    index: true
  },
  externalReference: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },

  // Compliance and security
  complianceStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending',
    index: true
  },
  kycLevel: {
    type: String,
    enum: ['basic', 'verified', 'enhanced'],
    default: 'basic'
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  flags: [{
    type: String,
    enum: ['suspicious', 'high_value', 'unusual_pattern', 'sanctions', 'pep']
  }],

  // Processing information
  processingTime: {
    type: Number, // in milliseconds
    min: 0
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxRetries: {
    type: Number,
    default: 3,
    min: 0
  },
  nextRetryAt: {
    type: Date
  },

  // Timestamps and audit
  initiatedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },

  // Error information
  errorCode: {
    type: String
  },
  errorMessage: {
    type: String
  },
  errorDetails: {
    type: Schema.Types.Mixed
  },

  // Blockchain/network information (for crypto transactions)
  network: {
    type: String,
    trim: true
  },
  blockHash: {
    type: String
  },
  blockNumber: {
    type: Number
  },
  confirmations: {
    type: Number,
    default: 0
  },
  requiredConfirmations: {
    type: Number,
    default: 1
  },

  // Related transactions
  parentTransactionId: {
    type: String,
    index: true
  },
  childTransactionIds: [{
    type: String
  }],

  // Batch processing
  batchId: {
    type: String,
    index: true
  },
  batchIndex: {
    type: Number
  },

  // Priority and scheduling
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  scheduledAt: {
    type: Date
  },

  // Notifications
  notificationsSent: {
    type: Boolean,
    default: false
  },
  notificationAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ complianceStatus: 1, createdAt: -1 });
transactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
transactionSchema.index({ 'metadata.source': 1 });
transactionSchema.index({ 'metadata.destination': 1 });

// Virtual fields
transactionSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

transactionSchema.virtual('isPending').get(function() {
  return ['pending', 'processing'].includes(this.status);
});

transactionSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

transactionSchema.virtual('isFailed').get(function() {
  return ['failed', 'cancelled'].includes(this.status);
});

transactionSchema.virtual('totalAmount').get(function() {
  return this.amount + this.feeAmount;
});

transactionSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60));
});

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Generate transaction ID if not provided
  if (!this.transactionId) {
    this.transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Calculate net amount
  if (this.amount && this.feeAmount !== undefined) {
    this.netAmount = this.amount - this.feeAmount;
  }

  // Set expiration if not provided
  if (!this.expiresAt && this.status === 'pending') {
    const timeoutMinutes = parseInt(process.env.TRANSACTION_TIMEOUT_MINUTES) || 30;
    this.expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);
  }

  next();
});

// Instance methods
transactionSchema.methods.canRetry = function() {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
};

transactionSchema.methods.isCompliant = function() {
  return this.complianceStatus === 'approved';
};

transactionSchema.methods.requiresKYC = function() {
  return this.amount > 10000 || this.riskScore > 70;
};

transactionSchema.methods.getProcessingTime = function() {
  if (this.processedAt && this.initiatedAt) {
    return this.processedAt - this.initiatedAt;
  }
  return null;
};

// Static methods
transactionSchema.statics.getUserTransactions = async function(userId, options = {}) {
  const { page = 1, limit = 20, status, type, currency, startDate, endDate } = options;
  
  const query = { userId };
  if (status) query.status = status;
  if (type) query.type = type;
  if (currency) query.currency = currency;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const transactions = await this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

transactionSchema.statics.getTransactionStats = async function(userId, period = 'month') {
  const startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  const stats = await this.aggregate([
    { $match: { userId, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          status: '$status',
          type: '$type',
          currency: '$currency'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$feeAmount' },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);

  return stats;
};

transactionSchema.statics.getSystemStats = async function(period = 'day') {
  const startDate = new Date();
  
  switch (period) {
    case 'day':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  const stats = await this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          status: '$status',
          type: '$type'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$feeAmount' },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);

  return stats;
};

module.exports = mongoose.model('Transaction', transactionSchema);
