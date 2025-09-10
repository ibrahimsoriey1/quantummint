const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  fromUserId: {
    type: String,
    required: true
  },
  toUserId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'QMC' // QuantumMint Coin
  },
  type: {
    type: String,
    required: true,
    enum: ['transfer', 'deposit', 'withdrawal', 'generation', 'payment', 'fee']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Mixed,
    default: {}
  },
  fees: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'QMC'
    }
  },
  blockchainTxHash: {
    type: String,
    sparse: true
  },
  confirmations: {
    type: Number,
    default: 0
  },
  processedAt: {
    type: Date
  },
  failureReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes will be created by MongoDB automatically for unique fields

module.exports = mongoose.model('Transaction', transactionSchema);
