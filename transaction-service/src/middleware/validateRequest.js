const { validationResult } = require('express-validator');
const { ApiError } = require('./errorHandler');

/**
 * Middleware to validate request data using express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Get the first error message
    const errorMessage = errors.array()[0].msg;
    return next(new ApiError(400, errorMessage));
  }
  
  next();
};

module.exports = { validateRequest };