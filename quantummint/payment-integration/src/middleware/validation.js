const Joi = require('joi');
const logger = require('../utils/logger');

const paymentSchema = Joi.object({
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).default('USD'),
  provider: Joi.string().valid('stripe', 'orange_money', 'afrimoney').required(),
  type: Joi.string().valid('deposit', 'withdrawal', 'payment').required(),
  paymentMethod: Joi.object({
    type: Joi.string().valid('card', 'mobile_money', 'bank_transfer').required(),
    details: Joi.object().optional()
  }).required(),
  description: Joi.string().max(500).optional(),
  metadata: Joi.object().optional()
});

const paymentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded').optional(),
  provider: Joi.string().valid('stripe', 'orange_money', 'afrimoney').optional(),
  type: Joi.string().valid('deposit', 'withdrawal', 'payment').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

const validatePayment = (req, res, next) => {
  const { error, value } = paymentSchema.validate(req.body);
  
  if (error) {
    logger.error('Payment validation error:', error.details);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  
  req.body = value;
  next();
};

const validatePaymentQuery = (req, res, next) => {
  const { error, value } = paymentQuerySchema.validate(req.query);
  
  if (error) {
    logger.error('Payment query validation error:', error.details);
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
  validatePayment,
  validatePaymentQuery
};
