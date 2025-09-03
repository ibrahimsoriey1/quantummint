const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'auth-service' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/rejections.log')
    })
  ]
});

// If we're not in production, log to console with more detail
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Add custom methods for better logging
logger.startup = (message, meta = {}) => {
  logger.info(`🚀 ${message}`, { ...meta, type: 'startup' });
};

logger.auth = (message, meta = {}) => {
  logger.info(`🔐 ${message}`, { ...meta, type: 'authentication' });
};

logger.user = (message, meta = {}) => {
  logger.info(`👤 ${message}`, { ...meta, type: 'user' });
};

logger.security = (message, meta = {}) => {
  logger.warn(`🛡️ ${message}`, { ...meta, type: 'security' });
};

logger.database = (message, meta = {}) => {
  logger.info(`🗄️ ${message}`, { ...meta, type: 'database' });
};

logger.cache = (message, meta = {}) => {
  logger.info(`💾 ${message}`, { ...meta, type: 'cache' });
};

logger.email = (message, meta = {}) => {
  logger.info(`📧 ${message}`, { ...meta, type: 'email' });
};

logger.rateLimit = (message, meta = {}) => {
  logger.warn(`⏱️ ${message}`, { ...meta, type: 'rate_limit' });
};

// Export logger
module.exports = logger;
