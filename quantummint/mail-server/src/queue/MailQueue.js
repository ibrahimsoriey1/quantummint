const Queue = require('bull');
const Redis = require('redis');
const { queue: logger } = require('../utils/logger');
const EmailMessage = require('../models/EmailMessage');
const MailUser = require('../models/MailUser');

class MailQueue {
  constructor(config) {
    this.redisConfig = config.redis;
    this.securityManager = config.securityManager;
    this.analyticsService = config.analyticsService;
    this.queues = {};
    this.processors = {};
    this.redis = null;
    this.initialized = false;
  }

  async start() {
    try {
      // Connect to Redis
      this.redis = Redis.createClient({
        url: this.redisConfig.url,
        db: this.redisConfig.db
      });
      
      await this.redis.connect();
      
      // Initialize queues
      this.initializeQueues();
      
      // Start processors
      this.startProcessors();
      
      this.initialized = true;
      logger.info('Mail Queue system initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Mail Queue:', error);
      throw error;
    }
  }

  initializeQueues() {
    const queueOptions = {
      redis: {
        port: this.redisConfig.port || 6379,
        host: this.redisConfig.host || 'localhost',
        db: this.redisConfig.db || 0
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    };

    // Local delivery queue
    this.queues.localDelivery = new Queue('local-delivery', queueOptions);
    
    // Remote delivery queue
    this.queues.remoteDelivery = new Queue('remote-delivery', queueOptions);
    
    // Bounce processing queue
    this.queues.bounceProcessing = new Queue('bounce-processing', queueOptions);
    
    // Cleanup queue
    this.queues.cleanup = new Queue('cleanup', queueOptions);
    
    // Analytics queue
    this.queues.analytics = new Queue('analytics', queueOptions);

    logger.info('Mail queues initialized');
  }

  startProcessors() {
    // Local delivery processor
    this.queues.localDelivery.process('deliver-local', 10, async (job) => {
      return await this.processLocalDelivery(job.data);
    });

    // Remote delivery processor
    this.queues.remoteDelivery.process('deliver-remote', 5, async (job) => {
      return await this.processRemoteDelivery(job.data);
    });

    // Bounce processor
    this.queues.bounceProcessing.process('process-bounce', 5, async (job) => {
      return await this.processBounce(job.data);
    });

    // Cleanup processor
    this.queues.cleanup.process('cleanup-expired', 1, async (job) => {
      return await this.processCleanup(job.data);
    });

    // Analytics processor
    this.queues.analytics.process('update-analytics', 20, async (job) => {
      return await this.processAnalytics(job.data);
    });

    // Schedule recurring jobs
    this.scheduleRecurringJobs();

    logger.info('Queue processors started');
  }

  scheduleRecurringJobs() {
    // Schedule cleanup every hour
    this.queues.cleanup.add('cleanup-expired', {}, {
      repeat: { cron: '0 * * * *' }, // Every hour
      removeOnComplete: 1,
      removeOnFail: 1
    });

    // Schedule analytics updates every 5 minutes
    this.queues.analytics.add('update-analytics', {}, {
      repeat: { cron: '*/5 * * * *' }, // Every 5 minutes
      removeOnComplete: 1,
      removeOnFail: 1
    });
  }

  async addLocalDelivery(message, senderId = null) {
    try {
      const jobData = {
        messageId: message.messageId,
        message,
        senderId,
        timestamp: new Date()
      };

      const job = await this.queues.localDelivery.add('deliver-local', jobData, {
        priority: this.getMessagePriority(message),
        delay: 0
      });

      logger.info('Local delivery job queued', {
        jobId: job.id,
        messageId: message.messageId,
        recipients: message.to.length
      });

      return job.id;
      
    } catch (error) {
      logger.error('Failed to queue local delivery:', error);
      throw error;
    }
  }

  async addRemoteDelivery(message, senderId = null) {
    try {
      const jobData = {
        messageId: message.messageId,
        message,
        senderId,
        timestamp: new Date()
      };

      const job = await this.queues.remoteDelivery.add('deliver-remote', jobData, {
        priority: this.getMessagePriority(message),
        delay: 0
      });

      logger.info('Remote delivery job queued', {
        jobId: job.id,
        messageId: message.messageId,
        recipients: message.to.length
      });

      return job.id;
      
    } catch (error) {
      logger.error('Failed to queue remote delivery:', error);
      throw error;
    }
  }

  async processLocalDelivery(jobData) {
    const { message, senderId } = jobData;
    
    logger.info('Processing local delivery', {
      messageId: message.messageId,
      recipients: message.to.length
    });

    try {
      const deliveryResults = [];

      for (const recipient of message.to) {
        try {
          const result = await this.deliverToLocalUser(message, recipient, senderId);
          deliveryResults.push(result);
          
        } catch (error) {
          logger.error('Local delivery failed for recipient', {
            messageId: message.messageId,
            recipient: recipient.address,
            error: error.message
          });
          
          deliveryResults.push({
            recipient: recipient.address,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Update message status
      await this.updateMessageStatus(message.messageId, 'delivered', deliveryResults);
      
      // Update analytics
      await this.queues.analytics.add('update-analytics', {
        type: 'delivery',
        messageId: message.messageId,
        results: deliveryResults
      });

      return { status: 'completed', results: deliveryResults };
      
    } catch (error) {
      logger.error('Local delivery processing failed:', error);
      throw error;
    }
  }

  async deliverToLocalUser(message, recipient, senderId) {
    // Find recipient user
    const user = await MailUser.findOne({ email: recipient.address });
    if (!user) {
      // Check aliases
      const aliasOwner = await MailUser.findOne({
        'aliases.alias': recipient.address,
        'aliases.isActive': true
      });
      
      if (!aliasOwner) {
        throw new Error('Recipient not found');
      }
      
      // Deliver to alias owner
      return await this.storeMessage(message, aliasOwner, recipient.address);
    }

    return await this.storeMessage(message, user, recipient.address);
  }

  async storeMessage(message, user, deliveryAddress) {
    // Check quota
    if (user.usedQuota + message.size > user.mailboxQuota) {
      throw new Error('Mailbox quota exceeded');
    }

    // Determine folder based on spam/virus status
    let folder = 'INBOX';
    if (message.spamStatus === 'spam') {
      folder = 'Spam';
    } else if (message.virusStatus === 'infected') {
      folder = 'Quarantine';
    }

    // Apply user's autoresponder if enabled
    if (user.autoresponder.isEnabled) {
      await this.sendAutoresponder(user, message);
    }

    // Create email message document
    const emailMessage = new EmailMessage({
      messageId: message.messageId,
      from: message.from,
      to: [{ address: deliveryAddress }],
      cc: message.cc || [],
      bcc: message.bcc || [],
      subject: message.subject,
      textContent: message.textContent,
      htmlContent: message.htmlContent,
      headers: message.headers,
      attachments: message.attachments || [],
      size: message.size,
      date: message.date,
      receivedAt: new Date(),
      folder,
      userId: user._id,
      mailbox: user.email,
      spamScore: message.spamScore || 0,
      spamStatus: message.spamStatus || 'clean',
      virusStatus: message.virusStatus || 'clean',
      spf: message.spf,
      dkim: message.dkim,
      dmarc: message.dmarc,
      clientInfo: message.clientInfo,
      source: 'smtp'
    });

    await emailMessage.save();

    // Update user quota and statistics
    await user.updateQuota(message.size);
    user.stats.totalEmailsReceived += 1;
    user.lastActivity = new Date();
    await user.save();

    logger.info('Message delivered to local user', {
      messageId: message.messageId,
      recipient: deliveryAddress,
      userId: user._id,
      folder
    });

    return {
      recipient: deliveryAddress,
      status: 'delivered',
      folder,
      messageId: emailMessage._id
    };
  }

  async sendAutoresponder(user, originalMessage) {
    if (!user.autoresponder.isEnabled) return;

    const now = new Date();
    if (user.autoresponder.startDate && now < user.autoresponder.startDate) return;
    if (user.autoresponder.endDate && now > user.autoresponder.endDate) return;

    // Don't respond to autoresponders or mailing lists
    if (originalMessage.headers.get('auto-submitted') || 
        originalMessage.headers.get('list-id') ||
        originalMessage.headers.get('precedence') === 'bulk') {
      return;
    }

    const autoReply = {
      messageId: this.generateMessageId(),
      from: { address: user.email, name: user.displayName || `${user.firstName} ${user.lastName}` },
      to: [originalMessage.from],
      subject: user.autoresponder.subject || `Re: ${originalMessage.subject}`,
      textContent: user.autoresponder.message,
      date: now,
      size: Buffer.byteLength(user.autoresponder.message, 'utf8'),
      headers: new Map([
        ['auto-submitted', 'auto-replied'],
        ['in-reply-to', originalMessage.messageId],
        ['references', originalMessage.messageId]
      ])
    };

    // Queue autoresponder for remote delivery
    await this.addRemoteDelivery(autoReply, user._id);
  }

  async processRemoteDelivery(jobData) {
    const { message, senderId } = jobData;
    
    logger.info('Processing remote delivery', {
      messageId: message.messageId,
      recipients: message.to.length
    });

    try {
      const deliveryResults = [];
      const recipientsByDomain = this.groupRecipientsByDomain(message.to);

      for (const [domain, recipients] of Object.entries(recipientsByDomain)) {
        try {
          const result = await this.deliverToDomain(message, domain, recipients, senderId);
          deliveryResults.push(...result);
          
        } catch (error) {
          logger.error('Remote delivery failed for domain', {
            messageId: message.messageId,
            domain,
            error: error.message
          });
          
          recipients.forEach(recipient => {
            deliveryResults.push({
              recipient: recipient.address,
              status: 'failed',
              error: error.message
            });
          });
        }
      }

      // Update message status
      await this.updateMessageStatus(message.messageId, 'sent', deliveryResults);
      
      return { status: 'completed', results: deliveryResults };
      
    } catch (error) {
      logger.error('Remote delivery processing failed:', error);
      throw error;
    }
  }

  groupRecipientsByDomain(recipients) {
    const groups = {};
    
    for (const recipient of recipients) {
      const domain = recipient.address.split('@')[1];
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(recipient);
    }
    
    return groups;
  }

  async deliverToDomain(message, domain, recipients, senderId) {
    const nodemailer = require('nodemailer');
    
    // Get MX records for domain
    const mxRecords = await this.getMXRecords(domain);
    if (!mxRecords.length) {
      throw new Error(`No MX records found for domain ${domain}`);
    }

    // Try each MX record in order of priority
    for (const mx of mxRecords) {
      try {
        const transporter = nodemailer.createTransporter({
          host: mx.exchange,
          port: 25,
          secure: false,
          requireTLS: true,
          connectionTimeout: 60000,
          greetingTimeout: 30000,
          socketTimeout: 60000
        });

        const mailOptions = {
          from: message.from.address,
          to: recipients.map(r => r.address),
          subject: message.subject,
          text: message.textContent,
          html: message.htmlContent,
          messageId: message.messageId,
          date: message.date,
          attachments: message.attachments
        };

        const info = await transporter.sendMail(mailOptions);
        
        return recipients.map(recipient => ({
          recipient: recipient.address,
          status: 'sent',
          messageId: info.messageId,
          response: info.response
        }));
        
      } catch (error) {
        logger.warn(`Failed to deliver to MX ${mx.exchange}:`, error.message);
        continue;
      }
    }
    
    throw new Error(`Failed to deliver to any MX server for domain ${domain}`);
  }

  async getMXRecords(domain) {
    const dns = require('dns').promises;
    
    try {
      const records = await dns.resolveMx(domain);
      return records.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error(`Failed to resolve MX records for ${domain}:`, error);
      return [];
    }
  }

  async processBounce(jobData) {
    const { bounceData } = jobData;
    
    logger.info('Processing bounce', { bounceData });

    try {
      // Parse bounce message
      const bounceInfo = await this.parseBounceMessage(bounceData);
      
      // Find original message
      const originalMessage = await EmailMessage.findByMessageId(bounceInfo.originalMessageId);
      if (originalMessage) {
        await originalMessage.setBounce(
          bounceInfo.bounceType,
          bounceInfo.reason,
          bounceInfo.details
        );
      }

      // Update sender statistics
      if (bounceInfo.senderEmail) {
        const sender = await MailUser.findOne({ email: bounceInfo.senderEmail });
        if (sender) {
          sender.stats.bounces = (sender.stats.bounces || 0) + 1;
          await sender.save();
        }
      }

      return { status: 'processed', bounceInfo };
      
    } catch (error) {
      logger.error('Bounce processing failed:', error);
      throw error;
    }
  }

  async parseBounceMessage(bounceData) {
    // Simplified bounce parsing - in production, use a proper bounce parser
    return {
      bounceType: bounceData.bounceType || 'hard',
      reason: bounceData.reason || 'Unknown',
      details: bounceData.details || '',
      originalMessageId: bounceData.originalMessageId,
      senderEmail: bounceData.senderEmail,
      recipientEmail: bounceData.recipientEmail
    };
  }

  async processCleanup(jobData) {
    logger.info('Processing cleanup job');

    try {
      // Clean up expired messages
      const expiredCount = await EmailMessage.cleanupExpired();
      
      // Clean up old queue jobs
      await this.cleanupOldJobs();
      
      logger.info('Cleanup completed', { expiredMessages: expiredCount });
      
      return { status: 'completed', expiredMessages: expiredCount };
      
    } catch (error) {
      logger.error('Cleanup processing failed:', error);
      throw error;
    }
  }

  async cleanupOldJobs() {
    const queues = Object.values(this.queues);
    
    for (const queue of queues) {
      await queue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24 hours
      await queue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
    }
  }

  async processAnalytics(jobData) {
    // Analytics processing would be handled by AnalyticsService
    // This is just a placeholder
    logger.debug('Processing analytics update', jobData);
    return { status: 'processed' };
  }

  async updateMessageStatus(messageId, status, results = []) {
    try {
      const message = await EmailMessage.findByMessageId(messageId);
      if (message) {
        await message.updateDeliveryStatus(status);
      }
    } catch (error) {
      logger.error('Failed to update message status:', error);
    }
  }

  getMessagePriority(message) {
    if (message.priority === 'high') return 1;
    if (message.priority === 'low') return 3;
    return 2; // normal
  }

  generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `<${timestamp}.${random}@quantummint.com>`;
  }

  async getQueueStats() {
    const stats = {};
    
    for (const [name, queue] of Object.entries(this.queues)) {
      stats[name] = {
        waiting: await queue.getWaiting().then(jobs => jobs.length),
        active: await queue.getActive().then(jobs => jobs.length),
        completed: await queue.getCompleted().then(jobs => jobs.length),
        failed: await queue.getFailed().then(jobs => jobs.length),
        delayed: await queue.getDelayed().then(jobs => jobs.length)
      };
    }
    
    return stats;
  }

  async close() {
    try {
      // Close all queues
      const closePromises = Object.values(this.queues).map(queue => queue.close());
      await Promise.all(closePromises);
      
      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
      }
      
      logger.info('Mail Queue system closed');
      
    } catch (error) {
      logger.error('Error closing Mail Queue system:', error);
      throw error;
    }
  }
}

module.exports = MailQueue;
