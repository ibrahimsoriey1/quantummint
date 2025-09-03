const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'payment-integration-service' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info'
    }),
    
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseInt(process.env.LOG_MAX_SIZE) || 20 * 1024 * 1024, // 20MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14, // 14 days
      format: logFormat
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: parseInt(process.env.LOG_MAX_SIZE) || 20 * 1024 * 1024, // 20MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14, // 14 days
      format: logFormat
    })
  ]
});

// Custom logging methods for different categories
logger.payment = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'payment' });
};

logger.webhook = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'webhook' });
};

logger.settlement = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'settlement' });
};

logger.provider = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'provider' });
};

logger.fraud = (message, meta = {}) => {
  logger.warn(message, { ...meta, category: 'fraud' });
};

logger.security = (message, meta = {}) => {
  logger.warn(message, { ...meta, category: 'security' });
};

logger.performance = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'performance' });
};

logger.audit = (message, meta = {}) => {
  logger.info(message, { ...meta, category: 'audit' });
};

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: logFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: logFormat
  })
);

module.exports = logger;
