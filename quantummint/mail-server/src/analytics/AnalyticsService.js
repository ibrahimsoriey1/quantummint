const { analytics: logger } = require('../utils/logger');
const MailUser = require('../models/MailUser');
const EmailMessage = require('../models/EmailMessage');

class QuantumAnalyticsService {
  constructor(config) {
    this.config = config;
    this.redis = config.redis;
    this.metrics = new Map();
    this.isRunning = false;
    
    // Metric collection intervals
    this.intervals = {
      realtime: null,
      hourly: null,
      daily: null
    };
  }

  async start() {
    try {
      this.isRunning = true;
      
      // Start metric collection intervals
      this.startRealtimeCollection();
      this.startHourlyCollection();
      this.startDailyCollection();
      
      logger.info('Analytics service started');
      
    } catch (error) {
      logger.error('Failed to start analytics service:', error);
      throw error;
    }
  }

  async stop() {
    try {
      this.isRunning = false;
      
      // Clear all intervals
      if (this.intervals.realtime) clearInterval(this.intervals.realtime);
      if (this.intervals.hourly) clearInterval(this.intervals.hourly);
      if (this.intervals.daily) clearInterval(this.intervals.daily);
      
      logger.info('Analytics service stopped');
      
    } catch (error) {
      logger.error('Error stopping analytics service:', error);
      throw error;
    }
  }

  startRealtimeCollection() {
    // Collect real-time metrics every 30 seconds
    this.intervals.realtime = setInterval(async () => {
      try {
        await this.collectRealtimeMetrics();
      } catch (error) {
        logger.error('Error collecting real-time metrics:', error);
      }
    }, 30 * 1000);
  }

  startHourlyCollection() {
    // Collect hourly metrics every hour
    this.intervals.hourly = setInterval(async () => {
      try {
        await this.collectHourlyMetrics();
      } catch (error) {
        logger.error('Error collecting hourly metrics:', error);
      }
    }, 60 * 60 * 1000);
  }

  startDailyCollection() {
    // Collect daily metrics at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.collectDailyMetrics();
      
      // Then collect daily metrics every 24 hours
      this.intervals.daily = setInterval(async () => {
        try {
          await this.collectDailyMetrics();
        } catch (error) {
          logger.error('Error collecting daily metrics:', error);
        }
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  async collectRealtimeMetrics() {
    const timestamp = new Date();
    const metrics = {
      timestamp,
      connections: {
        smtp: this.getConnectionCount('smtp'),
        imap: this.getConnectionCount('imap'),
        pop3: this.getConnectionCount('pop3'),
        web: this.getConnectionCount('web')
      },
      queue: await this.getQueueMetrics(),
      system: await this.getSystemMetrics()
    };

    await this.storeMetrics('realtime', metrics);
    this.metrics.set('latest', metrics);
  }

  async collectHourlyMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

    const metrics = {
      timestamp: endTime,
      period: 'hourly',
      emails: await this.getEmailMetrics(startTime, endTime),
      users: await this.getUserMetrics(startTime, endTime),
      security: await this.getSecurityMetrics(startTime, endTime),
      performance: await this.getPerformanceMetrics(startTime, endTime)
    };

    await this.storeMetrics('hourly', metrics);
    logger.debug('Hourly metrics collected', { timestamp: endTime });
  }

  async collectDailyMetrics() {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    const metrics = {
      timestamp: endTime,
      period: 'daily',
      emails: await this.getEmailMetrics(startTime, endTime),
      users: await this.getUserMetrics(startTime, endTime),
      security: await this.getSecurityMetrics(startTime, endTime),
      performance: await this.getPerformanceMetrics(startTime, endTime),
      storage: await this.getStorageMetrics(),
      summary: await this.getDailySummary(startTime, endTime)
    };

    await this.storeMetrics('daily', metrics);
    logger.info('Daily metrics collected', { 
      timestamp: endTime,
      emailsProcessed: metrics.emails.total,
      activeUsers: metrics.users.active
    });
  }

  async getEmailMetrics(startTime, endTime) {
    try {
      const pipeline = [
        {
          $match: {
            date: { $gte: startTime, $lte: endTime }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalSize: { $sum: '$size' },
            spam: {
              $sum: {
                $cond: [{ $gt: ['$spamScore', 5] }, 1, 0]
              }
            },
            virus: {
              $sum: {
                $cond: [{ $eq: ['$virusStatus', 'infected'] }, 1, 0]
              }
            },
            bounced: {
              $sum: {
                $cond: [{ $in: ['bounced', '$flags'] }, 1, 0]
              }
            },
            delivered: {
              $sum: {
                $cond: [{ $in: ['delivered', '$flags'] }, 1, 0]
              }
            }
          }
        }
      ];

      const result = await EmailMessage.aggregate(pipeline);
      const data = result[0] || {};

      // Get folder distribution
      const folderPipeline = [
        {
          $match: {
            date: { $gte: startTime, $lte: endTime }
          }
        },
        {
          $group: {
            _id: '$folder',
            count: { $sum: 1 }
          }
        }
      ];

      const folderData = await EmailMessage.aggregate(folderPipeline);
      const folders = {};
      folderData.forEach(item => {
        folders[item._id] = item.count;
      });

      return {
        total: data.total || 0,
        totalSize: data.totalSize || 0,
        spam: data.spam || 0,
        virus: data.virus || 0,
        bounced: data.bounced || 0,
        delivered: data.delivered || 0,
        folders,
        averageSize: data.total ? Math.round(data.totalSize / data.total) : 0,
        spamRate: data.total ? Math.round((data.spam / data.total) * 100) : 0,
        virusRate: data.total ? Math.round((data.virus / data.total) * 100) : 0,
        deliveryRate: data.total ? Math.round((data.delivered / data.total) * 100) : 0
      };

    } catch (error) {
      logger.error('Error getting email metrics:', error);
      return {
        total: 0, totalSize: 0, spam: 0, virus: 0, bounced: 0, delivered: 0,
        folders: {}, averageSize: 0, spamRate: 0, virusRate: 0, deliveryRate: 0
      };
    }
  }

  async getUserMetrics(startTime, endTime) {
    try {
      const totalUsers = await MailUser.countDocuments();
      const activeUsers = await MailUser.countDocuments({ isActive: true });
      const newUsers = await MailUser.countDocuments({
        createdAt: { $gte: startTime, $lte: endTime }
      });
      const recentLogins = await MailUser.countDocuments({
        lastLogin: { $gte: startTime, $lte: endTime }
      });

      // Get quota usage
      const quotaPipeline = [
        {
          $group: {
            _id: null,
            totalQuota: { $sum: '$quota' },
            totalUsed: { $sum: '$quotaUsed' },
            avgQuota: { $avg: '$quota' },
            avgUsed: { $avg: '$quotaUsed' }
          }
        }
      ];

      const quotaResult = await MailUser.aggregate(quotaPipeline);
      const quotaData = quotaResult[0] || {};

      return {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        new: newUsers,
        recentLogins,
        quota: {
          total: quotaData.totalQuota || 0,
          used: quotaData.totalUsed || 0,
          average: quotaData.avgQuota || 0,
          averageUsed: quotaData.avgUsed || 0,
          usageRate: quotaData.totalQuota ? 
            Math.round((quotaData.totalUsed / quotaData.totalQuota) * 100) : 0
        }
      };

    } catch (error) {
      logger.error('Error getting user metrics:', error);
      return {
        total: 0, active: 0, inactive: 0, new: 0, recentLogins: 0,
        quota: { total: 0, used: 0, average: 0, averageUsed: 0, usageRate: 0 }
      };
    }
  }

  async getSecurityMetrics(startTime, endTime) {
    try {
      // Get security events from Redis if available
      let securityEvents = {
        blockedIPs: 0,
        rateLimited: 0,
        authFailures: 0,
        spfFailures: 0,
        dkimFailures: 0,
        dmarcFailures: 0
      };

      if (this.redis) {
        try {
          const events = await this.redis.hgetall('security:events');
          securityEvents = { ...securityEvents, ...events };
        } catch (error) {
          logger.warn('Could not retrieve security events from Redis:', error);
        }
      }

      return {
        ...securityEvents,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Error getting security metrics:', error);
      return {
        blockedIPs: 0, rateLimited: 0, authFailures: 0,
        spfFailures: 0, dkimFailures: 0, dmarcFailures: 0
      };
    }
  }

  async getPerformanceMetrics(startTime, endTime) {
    try {
      // Get performance data from Redis if available
      let performance = {
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        throughput: 0,
        errorRate: 0
      };

      if (this.redis) {
        try {
          const perfData = await this.redis.hgetall('performance:metrics');
          performance = { ...performance, ...perfData };
        } catch (error) {
          logger.warn('Could not retrieve performance metrics from Redis:', error);
        }
      }

      return {
        ...performance,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      return {
        avgResponseTime: 0, maxResponseTime: 0, minResponseTime: 0,
        throughput: 0, errorRate: 0
      };
    }
  }

  async getStorageMetrics() {
    try {
      const pipeline = [
        {
          $group: {
            _id: null,
            totalEmails: { $sum: 1 },
            totalSize: { $sum: '$size' },
            avgSize: { $avg: '$size' },
            maxSize: { $max: '$size' },
            minSize: { $min: '$size' }
          }
        }
      ];

      const result = await EmailMessage.aggregate(pipeline);
      const data = result[0] || {};

      return {
        totalEmails: data.totalEmails || 0,
        totalSize: data.totalSize || 0,
        averageSize: data.avgSize || 0,
        maxSize: data.maxSize || 0,
        minSize: data.minSize || 0,
        sizePerEmail: data.totalEmails ? 
          Math.round(data.totalSize / data.totalEmails) : 0
      };

    } catch (error) {
      logger.error('Error getting storage metrics:', error);
      return {
        totalEmails: 0, totalSize: 0, averageSize: 0,
        maxSize: 0, minSize: 0, sizePerEmail: 0
      };
    }
  }

  async getDailySummary(startTime, endTime) {
    try {
      const emailMetrics = await this.getEmailMetrics(startTime, endTime);
      const userMetrics = await this.getUserMetrics(startTime, endTime);

      return {
        emailsProcessed: emailMetrics.total,
        spamBlocked: emailMetrics.spam,
        virusBlocked: emailMetrics.virus,
        activeUsers: userMetrics.active,
        newUsers: userMetrics.new,
        storageUsed: emailMetrics.totalSize,
        topIssues: await this.getTopIssues(startTime, endTime)
      };

    } catch (error) {
      logger.error('Error getting daily summary:', error);
      return {
        emailsProcessed: 0, spamBlocked: 0, virusBlocked: 0,
        activeUsers: 0, newUsers: 0, storageUsed: 0, topIssues: []
      };
    }
  }

  async getTopIssues(startTime, endTime) {
    // This would analyze logs and identify top issues
    // For now, return placeholder data
    return [
      { issue: 'High spam rate', count: 0, severity: 'medium' },
      { issue: 'Authentication failures', count: 0, severity: 'low' },
      { issue: 'Queue backlog', count: 0, severity: 'low' }
    ];
  }

  async getQueueMetrics() {
    try {
      // This would integrate with the mail queue to get current stats
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      };
    } catch (error) {
      logger.error('Error getting queue metrics:', error);
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }

  async getSystemMetrics() {
    try {
      const memUsage = process.memoryUsage();
      return {
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external
        },
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      return {
        memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
        uptime: 0, cpu: { user: 0, system: 0 }
      };
    }
  }

  getConnectionCount(service) {
    // This would track active connections per service
    return 0;
  }

  async storeMetrics(type, metrics) {
    if (!this.redis) return;

    try {
      const key = `metrics:${type}:${Date.now()}`;
      await this.redis.setex(key, 86400 * 7, JSON.stringify(metrics)); // Keep for 7 days
      
      // Also store in a sorted set for easy retrieval
      await this.redis.zadd(`metrics:${type}:index`, Date.now(), key);
      
    } catch (error) {
      logger.error('Error storing metrics:', error);
    }
  }

  async getMetrics(type, startTime, endTime, limit = 100) {
    if (!this.redis) return [];

    try {
      const start = startTime ? startTime.getTime() : 0;
      const end = endTime ? endTime.getTime() : Date.now();
      
      const keys = await this.redis.zrangebyscore(
        `metrics:${type}:index`, start, end, 'LIMIT', 0, limit
      );
      
      const metrics = [];
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          metrics.push(JSON.parse(data));
        }
      }
      
      return metrics;
      
    } catch (error) {
      logger.error('Error retrieving metrics:', error);
      return [];
    }
  }

  async getOverview(startTime) {
    try {
      const endTime = new Date();
      const emailMetrics = await this.getEmailMetrics(startTime, endTime);
      const userMetrics = await this.getUserMetrics(startTime, endTime);
      const securityMetrics = await this.getSecurityMetrics(startTime, endTime);

      return {
        emails: emailMetrics,
        users: userMetrics,
        security: securityMetrics,
        timestamp: endTime
      };

    } catch (error) {
      logger.error('Error getting analytics overview:', error);
      return {};
    }
  }

  async getTrafficData(startTime) {
    try {
      const metrics = await this.getMetrics('hourly', startTime, new Date());
      
      return {
        hourlyTraffic: metrics.map(m => ({
          timestamp: m.timestamp,
          emails: m.emails?.total || 0,
          connections: m.connections || {},
          performance: m.performance || {}
        })),
        summary: {
          totalEmails: metrics.reduce((sum, m) => sum + (m.emails?.total || 0), 0),
          avgResponseTime: metrics.length ? 
            metrics.reduce((sum, m) => sum + (m.performance?.avgResponseTime || 0), 0) / metrics.length : 0
        }
      };

    } catch (error) {
      logger.error('Error getting traffic data:', error);
      return { hourlyTraffic: [], summary: { totalEmails: 0, avgResponseTime: 0 } };
    }
  }

  // Event recording methods for external components
  async recordConnection(service, clientIP) {
    try {
      if (this.redis) {
        await this.redis.incr(`connections:${service}:${clientIP}`);
        await this.redis.expire(`connections:${service}:${clientIP}`, 300); // 5 minutes
      }
    } catch (error) {
      logger.error('Error recording connection:', error);
    }
  }

  async recordConnectionClosed(clientIP) {
    // Implementation for connection close tracking
  }

  async recordError(service, errorType) {
    try {
      if (this.redis) {
        await this.redis.incr(`errors:${service}:${errorType}`);
        await this.redis.expire(`errors:${service}:${errorType}`, 3600); // 1 hour
      }
    } catch (error) {
      logger.error('Error recording error:', error);
    }
  }

  async recordSecurityEvent(eventType, details) {
    try {
      if (this.redis) {
        await this.redis.hincrby('security:events', eventType, 1);
        await this.redis.expire('security:events', 86400); // 24 hours
      }
    } catch (error) {
      logger.error('Error recording security event:', error);
    }
  }

  async recordPerformance(service, responseTime) {
    try {
      if (this.redis) {
        const key = `performance:${service}`;
        await this.redis.lpush(key, responseTime);
        await this.redis.ltrim(key, 0, 999); // Keep last 1000 measurements
        await this.redis.expire(key, 3600); // 1 hour
      }
    } catch (error) {
      logger.error('Error recording performance:', error);
    }
  }
}

module.exports = QuantumAnalyticsService;
