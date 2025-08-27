const Joi = require('joi');

/**
 * Validate transaction request
 */
exports.validateTransactionRequest = (data) => {
  const schema = Joi.object({
    transactionType: Joi.string()
      .valid('generation', 'transfer', 'cash_out', 'refund')
      .required()
      .messages({
        'string.base': 'Transaction type must be a string',
        'any.only': 'Transaction type must be one of: generation, transfer, cash_out, refund',
        'any.required': 'Transaction type is required'
      }),
    
    sourceType: Joi.string()
      .valid('wallet', 'system', 'external')
      .required()
      .messages({
        'string.base': 'Source type must be a string',
        'any.only': 'Source type must be one of: wallet, system, external',
        'any.required': 'Source type is required'
      }),
    
    sourceId: Joi.string()
      .required()
      .messages({
        'string.base': 'Source ID must be a string',
        'any.required': 'Source ID is required'
      }),
    
    destinationType: Joi.string()
      .valid('wallet', 'external')
      .required()
      .messages({
        'string.base': 'Destination type must be a string',
        'any.only': 'Destination type must be one of: wallet, external',
        'any.required': 'Destination type is required'
      }),
    
    destinationId: Joi.string()
      .required()
      .messages({
        'string.base': 'Destination ID must be a string',
        'any.required': 'Destination ID is required'
      }),
    
    userId: Joi.string()
      .optional()
      .messages({
        'string.base': 'User ID must be a string'
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
    
    fee: Joi.number()
      .min(0)
      .default(0)
      .messages({
        'number.base': 'Fee must be a number',
        'number.min': 'Fee cannot be negative'
      }),
    
    description: Joi.string()
      .optional()
      .messages({
        'string.base': 'Description must be a string'
      }),
    
    reference: Joi.string()
      .optional()
      .messages({
        'string.base': 'Reference must be a string'
      }),
    
    metadata: Joi.object()
      .optional()
  });
  
  return schema.validate(data);
};