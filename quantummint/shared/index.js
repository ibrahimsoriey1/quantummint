// Shared utilities and models for QuantumMint services
const emailService = require('./utils/email');
const QuantumMailClient = require('./utils/mailClient');

module.exports = {
  // Database models
  User: require('./models/User'),
  Transaction: require('./models/Transaction'),
  Wallet: require('./models/Wallet'),
  
  // Utilities
  CryptoUtils: require('./utils/crypto'),
  EmailUtils: require('./utils/email'),
  Logger: require('./utils/logger'),
  ValidationUtils: require('./utils/validation'),
  
  // Services
  emailService,
  QuantumMailClient
};
