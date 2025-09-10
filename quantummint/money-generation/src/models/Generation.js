const mongoose = require('mongoose');

const generationSchema = new mongoose.Schema({
  generationId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'GEN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    max: 10000
  },
  method: {
    type: String,
    required: true,
    enum: ['quantum', 'mining', 'staking', 'rewards', 'bonus']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String,
    maxlength: 500
  },
  processingTime: {
    type: Number, // in seconds
    default: 0
  },
  complexity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  energyUsed: {
    type: Number,
    default: 0
  },
  efficiency: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  metadata: {
    algorithm: String,
    hashRate: Number,
    difficulty: Number,
    blockHeight: Number,
    nonce: String,
    timestamp: Date,
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
  rewards: {
    baseAmount: Number,
    bonusAmount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    totalAmount: Number
  },
  fees: {
    processingFee: { type: Number, default: 0 },
    networkFee: { type: Number, default: 0 },
    totalFee: { type: Number, default: 0 }
  },
  startedAt: {
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
    type: Date,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }
  },
  parentGenerationId: {
    type: String
  },
  childGenerations: [{
    type: String
  }],
  tags: [String]
}, {
  timestamps: true
});

// Indexes
generationSchema.index({ generationId: 1 });
generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ walletId: 1 });
generationSchema.index({ status: 1 });
generationSchema.index({ method: 1 });
generationSchema.index({ createdAt: -1 });
generationSchema.index({ expiresAt: 1 });

// Virtual for generation duration
generationSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

// Method to check if generation is expired
generationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Method to check if generation can be retried
generationSchema.methods.canRetry = function() {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
};

// Method to start generation
generationSchema.methods.start = function() {
  this.status = 'processing';
  this.startedAt = new Date();
};

// Method to complete generation
generationSchema.methods.complete = function(actualAmount) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (actualAmount !== undefined) {
    this.amount = actualAmount;
    this.rewards.totalAmount = actualAmount;
  }
};

// Method to fail generation
generationSchema.methods.fail = function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  this.retryCount += 1;
};

// Method to calculate processing time based on method and amount
generationSchema.methods.calculateProcessingTime = function() {
  const baseTime = {
    quantum: 30,    // 30 seconds
    mining: 120,    // 2 minutes
    staking: 60,    // 1 minute
    rewards: 10,    // 10 seconds
    bonus: 5        // 5 seconds
  };

  const methodTime = baseTime[this.method] || 60;
  const amountMultiplier = Math.log10(this.amount + 1) / 4; // Logarithmic scaling
  const complexityMultiplier = this.complexity / 5;

  this.processingTime = Math.ceil(methodTime * (1 + amountMultiplier) * complexityMultiplier);
  return this.processingTime;
};

// Method to calculate energy usage
generationSchema.methods.calculateEnergyUsage = function() {
  const baseEnergy = {
    quantum: 0.1,
    mining: 1.0,
    staking: 0.3,
    rewards: 0.05,
    bonus: 0.02
  };

  const methodEnergy = baseEnergy[this.method] || 0.5;
  this.energyUsed = methodEnergy * this.amount * (this.complexity / 5);
  return this.energyUsed;
};

// Pre-save middleware to calculate totals
generationSchema.pre('save', function(next) {
  // Calculate total fees
  this.fees.totalFee = (this.fees.processingFee || 0) + (this.fees.networkFee || 0);
  
  // Calculate total rewards
  if (this.rewards.baseAmount) {
    this.rewards.totalAmount = (this.rewards.baseAmount + (this.rewards.bonusAmount || 0)) * (this.rewards.multiplier || 1);
  }
  
  // Set metadata timestamp
  if (!this.metadata.timestamp) {
    this.metadata.timestamp = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Generation', generationSchema);
