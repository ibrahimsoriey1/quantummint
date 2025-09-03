
const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    index: true
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required']
  },
  eventId: {
    type: String,
    default: null
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },
  providerPaymentId: {
    type: String,
    default: null
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Raw data is required']
  },
  processedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  status: {
    type: String,
    enum: ['received', 'processing', 'processed', 'failed'],
    default: 'received'
  },
  processingError: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  headers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  processedAt: {
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
webhookSchema.index({ provider: 1, eventType: 1 });
webhookSchema.index({ providerPaymentId: 1 });
webhookSchema.index({ status: 1 });
webhookSchema.index({ createdAt: -1 });

// Create model from schema
const Webhook = mongoose.model('Webhook', webhookSchema);

module.exports = Webhook;
