const mongoose = require('mongoose');

const cashOutRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet ID is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be at least 0.01']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'USD'
  },
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    enum: ['stripe', 'orange_money', 'afrimoney', 'bank_transfer', 'paypal']
  },
  providerAccountId: {
    type: String,
    required: [true, 'Provider account ID is required']
  },
  providerAccountName: {
    type: String,
    required: [true, 'Provider account name is required']
  },
  providerTransactionId: {
    type: String,
    default: null
  },
  fee: {
    type: Number,
    default: 0,
    min: [0, 'Fee cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  failureReason: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0,
    min: [0, 'Retry count cannot be negative']
  },
  lastRetryAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for faster queries
cashOutRequestSchema.index({ userId: 1, createdAt: -1 });
cashOutRequestSchema.index({ walletId: 1 });
cashOutRequestSchema.index({ status: 1 });
cashOutRequestSchema.index({ provider: 1 });
cashOutRequestSchema.index({ createdAt: -1 });

// Create model from schema
const CashOutRequest = mongoose.model('CashOutRequest', cashOutRequestSchema);

module.exports = CashOutRequest;
