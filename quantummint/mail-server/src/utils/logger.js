const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for mail server logs
const mailServerFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}] [${service || 'mail-server'}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: mailServerFormat,
  defaultMeta: { service: 'mail-server' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'mail-server.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    }),

    // SMTP specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'smtp.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          if (service === 'smtp' || message.includes('SMTP')) {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
          }
          return null;
        }),
        winston.format((info) => info.message ? info : false)()
      )
    }),

    // Security logs
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          if (service === 'security' || message.includes('Security') || level === 'warn' || level === 'error') {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
          }
          return null;
        }),
        winston.format((info) => info.message ? info : false)()
      )
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `[${service || 'mail-server'}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// Create specialized loggers for different components
const createComponentLogger = (component) => {
  return logger.child({ service: component });
};

module.exports = {
  main: logger,
  logger,
  createComponentLogger,
  
  // Specialized loggers
  smtp: createComponentLogger('smtp'),
  imap: createComponentLogger('imap'),
  pop3: createComponentLogger('pop3'),
  security: createComponentLogger('security'),
  queue: createComponentLogger('queue'),
  analytics: createComponentLogger('analytics'),
  dns: createComponentLogger('dns'),
  web: createComponentLogger('web')
};
