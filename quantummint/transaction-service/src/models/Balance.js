const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  balances: [{
    currency: {
      type: String,
      required: true,
      default: 'QMC'
    },
    available: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    locked: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  }],
  lastTransactionId: {
    type: String
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes will be created by MongoDB automatically for unique fields

module.exports = mongoose.model('Balance', balanceSchema);
