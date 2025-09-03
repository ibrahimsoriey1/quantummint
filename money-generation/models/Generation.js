const mongoose = require('mongoose');
const { Schema } = mongoose;

const generationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  walletId: {
    type: Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  
  algorithm: {
    type: String,
    required: true,
    enum: ['quantum', 'cryptographic', 'mathematical', 'hybrid'],
    default: 'quantum'
  },
  
  algorithmVersion: {
    type: String,
    required: true,
    default: 'v1.0'
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    max: 1000000
  },
  
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'BTC', 'ETH', 'QMT']
  },
  
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  generationData: {
    seed: String,
    nonce: Number,
    hash: String,
    proof: String,
    difficulty: Number,
    iterations: Number
  },
  
  result: {
    generatedAmount: Number,
    transactionHash: String,
    blockNumber: Number,
    timestamp: Date,
    fees: Number,
    netAmount: Number
  },
  
  metadata: {
    userAgent: String,
    ipAddress: String,
    location: {
      country: String,
      city: String,
      coordinates: [Number]
    },
    device: {
      type: String,
      os: String,
      browser: String
    }
  },
  
  limits: {
    dailyLimit: Number,
    monthlyLimit: Number,
    yearlyLimit: Number,
    remainingDaily: Number,
    remainingMonthly: Number,
    remainingYearly: Number
  },
  
  cooldown: {
    isActive: {
      type: Boolean,
      default: false
    },
    expiresAt: Date,
    reason: String
  },
  
  audit: {
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    verificationNotes: String
  },
  
  security: {
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    flags: [String],
    suspicious: {
      type: Boolean,
      default: false
    },
    reviewRequired: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ status: 1, createdAt: -1 });
generationSchema.index({ algorithm: 1, status: 1 });
generationSchema.index({ 'metadata.ipAddress': 1, createdAt: -1 });
generationSchema.index({ 'security.riskScore': 1 });
generationSchema.index({ 'cooldown.expiresAt': 1 });

// Virtuals
generationSchema.virtual('isExpired').get(function() {
  return this.cooldown.isActive && this.cooldown.expiresAt < new Date();
});

generationSchema.virtual('processingTime').get(function() {
  if (this.status === 'completed' || this.status === 'failed') {
    return this.updatedAt - this.createdAt;
  }
  return null;
});

generationSchema.virtual('isWithinLimits').get(function() {
  return this.limits.remainingDaily > 0 && 
         this.limits.remainingMonthly > 0 && 
         this.limits.remainingYearly > 0;
});

// Pre-save middleware
generationSchema.pre('save', function(next) {
  // Set algorithm version if not provided
  if (!this.algorithmVersion) {
    this.algorithmVersion = process.env.GENERATION_ALGORITHM_VERSION || 'v1.0';
  }
  
  // Set default limits if not provided
  if (!this.limits.dailyLimit) {
    this.limits.dailyLimit = parseInt(process.env.GENERATION_LIMIT_DAILY) || 1000;
  }
  if (!this.limits.monthlyLimit) {
    this.limits.monthlyLimit = parseInt(process.env.GENERATION_LIMIT_MONTHLY) || 10000;
  }
  if (!this.limits.yearlyLimit) {
    this.limits.yearlyLimit = parseInt(process.env.GENERATION_LIMIT_YEARLY) || 100000;
  }
  
  next();
});

// Instance methods
generationSchema.methods.canGenerate = function() {
  return this.status === 'pending' && 
         !this.cooldown.isActive && 
         this.isWithinLimits;
};

generationSchema.methods.startProcessing = function() {
  this.status = 'processing';
  this.generationData.timestamp = new Date();
  return this.save();
};

generationSchema.methods.completeGeneration = function(result) {
  this.status = 'completed';
  this.result = result;
  this.result.timestamp = new Date();
  return this.save();
};

generationSchema.methods.failGeneration = function(error) {
  this.status = 'failed';
  this.result = { error: error.message || 'Generation failed' };
  this.result.timestamp = new Date();
  return this.save();
};

generationSchema.methods.activateCooldown = function(duration, reason) {
  this.cooldown.isActive = true;
  this.cooldown.expiresAt = new Date(Date.now() + duration);
  this.cooldown.reason = reason;
  return this.save();
};

generationSchema.methods.updateRiskScore = function(score, flags = []) {
  this.security.riskScore = score;
  this.security.flags = flags;
  this.security.suspicious = score > 70;
  this.security.reviewRequired = score > 50;
  return this.save();
};

// Static methods
generationSchema.statics.getUserStats = async function(userId, period = 'month') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$result.generatedAmount' },
        totalFees: { $sum: '$result.fees' },
        totalNetAmount: { $sum: '$result.netAmount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

generationSchema.statics.getSystemStats = async function(period = 'day') {
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'hour':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          algorithm: '$algorithm',
          currency: '$currency'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalGenerated: { $sum: '$result.generatedAmount' || 0 }
      }
    }
  ]);
};

module.exports = mongoose.model('Generation', generationSchema);
