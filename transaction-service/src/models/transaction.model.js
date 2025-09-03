const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'fee', 'bonus', 'adjustment', 'deposit', 'cashout'],
    required: [true, 'Transaction type is required']
  },
  sourceWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null,
    index: true
  },
  destinationWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
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
  fee: {
    type: Number,
    default: 0,
    min: [0, 'Fee cannot be negative']
  },
  netAmount: {
    type: Number,
    required: [true, 'Net amount is required']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'expired'],
    default: 'pending'
  },
  description: {
    type: String,
    default: ''
  },
  reference: {
    type: String,
    default: null,
    unique: true,
    sparse: true
  },
  method: {
    type: String,
    default: null
  },
  provider: {
    type: String,
    default: null
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  recipientInfo: {
    type: mongoose.Schema.Types.Mixed,
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
  deviceInfo: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  location: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    country: {
      type: String,
      default: null
    },
    city: {
      type: String,
      default: null
    }
  },
  completedAt: {
    type: Date,
    default: null
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
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ sourceWalletId: 1 });
transactionSchema.index({ destinationWalletId: 1 });
transactionSchema.index({ transactionType: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ provider: 1 });
transactionSchema.index({ currency: 1 });

// Create model from schema
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;