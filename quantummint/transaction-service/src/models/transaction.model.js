const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['generation', 'transfer', 'cash_out', 'refund'],
    required: true,
    index: true
  },
  sourceType: {
    type: String,
    enum: ['wallet', 'system', 'external'],
    required: true
  },
  sourceId: {
    type: String,
    required: true
  },
  destinationType: {
    type: String,
    enum: ['wallet', 'external'],
    required: true
  },
  destinationId: {
    type: String,
    required: true
  },
  userId: {
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
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  description: String,
  reference: {
    type: String,
    unique: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  completedAt: Date,
  failureReason: String
}, {
  timestamps: true
});

// Indexes for queries
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ sourceId: 1, sourceType: 1, createdAt: -1 });
transactionSchema.index({ destinationId: 1, destinationType: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 }, { unique: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;