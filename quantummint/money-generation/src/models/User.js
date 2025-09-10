const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  dailyGenerationLimit: {
    type: Number,
    default: 5000
  },
  monthlyGenerationLimit: {
    type: Number,
    default: 50000
  },
  totalGenerated: {
    type: Number,
    default: 0
  },
  profile: {
    firstName: String,
    lastName: String,
    dateOfBirth: Date,
    country: String,
    phoneNumber: String
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    privacy: {
      profileVisible: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ userId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ kycStatus: 1 });

module.exports = mongoose.model('User', userSchema);
