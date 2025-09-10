const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  webhookId: {
    type: String,
    required: true,
    unique: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['stripe', 'orange_money', 'afrimoney']
  },
  eventType: {
    type: String,
    required: true
  },
  eventId: {
    type: String,
    required: true
  },
  paymentId: {
    type: String
  },
  providerTransactionId: {
    type: String
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  signature: {
    type: String
  },
  status: {
    type: String,
    required: true,
    enum: ['received', 'processing', 'processed', 'failed', 'ignored'],
    default: 'received'
  },
  processedAt: {
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
  }
}, {
  timestamps: true
});

// Indexes
webhookSchema.index({ webhookId: 1 });
webhookSchema.index({ provider: 1, eventType: 1 });
webhookSchema.index({ eventId: 1 });
webhookSchema.index({ paymentId: 1 });
webhookSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Webhook', webhookSchema);
