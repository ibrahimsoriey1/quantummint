const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  walletType: {
    type: String,
    enum: ['personal', 'business', 'savings'],
    default: 'personal'
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active',
    index: true
  },
  name: {
    type: String,
    default: 'Default Wallet'
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for queries
walletSchema.index({ userId: 1, walletType: 1 });
walletSchema.index({ userId: 1, currency: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;