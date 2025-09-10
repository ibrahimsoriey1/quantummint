const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
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
    default: 'USD'
  },
  provider: {
    type: String,
    required: true,
    enum: ['stripe', 'orange_money', 'afrimoney']
  },
  providerTransactionId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['deposit', 'withdrawal', 'payment']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: {
      type: String,
      required: true,
      enum: ['card', 'mobile_money', 'bank_transfer']
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fees: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  description: {
    type: String,
    maxlength: 500
  },
  failureReason: {
    type: String
  },
  processedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  webhookReceived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ provider: 1, status: 1 });
paymentSchema.index({ providerTransactionId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
