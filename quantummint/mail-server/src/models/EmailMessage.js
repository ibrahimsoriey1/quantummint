const mongoose = require('mongoose');

const emailMessageSchema = new mongoose.Schema({
  // Message identification
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  threadId: String,
  inReplyTo: String,
  references: [String],
  
  // Sender information
  from: {
    address: {
      type: String,
      required: true,
      lowercase: true
    },
    name: String
  },
  sender: {
    address: String,
    name: String
  },
  replyTo: {
    address: String,
    name: String
  },
  
  // Recipients
  to: [{
    address: {
      type: String,
      required: true,
      lowercase: true
    },
    name: String
  }],
  cc: [{
    address: {
      type: String,
      lowercase: true
    },
    name: String
  }],
  bcc: [{
    address: {
      type: String,
      lowercase: true
    },
    name: String
  }],
  
  // Message content
  subject: {
    type: String,
    required: true
  },
  textContent: String,
  htmlContent: String,
  
  // Headers
  headers: {
    type: Map,
    of: String
  },
  
  // Attachments
  attachments: [{
    filename: String,
    contentType: String,
    size: Number,
    contentId: String,
    checksum: String,
    path: String, // File system path
    isInline: {
      type: Boolean,
      default: false
    }
  }],
  
  // Message properties
  size: {
    type: Number,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  
  // Status and flags
  status: {
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'failed', 'bounced'],
    default: 'queued'
  },
  flags: [{
    type: String,
    enum: ['seen', 'answered', 'flagged', 'deleted', 'draft', 'recent']
  }],
  
  // Security and authentication
  spf: {
    result: {
      type: String,
      enum: ['pass', 'fail', 'softfail', 'neutral', 'none', 'temperror', 'permerror']
    },
    details: String
  },
  dkim: {
    result: {
      type: String,
      enum: ['pass', 'fail', 'neutral', 'none', 'temperror', 'permerror']
    },
    signature: String,
    details: String
  },
  dmarc: {
    result: {
      type: String,
      enum: ['pass', 'fail', 'none']
    },
    policy: String,
    details: String
  },
  
  // Spam and virus scanning
  spamScore: {
    type: Number,
    default: 0
  },
  spamStatus: {
    type: String,
    enum: ['clean', 'spam', 'suspicious'],
    default: 'clean'
  },
  virusStatus: {
    type: String,
    enum: ['clean', 'infected', 'suspicious'],
    default: 'clean'
  },
  scanResults: [{
    scanner: String,
    result: String,
    details: String,
    timestamp: Date
  }],
  
  // Delivery tracking
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  lastDeliveryAttempt: Date,
  nextDeliveryAttempt: Date,
  deliveryErrors: [String],
  
  // Bounce handling
  bounceType: {
    type: String,
    enum: ['hard', 'soft', 'complaint']
  },
  bounceReason: String,
  bounceDetails: String,
  
  // Folder and mailbox
  mailbox: {
    type: String,
    required: true
  },
  folder: {
    type: String,
    default: 'INBOX'
  },
  
  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MailUser',
    required: true,
    index: true
  },
  
  // Timestamps
  date: {
    type: Date,
    required: true
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  sentAt: Date,
  deliveredAt: Date,
  
  // Metadata
  source: {
    type: String,
    enum: ['smtp', 'api', 'webmail', 'import'],
    default: 'smtp'
  },
  clientInfo: {
    ip: String,
    userAgent: String,
    hostname: String
  },
  
  // Archival
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: Date,
  
  // Expiration
  expiresAt: Date
}, {
  timestamps: true
});

// Indexes for performance
emailMessageSchema.index({ messageId: 1 });
emailMessageSchema.index({ userId: 1, folder: 1 });
emailMessageSchema.index({ 'from.address': 1 });
emailMessageSchema.index({ 'to.address': 1 });
emailMessageSchema.index({ subject: 'text' });
emailMessageSchema.index({ date: -1 });
emailMessageSchema.index({ receivedAt: -1 });
emailMessageSchema.index({ status: 1 });
emailMessageSchema.index({ spamStatus: 1 });
emailMessageSchema.index({ virusStatus: 1 });
emailMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for total attachment size
emailMessageSchema.virtual('totalAttachmentSize').get(function() {
  return this.attachments.reduce((total, attachment) => total + (attachment.size || 0), 0);
});

// Virtual for recipient count
emailMessageSchema.virtual('recipientCount').get(function() {
  return (this.to?.length || 0) + (this.cc?.length || 0) + (this.bcc?.length || 0);
});

// Instance methods
emailMessageSchema.methods.addFlag = function(flag) {
  if (!this.flags.includes(flag)) {
    this.flags.push(flag);
  }
  return this.save();
};

emailMessageSchema.methods.removeFlag = function(flag) {
  this.flags = this.flags.filter(f => f !== flag);
  return this.save();
};

emailMessageSchema.methods.markAsRead = function() {
  return this.addFlag('seen');
};

emailMessageSchema.methods.markAsUnread = function() {
  return this.removeFlag('seen');
};

emailMessageSchema.methods.moveToFolder = function(folder) {
  this.folder = folder;
  return this.save();
};

emailMessageSchema.methods.updateDeliveryStatus = function(status, error = null) {
  this.status = status;
  this.deliveryAttempts += 1;
  this.lastDeliveryAttempt = new Date();
  
  if (error) {
    this.deliveryErrors.push(error);
  }
  
  if (status === 'sent') {
    this.sentAt = new Date();
  } else if (status === 'delivered') {
    this.deliveredAt = new Date();
  } else if (status === 'failed' || status === 'bounced') {
    // Calculate next retry time (exponential backoff)
    const retryDelay = Math.min(300000 * Math.pow(2, this.deliveryAttempts - 1), 86400000); // Max 24 hours
    this.nextDeliveryAttempt = new Date(Date.now() + retryDelay);
  }
  
  return this.save();
};

emailMessageSchema.methods.setBounce = function(type, reason, details) {
  this.status = 'bounced';
  this.bounceType = type;
  this.bounceReason = reason;
  this.bounceDetails = details;
  return this.save();
};

emailMessageSchema.methods.updateSpamScore = function(score, status = null) {
  this.spamScore = score;
  if (status) {
    this.spamStatus = status;
  } else {
    // Auto-determine status based on score
    if (score >= 5.0) {
      this.spamStatus = 'spam';
    } else if (score >= 2.0) {
      this.spamStatus = 'suspicious';
    } else {
      this.spamStatus = 'clean';
    }
  }
  return this.save();
};

// Static methods
emailMessageSchema.statics.findByMessageId = function(messageId) {
  return this.findOne({ messageId });
};

emailMessageSchema.statics.findByThread = function(threadId) {
  return this.find({ threadId }).sort({ date: 1 });
};

emailMessageSchema.statics.findInFolder = function(userId, folder, options = {}) {
  const query = { userId, folder };
  
  if (options.unreadOnly) {
    query.flags = { $nin: ['seen'] };
  }
  
  return this.find(query)
    .sort({ date: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

emailMessageSchema.statics.getMailboxStats = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$folder',
        count: { $sum: 1 },
        unreadCount: {
          $sum: {
            $cond: [{ $not: { $in: ['seen', '$flags'] } }, 1, 0]
          }
        },
        totalSize: { $sum: '$size' }
      }
    }
  ]);
};

emailMessageSchema.statics.getPendingDeliveries = function() {
  return this.find({
    status: { $in: ['queued', 'failed'] },
    deliveryAttempts: { $lt: 5 },
    $or: [
      { nextDeliveryAttempt: { $exists: false } },
      { nextDeliveryAttempt: { $lte: new Date() } }
    ]
  }).sort({ receivedAt: 1 });
};

emailMessageSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lte: new Date() }
  });
};

module.exports = mongoose.model('EmailMessage', emailMessageSchema);
