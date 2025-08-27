const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    required: true,
    enum: ['generation', 'transfer', 'cash_out', 'deposit', 'withdrawal', 'fee', 'refund', 'adjustment'],
    index: true
  },
  sourceWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  destinationWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  description: String,
  reference: {
    type: String,
    index: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  ipAddress: String,
  deviceInfo: String,
  location: {
    latitude: Number,
    longitude: Number,
    country: String,
    city: String
  },
  completedAt: Date
}, {
  timestamps: true
});

// Indexes
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ sourceWalletId: 1, createdAt: -1 });
transactionSchema.index({ destinationWalletId: 1, createdAt: -1 });
transactionSchema.index({ transactionType: 1, status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;