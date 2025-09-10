const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['stripe', 'orange_money', 'afrimoney']
  },
  displayName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  supportedCurrencies: [{
    type: String,
    required: true
  }],
  supportedCountries: [{
    type: String,
    required: true
  }],
  paymentMethods: [{
    type: String,
    enum: ['card', 'mobile_money', 'bank_transfer']
  }],
  fees: {
    deposit: {
      fixed: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      }
    },
    withdrawal: {
      fixed: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      }
    }
  },
  limits: {
    deposit: {
      min: {
        type: Number,
        default: 1
      },
      max: {
        type: Number,
        default: 10000
      },
      daily: {
        type: Number,
        default: 50000
      }
    },
    withdrawal: {
      min: {
        type: Number,
        default: 1
      },
      max: {
        type: Number,
        default: 10000
      },
      daily: {
        type: Number,
        default: 50000
      }
    }
  },
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
providerSchema.index({ name: 1 });
providerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Provider', providerSchema);
