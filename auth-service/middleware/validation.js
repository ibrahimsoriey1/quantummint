const { validationResult } = require('express-validator');

// Middleware to check for validation errors
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

// Custom validation for MongoDB ObjectId
const isValidObjectId = (value) => {
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return objectIdPattern.test(value);
};

// Custom validation for email format
const isValidEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

// Custom validation for phone number
const isValidPhone = (phone) => {
  const phonePattern = /^\+?[\d\s-()]+$/;
  return phonePattern.test(phone);
};

// Custom validation for password strength
const isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordPattern.test(password);
};

// Custom validation for username
const isValidUsername = (username) => {
  // 3-30 characters, alphanumeric only
  const usernamePattern = /^[a-zA-Z0-9]{3,30}$/;
  return usernamePattern.test(username);
};

// Custom validation for amount (positive number with up to 2 decimal places)
const isValidAmount = (amount) => {
  const amountPattern = /^\d+(\.\d{1,2})?$/;
  return amountPattern.test(amount) && parseFloat(amount) > 0;
};

// Custom validation for currency code
const isValidCurrency = (currency) => {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'QMT'];
  return validCurrencies.includes(currency);
};

// Custom validation for date format (ISO 8601)
const isValidDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

// Custom validation for boolean values
const isValidBoolean = (value) => {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    return ['true', 'false', '1', '0'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') {
    return value === 0 || value === 1;
  }
  return false;
};

// Custom validation for wallet address format
const isValidWalletAddress = (address) => {
  const walletPattern = /^QM[A-Z0-9]+$/;
  return walletPattern.test(address);
};

// Sanitization helpers
const sanitizeInput = {
  // Remove HTML tags and scripts
  removeHtml: (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');
  },

  // Trim whitespace
  trim: (input) => {
    if (typeof input !== 'string') return input;
    return input.trim();
  },

  // Convert to lowercase
  toLowerCase: (input) => {
    if (typeof input !== 'string') return input;
    return input.toLowerCase();
  },

  // Convert to uppercase
  toUpperCase: (input) => {
    if (typeof input !== 'string') return input;
    return input.toUpperCase();
  },

  // Remove special characters (keep alphanumeric and spaces)
  removeSpecialChars: (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/[^a-zA-Z0-9\s]/g, '');
  },

  // Escape HTML entities
  escapeHtml: (input) => {
    if (typeof input !== 'string') return input;
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    return input.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
  }
};

// Validation error formatter
const formatValidationErrors = (errors) => {
  return errors.map(error => ({
    field: error.path,
    message: error.msg,
    value: error.value,
    type: error.type || 'validation'
  }));
};

// Custom error messages
const customErrorMessages = {
  required: (field) => `${field} is required`,
  invalid: (field) => `${field} is invalid`,
  tooShort: (field, min) => `${field} must be at least ${min} characters long`,
  tooLong: (field, max) => `${field} must be no more than ${max} characters long`,
  invalidFormat: (field) => `${field} format is invalid`,
  alreadyExists: (field) => `${field} already exists`,
  notFound: (field) => `${field} not found`,
  insufficientPermissions: () => 'Insufficient permissions',
  unauthorized: () => 'Unauthorized access',
  forbidden: () => 'Access forbidden'
};

module.exports = {
  validateRequest,
  isValidObjectId,
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidUsername,
  isValidAmount,
  isValidCurrency,
  isValidDate,
  isValidBoolean,
  isValidWalletAddress,
  sanitizeInput,
  formatValidationErrors,
  customErrorMessages
};
