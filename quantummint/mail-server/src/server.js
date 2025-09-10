const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { main: logger } = require('./utils/logger');
const SMTPServer = require('./smtp/SMTPServer');
const IMAPServer = require('./imap/IMAPServer');
const POP3Server = require('./pop3/POP3Server');
const WebInterface = require('./web/WebInterface');
const MailQueue = require('./queue/MailQueue');
const SecurityManager = require('./security/SecurityManager');
const DNSManager = require('./dns/DNSManager');
const AnalyticsService = require('./analytics/AnalyticsService');

class QuantumMailServer {
  constructor() {
    this.app = express();
    this.smtpServer = null;
    this.imapServer = null;
    this.pop3Server = null;
    this.webInterface = null;
    this.mailQueue = null;
    this.securityManager = null;
    this.dnsManager = null;
    this.analyticsService = null;
    
    this.config = {
      // Server Configuration
      smtp: {
        port: process.env.SMTP_PORT || 25,
        submissionPort: process.env.SMTP_SUBMISSION_PORT || 587,
        securePort: process.env.SMTP_SECURE_PORT || 465,
        hostname: process.env.MAIL_HOSTNAME || 'mail.quantummint.com',
        maxConnections: process.env.SMTP_MAX_CONNECTIONS || 100,
        maxMessages: process.env.SMTP_MAX_MESSAGES || 1000
      },
      imap: {
        port: process.env.IMAP_PORT || 143,
        securePort: process.env.IMAP_SECURE_PORT || 993,
        maxConnections: process.env.IMAP_MAX_CONNECTIONS || 50
      },
      pop3: {
        port: process.env.POP3_PORT || 110,
        securePort: process.env.POP3_SECURE_PORT || 995,
        maxConnections: process.env.POP3_MAX_CONNECTIONS || 30
      },
      web: {
        port: process.env.WEB_PORT || 8080,
        adminPort: process.env.ADMIN_PORT || 8081
      },
      // Security Configuration
      security: {
        enableSPF: process.env.ENABLE_SPF !== 'false',
        enableDKIM: process.env.ENABLE_DKIM !== 'false',
        enableDMARC: process.env.ENABLE_DMARC !== 'false',
        enableAntiSpam: process.env.ENABLE_ANTISPAM !== 'false',
        enableAntiVirus: process.env.ENABLE_ANTIVIRUS !== 'false',
        tlsRequired: process.env.TLS_REQUIRED !== 'false',
        maxMessageSize: process.env.MAX_MESSAGE_SIZE || 25 * 1024 * 1024, // 25MB
        rateLimitPerHour: process.env.RATE_LIMIT_PER_HOUR || 100
      },
      // Database Configuration
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/quantummail',
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }
      },
      // Redis Configuration
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        db: process.env.REDIS_DB || 0
      }
    };
  }

  async initialize() {
    try {
      logger.info('Initializing QuantumMint Mail Server...');

      // Connect to MongoDB
      await this.connectDatabase();

      // Initialize core services
      await this.initializeServices();

      // Setup Express middleware
      this.setupMiddleware();

      // Start all servers
      await this.startServers();

      logger.info('QuantumMint Mail Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize mail server:', error);
      process.exit(1);
    }
  }

  async connectDatabase() {
    try {
      await mongoose.connect(this.config.database.uri, this.config.database.options);
      logger.info('Connected to MongoDB');
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async initializeServices() {
    // Initialize Analytics Service first
    this.analyticsService = new AnalyticsService({
      redis: this.config.redis
    });
    await this.analyticsService.start();

    // Initialize Security Manager
    this.securityManager = new SecurityManager(this.config.security);
    await this.securityManager.start();

    // Initialize DNS Manager
    this.dnsManager = new DNSManager({ domain: this.config.smtp.hostname });

    // Initialize Mail Queue
    this.mailQueue = new MailQueue({
      redis: this.config.redis,
      securityManager: this.securityManager,
      analyticsService: this.analyticsService
    });
    await this.mailQueue.start();

    // Initialize SMTP Server
    this.smtpServer = new SMTPServer({
      ...this.config.smtp,
      securityManager: this.securityManager,
      mailQueue: this.mailQueue,
      analyticsService: this.analyticsService
    });

    // Initialize IMAP Server
    this.imapServer = new IMAPServer({
      ...this.config.imap,
      securityManager: this.securityManager,
      analyticsService: this.analyticsService
    });

    // Initialize POP3 Server
    this.pop3Server = new POP3Server({
      ...this.config.pop3,
      securityManager: this.securityManager,
      analyticsService: this.analyticsService
    });

    // Initialize Web Interface
    this.webInterface = new WebInterface({
      ...this.config.web,
      smtpServer: this.smtpServer,
      imapServer: this.imapServer,
      pop3Server: this.pop3Server,
      securityManager: this.securityManager,
      analyticsService: this.analyticsService,
      dnsManager: this.dnsManager
    });

    logger.info('All services initialized');
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use('/api', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  async startServers() {
    try {
      // Start SMTP Server
      await this.smtpServer.start();
      logger.info(`SMTP Server started on ports ${this.config.smtp.port}, ${this.config.smtp.submissionPort}, ${this.config.smtp.securePort}`);

      // Start IMAP Server
      await this.imapServer.start();
      logger.info(`IMAP Server started on ports ${this.config.imap.port}, ${this.config.imap.securePort}`);

      // Start POP3 Server
      await this.pop3Server.start();
      logger.info(`POP3 Server started on ports ${this.config.pop3.port}, ${this.config.pop3.securePort}`);

      // Start Web Interface
      this.app.use('/api', this.webInterface.getRouter());
      this.app.use('/', this.webInterface.getStaticRouter());

      this.app.listen(this.config.web.port, () => {
        logger.info(`Web Interface started on port ${this.config.web.port}`);
      });

      // Start Admin Interface
      const adminApp = express();
      adminApp.use('/admin', this.webInterface.getAdminRouter());
      adminApp.listen(this.config.web.adminPort, () => {
        logger.info(`Admin Interface started on port ${this.config.web.adminPort}`);
      });

    } catch (error) {
      logger.error('Failed to start servers:', error);
      throw error;
    }
  }

  async shutdown() {
    logger.info('Shutting down QuantumMint Mail Server...');

    try {
      // Stop all servers
      if (this.smtpServer) await this.smtpServer.stop();
      if (this.imapServer) await this.imapServer.stop();
      if (this.pop3Server) await this.pop3Server.stop();

      // Close database connection
      await mongoose.connection.close();

      // Stop queue processing
      if (this.mailQueue) await this.mailQueue.close();

      logger.info('QuantumMint Mail Server shut down successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  if (global.mailServer) {
    await global.mailServer.shutdown();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (global.mailServer) {
    await global.mailServer.shutdown();
  }
  process.exit(0);
});

// Start the server
async function startServer() {
  try {
    const mailServer = new QuantumMailServer();
    global.mailServer = mailServer;
    await mailServer.initialize();
  } catch (error) {
    logger.error('Failed to start mail server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = QuantumMailServer;
