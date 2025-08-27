/**
 * Audit Logger for QuantumMint
 * Provides comprehensive audit logging for all sensitive operations
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger.util');

/**
 * Audit Log Schema
 */
const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource: {
    type: String,
    required: true,
    index: true
  },
  resourceId: {
    type: String,
    index: true
  },
  description: {
    type: String
  },
  metadata: {
    type: Object
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Create model if it doesn't exist
let AuditLog;
try {
  AuditLog = mongoose.model('AuditLog');
} catch (error) {
  AuditLog = mongoose.model('AuditLog', auditLogSchema);
}

/**
 * Audit Logger Service
 * Handles logging of all sensitive operations
 */
class AuditLoggerService {
  /**
   * Initialize audit logger service
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.db = options.db || mongoose.connection;
    this.logger = options.logger || logger;
    this.AuditLog = options.AuditLog || AuditLog;
    this.enabled = options.enabled !== false;
    this.logToConsole = options.logToConsole !== false;
    this.sensitiveFields = options.sensitiveFields || [
      'password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'
    ];
  }

  /**
   * Log an audit event
   * @param {Object} logData - Audit log data
   * @returns {Promise<Object>} Created audit log
   */
  async log(logData) {
    try {
      if (!this.enabled) {
        return null;
      }

      // Sanitize sensitive data
      const sanitizedMetadata = this.sanitizeSensitiveData(logData.metadata || {});

      // Create audit log entry
      const auditLog = new this.AuditLog({
        userId: logData.userId,
        action: logData.action,
        resource: logData.resource,
        resourceId: logData.resourceId,
        description: logData.description,
        metadata: sanitizedMetadata,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        status: logData.status || 'success'
      });

      // Save to database
      await auditLog.save();

      // Log to console if enabled
      if (this.logToConsole) {
        const logLevel = logData.status === 'failure' ? 'error' : 
                        logData.status === 'warning' ? 'warn' : 'info';
        
        this.logger[logLevel]('QuantumMint Audit Log', {
          userId: logData.userId,
          action: logData.action,
          resource: logData.resource,
          resourceId: logData.resourceId,
          description: logData.description,
          status: logData.status || 'success',
          timestamp: new Date()
        });
      }

      return auditLog;
    } catch (error) {
      this.logger.error('QuantumMint Audit Logging Error', {
        error: error.message,
        stack: error.stack
      });
      
      // Try to log to console even if database logging failed
      if (this.logToConsole) {
        this.logger.warn('QuantumMint Audit Log (Fallback)', {
          userId: logData.userId,
          action: logData.action,
          resource: logData.resource,
          description: logData.description,
          status: 'warning',
          error: 'Failed to save to database',
          timestamp: new Date()
        });
      }
      
      return null;
    }
  }

  /**
   * Create Express middleware for audit logging
   * @param {Object} options - Middleware options
   * @returns {Function} Express middleware
   */
  middleware(options = {}) {
    const resourceResolver = options.resourceResolver || ((req) => req.baseUrl);
    const actionResolver = options.actionResolver || this.defaultActionResolver;
    const metadataResolver = options.metadataResolver || this.defaultMetadataResolver;
    
    return async (req, res, next) => {
      // Store original end function
      const originalEnd = res.end;
      
      // Override end function to capture response
      res.end = async function(...args) {
        // Restore original end function
        res.end = originalEnd;
        
        try {
          // Get audit log data
          const resource = resourceResolver(req);
          const action = actionResolver(req);
          const metadata = metadataResolver(req, res);
          
          // Determine status based on response status code
          let status = 'success';
          if (res.statusCode >= 400 && res.statusCode < 500) {
            status = 'warning';
          } else if (res.statusCode >= 500) {
            status = 'failure';
          }
          
          // Log audit event
          await this.log({
            userId: req.user ? req.user.id : null,
            action,
            resource,
            resourceId: req.params.id,
            description: `${req.method} ${req.originalUrl}`,
            metadata,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            status
          });
        } catch (error) {
          logger.error('QuantumMint Audit Middleware Error', {
            error: error.message,
            stack: error.stack
          });
        }
        
        // Call original end function
        return originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  /**
   * Default action resolver based on HTTP method
   * @param {Object} req - Express request
   * @returns {String} Action name
   */
  defaultActionResolver(req) {
    switch (req.method) {
      case 'GET':
        return req.params.id ? 'read' : 'list';
      case 'POST':
        return 'create';
      case 'PUT':
      case 'PATCH':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return 'other';
    }
  }

  /**
   * Default metadata resolver
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @returns {Object} Metadata
   */
  defaultMetadataResolver(req, res) {
    return {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      query: req.query,
      statusCode: res.statusCode
    };
  }

  /**
   * Sanitize sensitive data in metadata
   * @param {Object} metadata - Metadata object
   * @returns {Object} Sanitized metadata
   */
  sanitizeSensitiveData(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return metadata;
    }
    
    const sanitized = { ...metadata };
    
    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (this.sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeSensitiveData(sanitized[key]);
      }
    }
    
    return sanitized;
  }

  /**
   * Query audit logs
   * @param {Object} query - Query parameters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Audit logs
   */
  async query(query = {}, options = {}) {
    try {
      const limit = options.limit || 100;
      const skip = options.skip || 0;
      const sort = options.sort || { createdAt: -1 };
      
      return await this.AuditLog.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean();
    } catch (error) {
      this.logger.error('QuantumMint Audit Query Error', {
        error: error.message,
        query,
        options
      });
      throw error;
    }
  }
}

module.exports = AuditLoggerService;