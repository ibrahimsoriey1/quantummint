const Joi = require('joi');

/**
 * Validate wallet request
 */
exports.validateWalletRequest = (data) => {
  const schema = Joi.object({
    userId: Joi.string()
      .optional()
      .messages({
        'string.base': 'User ID must be a string'
      }),
    
    currency: Joi.string()
      .default('USD')
      .messages({
        'string.base': 'Currency must be a string'
      }),
    
    walletType: Joi.string()
      .valid('personal', 'business', 'savings')
      .default('personal')
      .messages({
        'string.base': 'Wallet type must be a string',
        'any.only': 'Wallet type must be one of: personal, business, savings'
      }),
    
    name: Joi.string()
      .default('Default Wallet')
      .messages({
        'string.base': 'Name must be a string'
      }),
    
    metadata: Joi.object()
      .optional()
  });
  
  return schema.validate(data);
};

/**
 * Validate wallet status update request
 */
exports.validateWalletStatusRequest = (data) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('active', 'suspended', 'closed')
      .required()
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: active, suspended, closed',
        'any.required': 'Status is required'
      })
  });
  
  return schema.validate(data);
};

/**
 * Validate wallet name update request
 */
exports.validateWalletNameRequest = (data) => {
  const schema = Joi.object({
    name: Joi.string()
      .required()
      .messages({
        'string.base': 'Name must be a string',
        'any.required': 'Name is required'
      })
  });
  
  return schema.validate(data);
};