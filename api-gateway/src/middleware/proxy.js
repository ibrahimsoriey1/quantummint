const { createProxyMiddleware } = require('http-proxy-middleware');
const { logger } = require('../utils/logger');
const { services, SERVICE_KEY } = require('../config/services');
const { requestIdHeaderName } = require('/usr/src/shared');

/**
 * Create a proxy middleware for a service
 * @param {String} serviceName - Service name
 * @param {String} serviceUrl - Service URL
 * @returns {Function} - Proxy middleware
 */
const createServiceProxy = (serviceName, serviceUrl) => {
  return createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,
    // Preserve the full path (e.g., /api/auth/login stays /api/auth/login)
    pathRewrite: (path) => path,
    onProxyReq: (proxyReq, req, res) => {
      // Add service key header for internal communication
      proxyReq.setHeader('x-service-key', SERVICE_KEY);
      
      // Forward user info if available
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-email', req.user.email);
        proxyReq.setHeader('x-user-role', req.user.role);
      }

      // Propagate request ID
      if (req.requestId) {
        proxyReq.setHeader(requestIdHeaderName, req.requestId);
      }
      
      // Log the proxied request
      logger.info(`Proxying ${req.method} ${req.originalUrl} to ${serviceName} service`);
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error: ${err.message}`);
      res.status(502).json({
        success: false,
        status: 502,
        message: `Service ${serviceName} is currently unavailable`,
        path: req.originalUrl,
        method: req.method
      });
    }
  });
};

// Create proxies for each service
const authProxy = createServiceProxy('auth', services.auth.url);
const moneyGenerationProxy = createServiceProxy('money-generation', services.moneyGeneration.url);
const transactionProxy = createServiceProxy('transactions', services.transaction.url);
const paymentProxy = createServiceProxy('payments', services.payment.url);
const kycProxy = createServiceProxy('kyc', services.kyc.url);

module.exports = {
  authProxy,
  moneyGenerationProxy,
  transactionProxy,
  paymentProxy,
  kycProxy
};