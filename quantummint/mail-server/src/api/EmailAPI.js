const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { api: logger } = require('../utils/logger');
const MailUser = require('../models/MailUser');
const EmailMessage = require('../models/EmailMessage');

class QuantumEmailAPI {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.server = null;
    this.mailQueue = config.mailQueue;
    this.securityManager = config.securityManager;
    this.analyticsService = config.analyticsService;
    
    // Configure multer for file uploads
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max file size
        files: 10 // Max 10 attachments
      },
      fileFilter: (req, file, cb) => {
        // Allow most common file types, block executables
        const allowedMimes = [
          'text/plain', 'text/html', 'text/csv',
          'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/zip', 'application/x-zip-compressed'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS - Allow requests from QuantumMint services
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          'http://localhost:3000', // Frontend
          'http://localhost:3001', // API Gateway
          'http://localhost:3002', // Auth Service
          'http://localhost:3003', // Transaction Service
          'http://localhost:3004', // Payment Service
          'http://localhost:3005', // KYC Service
          'http://localhost:3006', // Money Generation Service
          ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
        ];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    }));

    // Rate limiting
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many API requests from this IP'
    });

    const emailLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // Limit each IP to 50 emails per minute
      message: 'Email rate limit exceeded'
    });

    this.app.use('/api/', apiLimiter);
    this.app.use('/api/email/send', emailLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('API request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'QuantumMint Mail API',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // API Documentation
    this.app.get('/api/docs', (req, res) => {
      res.json(this.getAPIDocumentation());
    });

    // Authentication middleware for protected routes
    const authenticateAPI = this.authenticateAPIKey.bind(this);

    // Email sending endpoints
    this.app.post('/api/email/send', [
      authenticateAPI,
      body('to').isArray().withMessage('Recipients must be an array'),
      body('subject').notEmpty().withMessage('Subject is required'),
      body('content').notEmpty().withMessage('Content is required'),
      body('from').optional().isEmail().withMessage('From must be valid email')
    ], this.sendEmail.bind(this));

    this.app.post('/api/email/send-template', [
      authenticateAPI,
      body('to').isArray().withMessage('Recipients must be an array'),
      body('template').notEmpty().withMessage('Template name is required'),
      body('data').optional().isObject().withMessage('Template data must be object')
    ], this.sendTemplateEmail.bind(this));

    this.app.post('/api/email/send-bulk', [
      authenticateAPI,
      body('emails').isArray().withMessage('Emails must be an array'),
      body('emails').custom((emails) => {
        if (emails.length > 100) {
          throw new Error('Maximum 100 emails per bulk request');
        }
        return true;
      })
    ], this.sendBulkEmail.bind(this));

    // Email with attachments
    this.app.post('/api/email/send-with-attachments', 
      authenticateAPI,
      this.upload.array('attachments'),
      [
        body('to').isArray().withMessage('Recipients must be an array'),
        body('subject').notEmpty().withMessage('Subject is required'),
        body('content').notEmpty().withMessage('Content is required')
      ],
      this.sendEmailWithAttachments.bind(this)
    );

    // Email status and tracking
    this.app.get('/api/email/:messageId/status', authenticateAPI, this.getEmailStatus.bind(this));
    this.app.get('/api/email/:messageId/tracking', authenticateAPI, this.getEmailTracking.bind(this));

    // Queue management
    this.app.get('/api/queue/status', authenticateAPI, this.getQueueStatus.bind(this));
    this.app.post('/api/queue/retry/:jobId', authenticateAPI, this.retryQueueJob.bind(this));

    // User management (for service integration)
    this.app.post('/api/users/create', [
      authenticateAPI,
      body('email').isEmail().withMessage('Valid email is required'),
      body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
      body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    ], this.createMailUser.bind(this));

    this.app.get('/api/users/:identifier', authenticateAPI, this.getMailUser.bind(this));
    this.app.put('/api/users/:id/quota', [
      authenticateAPI,
      body('quota').isNumeric().withMessage('Quota must be numeric')
    ], this.updateUserQuota.bind(this));

    // Analytics endpoints
    this.app.get('/api/analytics/overview', authenticateAPI, this.getAnalyticsOverview.bind(this));
    this.app.get('/api/analytics/user/:userId', authenticateAPI, this.getUserAnalytics.bind(this));

    // Webhook endpoints for delivery notifications
    this.app.post('/api/webhooks/delivery', this.handleDeliveryWebhook.bind(this));
    this.app.post('/api/webhooks/bounce', this.handleBounceWebhook.bind(this));

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  async sendEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { to, cc, bcc, subject, content, contentType, priority, tags } = req.body;
      const from = req.body.from || req.user.defaultFrom || 'noreply@quantummint.com';

      // Validate recipients
      const allRecipients = [...to, ...(cc || []), ...(bcc || [])];
      if (allRecipients.length === 0) {
        return res.status(400).json({ error: 'At least one recipient is required' });
      }

      if (allRecipients.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 recipients per email' });
      }

      // Check rate limits
      const rateLimitOk = await this.securityManager.checkRateLimit(
        req.user.serviceId, 'email-send'
      );
      if (!rateLimitOk) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // Create email message
      const emailData = {
        from: this.parseEmailAddress(from),
        to: to.map(addr => this.parseEmailAddress(addr)),
        cc: cc ? cc.map(addr => this.parseEmailAddress(addr)) : [],
        bcc: bcc ? bcc.map(addr => this.parseEmailAddress(addr)) : [],
        subject,
        content,
        contentType: contentType || 'text/html',
        priority: priority || 'normal',
        tags: tags || [],
        source: 'api',
        serviceId: req.user.serviceId,
        userId: req.user.userId
      };

      // Queue email for delivery
      const job = await this.mailQueue.addEmail(emailData);

      // Record analytics
      await this.analyticsService?.recordConnection('api', req.ip);

      logger.info('Email queued via API', {
        jobId: job.id,
        serviceId: req.user.serviceId,
        recipients: allRecipients.length,
        subject
      });

      res.status(202).json({
        success: true,
        messageId: job.id,
        status: 'queued',
        recipients: allRecipients.length,
        estimatedDelivery: new Date(Date.now() + 30000) // 30 seconds estimate
      });

    } catch (error) {
      logger.error('Error sending email via API:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  }

  async sendTemplateEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { to, template, data, subject } = req.body;

      // Load email template
      const templateContent = await this.loadEmailTemplate(template, data);
      if (!templateContent) {
        return res.status(400).json({ error: 'Template not found' });
      }

      // Send email using template
      const emailData = {
        to: to.map(addr => this.parseEmailAddress(addr)),
        subject: subject || templateContent.subject,
        content: templateContent.html,
        contentType: 'text/html',
        template,
        templateData: data,
        source: 'api-template',
        serviceId: req.user.serviceId
      };

      const job = await this.mailQueue.addEmail(emailData);

      res.status(202).json({
        success: true,
        messageId: job.id,
        template,
        status: 'queued'
      });

    } catch (error) {
      logger.error('Error sending template email:', error);
      res.status(500).json({ error: 'Failed to send template email' });
    }
  }

  async sendBulkEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { emails } = req.body;
      const jobs = [];

      for (const email of emails) {
        try {
          const emailData = {
            ...email,
            to: email.to.map(addr => this.parseEmailAddress(addr)),
            source: 'api-bulk',
            serviceId: req.user.serviceId
          };

          const job = await this.mailQueue.addEmail(emailData);
          jobs.push({
            messageId: job.id,
            recipients: email.to,
            status: 'queued'
          });

        } catch (error) {
          jobs.push({
            recipients: email.to,
            status: 'failed',
            error: error.message
          });
        }
      }

      logger.info('Bulk emails queued via API', {
        serviceId: req.user.serviceId,
        totalEmails: emails.length,
        successful: jobs.filter(j => j.status === 'queued').length
      });

      res.status(202).json({
        success: true,
        totalEmails: emails.length,
        results: jobs
      });

    } catch (error) {
      logger.error('Error sending bulk emails:', error);
      res.status(500).json({ error: 'Failed to send bulk emails' });
    }
  }

  async sendEmailWithAttachments(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { to, subject, content } = req.body;
      const attachments = req.files || [];

      // Process attachments
      const processedAttachments = attachments.map(file => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
        size: file.size
      }));

      const emailData = {
        to: to.map(addr => this.parseEmailAddress(addr)),
        subject,
        content,
        attachments: processedAttachments,
        source: 'api-attachments',
        serviceId: req.user.serviceId
      };

      const job = await this.mailQueue.addEmail(emailData);

      res.status(202).json({
        success: true,
        messageId: job.id,
        attachments: processedAttachments.length,
        status: 'queued'
      });

    } catch (error) {
      logger.error('Error sending email with attachments:', error);
      res.status(500).json({ error: 'Failed to send email with attachments' });
    }
  }

  async getEmailStatus(req, res) {
    try {
      const { messageId } = req.params;

      // Get job status from queue
      const job = await this.mailQueue.getJob(messageId);
      if (!job) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const status = {
        messageId,
        status: await job.getState(),
        progress: job.progress,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts
      };

      res.json(status);

    } catch (error) {
      logger.error('Error getting email status:', error);
      res.status(500).json({ error: 'Failed to get email status' });
    }
  }

  async getEmailTracking(req, res) {
    try {
      const { messageId } = req.params;

      // Find email in database
      const email = await EmailMessage.findOne({ 
        $or: [
          { messageId },
          { _id: messageId }
        ]
      });

      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }

      const tracking = {
        messageId: email.messageId,
        status: email.deliveryStatus,
        deliveredAt: email.deliveredAt,
        openedAt: email.openedAt,
        clickedAt: email.clickedAt,
        bounceReason: email.bounceReason,
        recipients: email.to.length,
        deliveryAttempts: email.deliveryAttempts || 0
      };

      res.json(tracking);

    } catch (error) {
      logger.error('Error getting email tracking:', error);
      res.status(500).json({ error: 'Failed to get email tracking' });
    }
  }

  async getQueueStatus(req, res) {
    try {
      const stats = await this.mailQueue.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error getting queue status:', error);
      res.status(500).json({ error: 'Failed to get queue status' });
    }
  }

  async retryQueueJob(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await this.mailQueue.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      await job.retry();
      
      res.json({ success: true, message: 'Job retried successfully' });

    } catch (error) {
      logger.error('Error retrying job:', error);
      res.status(500).json({ error: 'Failed to retry job' });
    }
  }

  async createMailUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, username, password, quota } = req.body;

      // Check if user exists
      const existingUser = await MailUser.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Create user
      const user = new MailUser({
        email,
        username,
        password,
        quota: quota || 1024 * 1024 * 1024, // 1GB default
        isActive: true,
        createdBy: req.user.serviceId
      });

      await user.save();

      res.status(201).json({
        id: user._id,
        email: user.email,
        username: user.username,
        quota: user.quota,
        isActive: user.isActive
      });

    } catch (error) {
      logger.error('Error creating mail user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  async getMailUser(req, res) {
    try {
      const { identifier } = req.params;

      const user = await MailUser.findOne({
        $or: [
          { _id: identifier },
          { email: identifier },
          { username: identifier }
        ]
      }).select('-password -passwordResetToken');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);

    } catch (error) {
      logger.error('Error getting mail user:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  async updateUserQuota(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { quota } = req.body;

      const user = await MailUser.findByIdAndUpdate(
        id,
        { quota },
        { new: true }
      ).select('-password -passwordResetToken');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);

    } catch (error) {
      logger.error('Error updating user quota:', error);
      res.status(500).json({ error: 'Failed to update quota' });
    }
  }

  async getAnalyticsOverview(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const overview = await this.analyticsService?.getOverview(startDate) || {};
      res.json(overview);

    } catch (error) {
      logger.error('Error getting analytics overview:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  }

  async getUserAnalytics(req, res) {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days) || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const analytics = await EmailMessage.aggregate([
        {
          $match: {
            userId,
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalEmails: { $sum: 1 },
            totalSize: { $sum: '$size' },
            delivered: {
              $sum: { $cond: [{ $eq: ['$deliveryStatus', 'delivered'] }, 1, 0] }
            },
            bounced: {
              $sum: { $cond: [{ $eq: ['$deliveryStatus', 'bounced'] }, 1, 0] }
            }
          }
        }
      ]);

      res.json(analytics[0] || {
        totalEmails: 0, totalSize: 0, delivered: 0, bounced: 0
      });

    } catch (error) {
      logger.error('Error getting user analytics:', error);
      res.status(500).json({ error: 'Failed to get user analytics' });
    }
  }

  async handleDeliveryWebhook(req, res) {
    try {
      const { messageId, status, timestamp, recipient } = req.body;

      await EmailMessage.findOneAndUpdate(
        { messageId },
        {
          deliveryStatus: status,
          deliveredAt: new Date(timestamp),
          $push: {
            deliveryEvents: {
              event: 'delivered',
              timestamp: new Date(timestamp),
              recipient
            }
          }
        }
      );

      res.json({ success: true });

    } catch (error) {
      logger.error('Error handling delivery webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  async handleBounceWebhook(req, res) {
    try {
      const { messageId, bounceType, bounceReason, timestamp, recipient } = req.body;

      await EmailMessage.findOneAndUpdate(
        { messageId },
        {
          deliveryStatus: 'bounced',
          bounceReason,
          bounceType,
          bouncedAt: new Date(timestamp),
          $push: {
            deliveryEvents: {
              event: 'bounced',
              timestamp: new Date(timestamp),
              recipient,
              reason: bounceReason
            }
          }
        }
      );

      res.json({ success: true });

    } catch (error) {
      logger.error('Error handling bounce webhook:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  }

  authenticateAPIKey(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(apiKey, process.env.JWT_SECRET || 'quantum-mail-secret');
      
      req.user = {
        serviceId: decoded.serviceId,
        serviceName: decoded.serviceName,
        userId: decoded.userId,
        permissions: decoded.permissions || [],
        defaultFrom: decoded.defaultFrom
      };

      next();

    } catch (error) {
      return res.status(403).json({ error: 'Invalid API key' });
    }
  }

  parseEmailAddress(address) {
    if (typeof address === 'string') {
      if (address.includes('<') && address.includes('>')) {
        const match = address.match(/^(.+?)\s*<(.+)>$/);
        return {
          name: match ? match[1].trim().replace(/"/g, '') : '',
          address: match ? match[2].trim() : address
        };
      }
      return { address: address.trim() };
    }
    return address;
  }

  async loadEmailTemplate(templateName, data) {
    // This would load templates from a template engine
    // For now, return a simple template
    const templates = {
      welcome: {
        subject: 'Welcome to QuantumMint',
        html: `<h1>Welcome ${data?.name || 'User'}!</h1><p>Thank you for joining QuantumMint.</p>`
      },
      passwordReset: {
        subject: 'Password Reset Request',
        html: `<h1>Password Reset</h1><p>Click <a href="${data?.resetUrl}">here</a> to reset your password.</p>`
      },
      notification: {
        subject: data?.subject || 'Notification',
        html: `<h1>${data?.title || 'Notification'}</h1><p>${data?.message || ''}</p>`
      }
    };

    return templates[templateName] || null;
  }

  getAPIDocumentation() {
    return {
      name: 'QuantumMint Mail API',
      version: '1.0.0',
      description: 'REST API for sending emails through QuantumMint Mail Server',
      endpoints: {
        'POST /api/email/send': {
          description: 'Send a single email',
          parameters: {
            to: 'array of recipient email addresses',
            subject: 'email subject',
            content: 'email content (HTML or text)',
            cc: 'optional array of CC recipients',
            bcc: 'optional array of BCC recipients',
            contentType: 'optional content type (default: text/html)'
          }
        },
        'POST /api/email/send-template': {
          description: 'Send email using a template',
          parameters: {
            to: 'array of recipient email addresses',
            template: 'template name',
            data: 'template data object'
          }
        },
        'POST /api/email/send-bulk': {
          description: 'Send multiple emails (max 100)',
          parameters: {
            emails: 'array of email objects'
          }
        },
        'GET /api/email/:messageId/status': {
          description: 'Get email delivery status'
        },
        'GET /api/queue/status': {
          description: 'Get mail queue statistics'
        }
      },
      authentication: {
        type: 'Bearer Token',
        header: 'Authorization: Bearer <jwt-token>',
        alternative: 'X-API-Key: <jwt-token>'
      }
    };
  }

  errorHandler(error, req, res, next) {
    logger.error('API error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.message
      });
    }

    if (error.name === 'MulterError') {
      return res.status(400).json({
        error: 'File upload error',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port || 8081, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Mail API server listening on port ${this.config.port || 8081}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Mail API server stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = QuantumEmailAPI;
