const { ApiError } = require('./errorHandler');

/**
 * Middleware to authorize users based on roles
 * @param {Array} roles - Array of allowed roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
      return next(new ApiError(401, 'Authentication required. Please log in.'));
    }
    
    // Check if user's role is in the allowed roles
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action.'));
    }
    
    next();
  };
};

module.exports = { authorize };