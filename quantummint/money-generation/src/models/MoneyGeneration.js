const mongoose = require('mongoose');

const moneyGenerationSchema = new mongoose.Schema({
  generationId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return 'GEN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  },
  userId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    max: 100000
  },
  complexity: {
    type: String,
    enum: ['low', 'medium', 'high', 'extreme'],
    default: 'medium'
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  description: {
    type: String,
    maxlength: 500
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  processingTime: {
    type: Number,
    default: 0
  },
  generatedAmount: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String
  },
  metadata: {
    algorithm: String,
    difficulty: Number,
    energyUsed: Number,
    efficiency: Number
  }
}, {
  timestamps: true
});

// Add instance methods directly to the schema
moneyGenerationSchema.methods.startProcessing = function () {
  this.status = 'processing';
  this.startTime = new Date();
};

moneyGenerationSchema.methods.complete = function (amount) {
  this.status = 'completed';
  this.endTime = new Date();
  if (this.startTime) {
    this.processingTime = this.endTime - this.startTime;
  }
  this.generatedAmount = amount;
};

moneyGenerationSchema.methods.fail = function (errorMessage) {
  this.status = 'failed';
  this.endTime = new Date();
  this.errorMessage = errorMessage;
};

module.exports = mongoose.model('MoneyGeneration', moneyGenerationSchema);
