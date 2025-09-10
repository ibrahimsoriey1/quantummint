const Joi = require('joi');
const logger = require('../utils/logger');

const transactionSchema = Joi.object({
  fromUserId: Joi.string().when('type', {
    is: Joi.string().valid('transfer', 'withdrawal', 'fee'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  toUserId: Joi.string().when('type', {
    is: Joi.string().valid('transfer', 'deposit', 'generation'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  amount: Joi.number().positive().required(),
  currency: Joi.string().default('QMC'),
  type: Joi.string().valid('transfer', 'deposit', 'withdrawal', 'generation', 'payment', 'fee').required(),
  description: Joi.string().max(500).optional(),
  metadata: Joi.object().optional()
});

const transactionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('pending', 'completed', 'failed', 'cancelled').optional(),
  type: Joi.string().valid('transfer', 'deposit', 'withdrawal', 'generation', 'payment', 'fee').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

const validateTransaction = (req, res, next) => {
  const { error, value } = transactionSchema.validate(req.body);
  
  if (error) {
    logger.error('Transaction validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.body = value;
  next();
};

const validateTransactionQuery = (req, res, next) => {
  const { error, value } = transactionQuerySchema.validate(req.query);
  
  if (error) {
    logger.error('Transaction query validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Query validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.query = value;
  next();
};

module.exports = {
  validateTransaction,
  validateTransactionQuery
};
