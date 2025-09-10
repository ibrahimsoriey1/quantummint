const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for domain controller logs
const domainControllerFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}] [${service || 'domain-controller'}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: domainControllerFormat,
  defaultMeta: { service: 'domain-controller' },
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
      filename: path.join(logsDir, 'domain-controller.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    }),

    // LDAP specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'ldap.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          if (service === 'ldap' || message.includes('LDAP')) {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
          }
          return null;
        }),
        winston.format((info) => info.message ? info : false)()
      )
    }),

    // Kerberos specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'kerberos.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          if (service === 'kerberos' || message.includes('Kerberos')) {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}`;
          }
          return null;
        }),
        winston.format((info) => info.message ? info : false)()
      )
    }),

    // Security and audit logs
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          if (service === 'security' || service === 'audit' || message.includes('Security') || level === 'warn' || level === 'error') {
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
        return `[${service || 'domain-controller'}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

const mainLogger = logger;
const ldapLogger = mainLogger.child({ service: 'ldap' });
const kerberosLogger = mainLogger.child({ service: 'kerberos' });
const dnsLogger = mainLogger.child({ service: 'dns' });
const directoryLogger = mainLogger.child({ service: 'directory' });
const securityLogger = mainLogger.child({ service: 'security' });
const auditLogger = mainLogger.child({ service: 'audit' });
const replicationLogger = mainLogger.child({ service: 'replication' });
const policyLogger = mainLogger.child({ service: 'policy' });
const webLogger = mainLogger.child({ service: 'web' });

module.exports = {
  main: mainLogger,
  ldap: ldapLogger,
  kerberos: kerberosLogger,
  dns: dnsLogger,
  directory: directoryLogger,
  security: securityLogger,
  audit: auditLogger,
  replication: replicationLogger,
  policy: policyLogger,
  web: webLogger,
  integration: mainLogger.child({ service: 'integration' })
};
