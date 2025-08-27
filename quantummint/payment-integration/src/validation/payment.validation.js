const Joi = require('joi');

/**
 * Validate cash out request
 */
exports.validateCashOutRequest = (data) => {
  const schema = Joi.object({
    walletId: Joi.string()
      .required()
      .messages({
        'string.base': 'Wallet ID must be a string',
        'any.required': 'Wallet ID is required'
      }),
    
    amount: Joi.number()
      .positive()
      .required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.positive': 'Amount must be positive',
        'any.required': 'Amount is required'
      }),
    
    currency: Joi.string()
      .required()
      .messages({
        'string.base': 'Currency must be a string',
        'any.required': 'Currency is required'
      }),
    
    provider: Joi.string()
      .valid('orange_money', 'afrimoney', 'stripe')
      .required()
      .messages({
        'string.base': 'Provider must be a string',
        'any.only': 'Provider must be one of: orange_money, afrimoney, stripe',
        'any.required': 'Provider is required'
      }),
    
    providerAccountId: Joi.string()
      .required()
      .messages({
        'string.base': 'Provider account ID must be a string',
        'any.required': 'Provider account ID is required'
      }),
    
    providerAccountName: Joi.string()
      .required()
      .messages({
        'string.base': 'Provider account name must be a string',
        'any.required': 'Provider account name is required'
      }),
    
    reference: Joi.string()
      .optional()
      .messages({
        'string.base': 'Reference must be a string'
      })
  });
  
  return schema.validate(data);
};

/**
 * Validate cash out status request
 */
exports.validateCashOutStatusRequest = (data) => {
  const schema = Joi.object({
    cashOutId: Joi.string()
      .required()
      .messages({
        'string.base': 'Cash out ID must be a string',
        'any.required': 'Cash out ID is required'
      })
  });
  
  return schema.validate(data);
};

/**
 * Validate cash out history request
 */
exports.validateCashOutHistoryRequest = (data) => {
  const schema = Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    
    status: Joi.string()
      .valid('pending', 'processing', 'completed', 'failed', 'cancelled')
      .optional()
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: pending, processing, completed, failed, cancelled'
      }),
    
    provider: Joi.string()
      .valid('orange_money', 'afrimoney', 'stripe')
      .optional()
      .messages({
        'string.base': 'Provider must be a string',
        'any.only': 'Provider must be one of: orange_money, afrimoney, stripe'
      }),
    
    startDate: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.base': 'Start date must be a valid date',
        'date.format': 'Start date must be in ISO format'
      }),
    
    endDate: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.base': 'End date must be a valid date',
        'date.format': 'End date must be in ISO format'
      }),
    
    walletId: Joi.string()
      .optional()
      .messages({
        'string.base': 'Wallet ID must be a string'
      })
  });
  
  return schema.validate(data);
};