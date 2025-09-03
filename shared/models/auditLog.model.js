const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: [
      'create', 'read', 'update', 'delete',
      'login', 'logout', 'password_change', 'email_verification',
      'kyc_submit', 'kyc_approve', 'kyc_reject',
      'transaction_create', 'transaction_complete', 'transaction_fail',
      'money_generate', 'money_verify', 'money_reject',
      'payment_initiate', 'payment_complete', 'payment_fail',
      'cashout_request', 'cashout_complete', 'cashout_fail',
      'wallet_create', 'wallet_suspend', 'wallet_activate',
      'admin_action', 'system_config_change'
    ],
    index: true
  },
  resourceType: {
    type: String,
    required: [true, 'Resource type is required'],
    enum: [
      'user', 'wallet', 'transaction', 'generation_record', 'cashout_request',
      'kyc_verification', 'document', 'payment', 'provider', 'notification',
      'system_config', 'audit_log'
    ],
    index: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  location: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    country: {
      type: String,
      default: null
    },
    city: {
      type: String,
      default: null
    }
  },
  sessionId: {
    type: String,
    default: null
  },
  requestId: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We use custom timestamp field
});

// Indexes for faster queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });

// TTL index for automatic cleanup (5 years retention)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 157680000 }); // 5 years

// Create model from schema
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
