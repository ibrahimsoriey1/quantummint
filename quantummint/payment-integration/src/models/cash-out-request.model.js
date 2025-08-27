const mongoose = require('mongoose');

const cashOutRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  provider: {
    type: String,
    required: true,
    index: true
  },
  providerAccountId: {
    type: String,
    required: true
  },
  providerAccountName: {
    type: String,
    required: true
  },
  providerTransactionId: {
    type: String,
    sparse: true,
    index: true
  },
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  providerResponse: {
    type: Object,
    default: {}
  },
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  lastRetryAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Indexes for queries
cashOutRequestSchema.index({ createdAt: -1 });
cashOutRequestSchema.index({ userId: 1, createdAt: -1 });
cashOutRequestSchema.index({ walletId: 1, createdAt: -1 });
cashOutRequestSchema.index({ provider: 1, status: 1 });

const CashOutRequest = mongoose.model('CashOutRequest', cashOutRequestSchema);

module.exports = CashOutRequest;