const mongoose = require('mongoose');

const generationRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  walletId: {
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
  generationMethod: {
    type: String,
    required: true,
    enum: ['standard', 'accelerated', 'premium']
  },
  generationParams: {
    type: Object,
    default: {}
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: String,
  verifiedAt: Date,
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
generationRecordSchema.index({ createdAt: -1 });
generationRecordSchema.index({ userId: 1, createdAt: -1 });
generationRecordSchema.index({ walletId: 1, createdAt: -1 });
generationRecordSchema.index({ status: 1, createdAt: -1 });

const GenerationRecord = mongoose.model('GenerationRecord', generationRecordSchema);

module.exports = GenerationRecord;