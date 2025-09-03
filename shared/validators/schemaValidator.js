const mongoose = require('mongoose');

/**
 * Schema validation utilities for the QuantumMint database
 */
class SchemaValidator {
  constructor() {
    this.validationRules = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^\+?[1-9]\d{1,14}$/,
      username: /^[a-zA-Z0-9_]{3,30}$/,
      password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      currency: /^[A-Z]{3}$/,
      objectId: /^[0-9a-fA-F]{24}$/
    };
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { isValid: false, error: 'Email is required and must be a string' };
    }
    
    if (!this.validationRules.email.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate phone number format
   */
  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return { isValid: false, error: 'Phone number is required and must be a string' };
    }
    
    if (!this.validationRules.phone.test(phone)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate username format
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { isValid: false, error: 'Username is required and must be a string' };
    }
    
    if (!this.validationRules.username.test(username)) {
      return { isValid: false, error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate password strength
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'Password is required and must be a string' };
    }
    
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }
    
    if (!this.validationRules.password.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate currency code
   */
  validateCurrency(currency) {
    if (!currency || typeof currency !== 'string') {
      return { isValid: false, error: 'Currency is required and must be a string' };
    }
    
    if (!this.validationRules.currency.test(currency)) {
      return { isValid: false, error: 'Invalid currency code format' };
    }
    
    const supportedCurrencies = [
      'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 
      'MXN', 'ZAR', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF'
    ];
    
    if (!supportedCurrencies.includes(currency)) {
      return { isValid: false, error: `Currency ${currency} is not supported` };
    }
    
    return { isValid: true };
  }

  /**
   * Validate ObjectId format
   */
  validateObjectId(id) {
    if (!id) {
      return { isValid: false, error: 'ID is required' };
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { isValid: false, error: 'Invalid ObjectId format' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate amount (positive number)
   */
  validateAmount(amount) {
    if (typeof amount !== 'number') {
      return { isValid: false, error: 'Amount must be a number' };
    }
    
    if (amount <= 0) {
      return { isValid: false, error: 'Amount must be greater than 0' };
    }
    
    if (amount > 1000000) {
      return { isValid: false, error: 'Amount cannot exceed 1,000,000' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate date
   */
  validateDate(date) {
    if (!date) {
      return { isValid: false, error: 'Date is required' };
    }
    
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate enum value
   */
  validateEnum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
      return { 
        isValid: false, 
        error: `${fieldName} must be one of: ${allowedValues.join(', ')}` 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate user data
   */
  validateUser(userData) {
    const errors = [];
    
    // Required fields
    const requiredFields = ['username', 'email', 'passwordHash', 'firstName', 'lastName', 'dateOfBirth', 'address.country'];
    for (const field of requiredFields) {
      if (!this.getNestedValue(userData, field)) {
        errors.push(`${field} is required`);
      }
    }
    
    // Validate individual fields
    if (userData.username) {
      const usernameValidation = this.validateUsername(userData.username);
      if (!usernameValidation.isValid) errors.push(usernameValidation.error);
    }
    
    if (userData.email) {
      const emailValidation = this.validateEmail(userData.email);
      if (!emailValidation.isValid) errors.push(emailValidation.error);
    }
    
    if (userData.phoneNumber) {
      const phoneValidation = this.validatePhone(userData.phoneNumber);
      if (!phoneValidation.isValid) errors.push(phoneValidation.error);
    }
    
    if (userData.dateOfBirth) {
      const dateValidation = this.validateDate(userData.dateOfBirth);
      if (!dateValidation.isValid) errors.push(dateValidation.error);
    }
    
    // Validate enum fields
    const roleValidation = this.validateEnum(userData.role, ['user', 'admin', 'super_admin', 'moderator', 'support'], 'Role');
    if (!roleValidation.isValid) errors.push(roleValidation.error);
    
    const statusValidation = this.validateEnum(userData.status, ['active', 'inactive', 'suspended', 'banned', 'pending_verification'], 'Status');
    if (!statusValidation.isValid) errors.push(statusValidation.error);
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate wallet data
   */
  validateWallet(walletData) {
    const errors = [];
    
    // Required fields
    if (!walletData.userId) {
      errors.push('userId is required');
    } else {
      const idValidation = this.validateObjectId(walletData.userId);
      if (!idValidation.isValid) errors.push(idValidation.error);
    }
    
    if (walletData.currency) {
      const currencyValidation = this.validateCurrency(walletData.currency);
      if (!currencyValidation.isValid) errors.push(currencyValidation.error);
    }
    
    if (walletData.balance !== undefined) {
      const amountValidation = this.validateAmount(walletData.balance);
      if (!amountValidation.isValid) errors.push(amountValidation.error);
    }
    
    // Validate enum fields
    const walletTypeValidation = this.validateEnum(walletData.walletType, ['primary', 'savings', 'business', 'escrow'], 'Wallet type');
    if (!walletTypeValidation.isValid) errors.push(walletTypeValidation.error);
    
    const statusValidation = this.validateEnum(walletData.status, ['active', 'suspended', 'locked', 'closed'], 'Status');
    if (!statusValidation.isValid) errors.push(statusValidation.error);
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate transaction data
   */
  validateTransaction(transactionData) {
    const errors = [];
    
    // Required fields
    if (!transactionData.userId) {
      errors.push('userId is required');
    } else {
      const idValidation = this.validateObjectId(transactionData.userId);
      if (!idValidation.isValid) errors.push(idValidation.error);
    }
    
    if (!transactionData.amount) {
      errors.push('amount is required');
    } else {
      const amountValidation = this.validateAmount(transactionData.amount);
      if (!amountValidation.isValid) errors.push(amountValidation.error);
    }
    
    if (transactionData.currency) {
      const currencyValidation = this.validateCurrency(transactionData.currency);
      if (!currencyValidation.isValid) errors.push(currencyValidation.error);
    }
    
    // Validate enum fields
    const typeValidation = this.validateEnum(transactionData.transactionType, 
      ['generation', 'transfer', 'payment', 'withdrawal', 'refund', 'fee', 'bonus', 'adjustment', 'deposit', 'cashout'], 
      'Transaction type');
    if (!typeValidation.isValid) errors.push(typeValidation.error);
    
    const statusValidation = this.validateEnum(transactionData.status, 
      ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'expired'], 
      'Status');
    if (!statusValidation.isValid) errors.push(statusValidation.error);
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Helper method to get nested object values
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * Sanitize input data
   */
  sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.trim();
    }
    return input;
  }

  /**
   * Validate and sanitize all input data
   */
  validateAndSanitize(data, validationRules) {
    const sanitizedData = {};
    const errors = [];
    
    for (const [field, rules] of Object.entries(validationRules)) {
      const value = this.sanitizeInput(data[field]);
      
      if (rules.required && !value) {
        errors.push(`${field} is required`);
        continue;
      }
      
      if (value && rules.validator) {
        const validation = rules.validator(value);
        if (!validation.isValid) {
          errors.push(validation.error);
        } else {
          sanitizedData[field] = value;
        }
      } else if (value) {
        sanitizedData[field] = value;
      }
    }
    
    return {
      isValid: errors.length === 0,
      data: sanitizedData,
      errors: errors
    };
  }
}

module.exports = new SchemaValidator();
