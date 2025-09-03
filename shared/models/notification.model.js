const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationTemplate',
    default: null
  },
  channel: {
    type: String,
    required: [true, 'Notification channel is required'],
    enum: ['email', 'sms', 'push', 'in_app', 'webhook'],
    index: true
  },
  recipient: {
    type: String,
    required: [true, 'Recipient is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: [
      'authentication', 'transaction', 'kyc', 'generation', 'payment',
      'security', 'system', 'marketing', 'support'
    ],
    default: 'system'
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  clickedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  retryCount: {
    type: Number,
    default: 0,
    min: [0, 'Retry count cannot be negative']
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: {
    type: Date,
    default: null
  },
  provider: {
    type: String,
    default: null
  },
  providerMessageId: {
    type: String,
    default: null
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isHtml: {
    type: Boolean,
    default: false
  },
  attachments: {
    type: [{
      name: String,
      url: String,
      type: String
    }],
    default: []
  },
  trackingData: {
    openTracking: {
      type: Boolean,
      default: false
    },
    clickTracking: {
      type: Boolean,
      default: false
    },
    trackingPixel: {
      type: String,
      default: null
    },
    clickLinks: {
      type: [String],
      default: []
    }
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // We use custom timestamp fields
});

// Indexes for faster queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ channel: 1, status: 1 });
notificationSchema.index({ category: 1 });
notificationSchema.index({ sentAt: -1 });
notificationSchema.index({ readAt: -1 });
notificationSchema.index({ providerMessageId: 1 });

// TTL index for automatic cleanup (1 year retention)
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year

// Method to mark as sent
notificationSchema.methods.markAsSent = function(providerMessageId = null, providerResponse = null) {
  this.status = 'sent';
  this.sentAt = new Date();
  this.providerMessageId = providerMessageId;
  this.providerResponse = providerResponse;
  this.retryCount = 0;
  this.nextRetryAt = null;
};

// Method to mark as delivered
notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
};

// Method to mark as failed
notificationSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  this.nextRetryAt = this.shouldRetry() ? this.calculateNextRetry() : null;
};

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.readAt = new Date();
};

// Method to mark as clicked
notificationSchema.methods.markAsClicked = function() {
  this.clickedAt = new Date();
};

// Method to check if should retry
notificationSchema.methods.shouldRetry = function() {
  return this.retryCount < this.maxRetries && this.status === 'failed';
};

// Method to calculate next retry time (exponential backoff)
notificationSchema.methods.calculateNextRetry = function() {
  const baseDelay = 5 * 60 * 1000; // 5 minutes
  const delay = baseDelay * Math.pow(2, this.retryCount);
  return new Date(Date.now() + delay);
};

// Method to increment retry count
notificationSchema.methods.incrementRetry = function() {
  this.retryCount += 1;
  this.nextRetryAt = this.calculateNextRetry();
};

// Create model from schema
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
