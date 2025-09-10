const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { web: logger } = require('../utils/logger');
const MailUser = require('../models/MailUser');
const EmailMessage = require('../models/EmailMessage');

class QuantumMailWebInterface {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.server = null;
    this.securityManager = config.securityManager;
    this.analyticsService = config.analyticsService;
    this.mailQueue = config.mailQueue;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
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
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Web request', {
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
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Authentication routes
    this.app.post('/api/auth/login', [
      body('username').notEmpty().withMessage('Username is required'),
      body('password').notEmpty().withMessage('Password is required')
    ], this.handleLogin.bind(this));

    this.app.post('/api/auth/logout', this.authenticateToken.bind(this), this.handleLogout.bind(this));

    // Dashboard routes
    this.app.get('/api/dashboard/stats', this.authenticateToken.bind(this), this.getDashboardStats.bind(this));
    this.app.get('/api/dashboard/recent-activity', this.authenticateToken.bind(this), this.getRecentActivity.bind(this));

    // User management routes
    this.app.get('/api/users', this.authenticateToken.bind(this), this.getUsers.bind(this));
    this.app.post('/api/users', [
      body('email').isEmail().withMessage('Valid email is required'),
      body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
      body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    ], this.authenticateToken.bind(this), this.createUser.bind(this));
    this.app.put('/api/users/:id', this.authenticateToken.bind(this), this.updateUser.bind(this));
    this.app.delete('/api/users/:id', this.authenticateToken.bind(this), this.deleteUser.bind(this));

    // Email management routes
    this.app.get('/api/emails', this.authenticateToken.bind(this), this.getEmails.bind(this));
    this.app.get('/api/emails/:id', this.authenticateToken.bind(this), this.getEmail.bind(this));
    this.app.delete('/api/emails/:id', this.authenticateToken.bind(this), this.deleteEmail.bind(this));

    // Queue management routes
    this.app.get('/api/queue/stats', this.authenticateToken.bind(this), this.getQueueStats.bind(this));
    this.app.get('/api/queue/jobs', this.authenticateToken.bind(this), this.getQueueJobs.bind(this));
    this.app.post('/api/queue/retry/:jobId', this.authenticateToken.bind(this), this.retryJob.bind(this));
    this.app.delete('/api/queue/jobs/:jobId', this.authenticateToken.bind(this), this.removeJob.bind(this));

    // Analytics routes
    this.app.get('/api/analytics/overview', this.authenticateToken.bind(this), this.getAnalyticsOverview.bind(this));
    this.app.get('/api/analytics/traffic', this.authenticateToken.bind(this), this.getTrafficAnalytics.bind(this));
    this.app.get('/api/analytics/security', this.authenticateToken.bind(this), this.getSecurityAnalytics.bind(this));

    // System configuration routes
    this.app.get('/api/config', this.authenticateToken.bind(this), this.getConfig.bind(this));
    this.app.put('/api/config', this.authenticateToken.bind(this), this.updateConfig.bind(this));

    // Serve main application
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  async handleLogin(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Check rate limiting
      const rateLimitOk = await this.securityManager.checkRateLimit(req.ip, 'web-login');
      if (!rateLimitOk) {
        return res.status(429).json({ error: 'Too many login attempts' });
      }

      // Find user
      const user = await MailUser.findByEmailOrUsername(username);
      if (!user || !user.isActive || user.isLocked) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user has admin privileges
      if (!user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        await user.incLoginAttempts();
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Reset login attempts and update last login
      await user.resetLoginAttempts();
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username, isAdmin: user.isAdmin },
        process.env.JWT_SECRET || 'quantum-mail-secret',
        { expiresIn: '8h' }
      );

      logger.info('Admin login successful', {
        userId: user._id,
        username: user.username,
        ip: req.ip
      });

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleLogout(req, res) {
    // In a production environment, you might want to blacklist the token
    logger.info('Admin logout', {
      userId: req.user.userId,
      username: req.user.username,
      ip: req.ip
    });

    res.json({ message: 'Logged out successfully' });
  }

  async getDashboardStats(req, res) {
    try {
      const stats = await Promise.all([
        MailUser.countDocuments({ isActive: true }),
        EmailMessage.countDocuments(),
        EmailMessage.countDocuments({ date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        this.getQueueStatsData()
      ]);

      res.json({
        totalUsers: stats[0],
        totalEmails: stats[1],
        emailsToday: stats[2],
        queueStats: stats[3]
      });

    } catch (error) {
      logger.error('Error getting dashboard stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getRecentActivity(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      const recentEmails = await EmailMessage.find()
        .sort({ date: -1 })
        .limit(limit)
        .populate('userId', 'username email')
        .select('subject from to date size folder flags');

      res.json(recentEmails);

    } catch (error) {
      logger.error('Error getting recent activity:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const users = await MailUser.find()
        .select('-password -passwordResetToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await MailUser.countDocuments();

      res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error getting users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, username, password, quota, isAdmin } = req.body;

      // Check if user already exists
      const existingUser = await MailUser.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Create new user
      const user = new MailUser({
        email,
        username,
        password,
        quota: quota || 1024 * 1024 * 1024, // 1GB default
        isAdmin: isAdmin || false,
        isActive: true
      });

      await user.save();

      logger.info('User created via web interface', {
        userId: user._id,
        username: user.username,
        createdBy: req.user.userId
      });

      res.status(201).json({
        id: user._id,
        email: user.email,
        username: user.username,
        quota: user.quota,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        createdAt: user.createdAt
      });

    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Remove sensitive fields that shouldn't be updated directly
      delete updates.password;
      delete updates._id;
      delete updates.__v;

      const user = await MailUser.findByIdAndUpdate(
        id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -passwordResetToken');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('User updated via web interface', {
        userId: user._id,
        updatedBy: req.user.userId
      });

      res.json(user);

    } catch (error) {
      logger.error('Error updating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Don't allow deleting self
      if (id === req.user.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const user = await MailUser.findByIdAndDelete(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Also delete user's emails
      await EmailMessage.deleteMany({ userId: id });

      logger.info('User deleted via web interface', {
        userId: id,
        deletedBy: req.user.userId
      });

      res.json({ message: 'User deleted successfully' });

    } catch (error) {
      logger.error('Error deleting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getEmails(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      const userId = req.query.userId;
      const folder = req.query.folder;

      const query = {};
      if (userId) query.userId = userId;
      if (folder) query.folder = folder;

      const emails = await EmailMessage.find(query)
        .populate('userId', 'username email')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .select('subject from to date size folder flags spamScore virusStatus');

      const total = await EmailMessage.countDocuments(query);

      res.json({
        emails,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error getting emails:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getEmail(req, res) {
    try {
      const { id } = req.params;

      const email = await EmailMessage.findById(id)
        .populate('userId', 'username email');

      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }

      res.json(email);

    } catch (error) {
      logger.error('Error getting email:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteEmail(req, res) {
    try {
      const { id } = req.params;

      const email = await EmailMessage.findByIdAndDelete(id);
      if (!email) {
        return res.status(404).json({ error: 'Email not found' });
      }

      logger.info('Email deleted via web interface', {
        emailId: id,
        deletedBy: req.user.userId
      });

      res.json({ message: 'Email deleted successfully' });

    } catch (error) {
      logger.error('Error deleting email:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getQueueStats(req, res) {
    try {
      const stats = await this.getQueueStatsData();
      res.json(stats);
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getQueueStatsData() {
    if (!this.mailQueue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.mailQueue.getWaiting(),
        this.mailQueue.getActive(),
        this.mailQueue.getCompleted(),
        this.mailQueue.getFailed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      };
    } catch (error) {
      logger.error('Error getting queue stats data:', error);
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }
  }

  async getQueueJobs(req, res) {
    try {
      const type = req.query.type || 'waiting';
      const limit = parseInt(req.query.limit) || 50;

      if (!this.mailQueue) {
        return res.json([]);
      }

      let jobs = [];
      switch (type) {
        case 'waiting':
          jobs = await this.mailQueue.getWaiting(0, limit);
          break;
        case 'active':
          jobs = await this.mailQueue.getActive(0, limit);
          break;
        case 'completed':
          jobs = await this.mailQueue.getCompleted(0, limit);
          break;
        case 'failed':
          jobs = await this.mailQueue.getFailed(0, limit);
          break;
      }

      res.json(jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason
      })));

    } catch (error) {
      logger.error('Error getting queue jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async retryJob(req, res) {
    try {
      const { jobId } = req.params;

      if (!this.mailQueue) {
        return res.status(400).json({ error: 'Queue not available' });
      }

      const job = await this.mailQueue.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      await job.retry();

      logger.info('Job retried via web interface', {
        jobId,
        retriedBy: req.user.userId
      });

      res.json({ message: 'Job retried successfully' });

    } catch (error) {
      logger.error('Error retrying job:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async removeJob(req, res) {
    try {
      const { jobId } = req.params;

      if (!this.mailQueue) {
        return res.status(400).json({ error: 'Queue not available' });
      }

      const job = await this.mailQueue.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      await job.remove();

      logger.info('Job removed via web interface', {
        jobId,
        removedBy: req.user.userId
      });

      res.json({ message: 'Job removed successfully' });

    } catch (error) {
      logger.error('Error removing job:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getAnalyticsOverview(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const analytics = await this.analyticsService?.getOverview(startDate) || {};
      res.json(analytics);

    } catch (error) {
      logger.error('Error getting analytics overview:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getTrafficAnalytics(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const traffic = await this.analyticsService?.getTrafficData(startDate) || {};
      res.json(traffic);

    } catch (error) {
      logger.error('Error getting traffic analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getSecurityAnalytics(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const security = await this.securityManager?.getSecurityStats(startDate) || {};
      res.json(security);

    } catch (error) {
      logger.error('Error getting security analytics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getConfig(req, res) {
    try {
      // Return safe configuration (no secrets)
      const config = {
        smtp: {
          port: this.config.smtp?.port,
          securePort: this.config.smtp?.securePort,
          submissionPort: this.config.smtp?.submissionPort
        },
        imap: {
          port: this.config.imap?.port,
          securePort: this.config.imap?.securePort
        },
        pop3: {
          port: this.config.pop3?.port,
          securePort: this.config.pop3?.securePort
        },
        security: {
          enableSpf: this.config.security?.enableSpf,
          enableDkim: this.config.security?.enableDkim,
          enableDmarc: this.config.security?.enableDmarc,
          enableAntiSpam: this.config.security?.enableAntiSpam,
          enableAntiVirus: this.config.security?.enableAntiVirus
        }
      };

      res.json(config);

    } catch (error) {
      logger.error('Error getting config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateConfig(req, res) {
    try {
      // In a real implementation, you would update the configuration
      // and possibly restart services as needed
      logger.info('Configuration update requested', {
        updatedBy: req.user.userId,
        changes: req.body
      });

      res.json({ message: 'Configuration updated successfully' });

    } catch (error) {
      logger.error('Error updating config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'quantum-mail-secret', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      if (!user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.user = user;
      next();
    });
  }

  errorHandler(error, req, res, next) {
    logger.error('Web interface error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.config.port || 8080, (err) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`Mail server web interface listening on port ${this.config.port || 8080}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Web interface stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = QuantumMailWebInterface;
