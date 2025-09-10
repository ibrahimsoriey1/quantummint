const Redis = require('redis');
const { audit: logger } = require('../utils/logger');

class AuditService {
  constructor(config) {
    this.config = config;
    this.redis = null;
    this.enableAuditing = config.enableAuditing !== false;
    this.retentionDays = config.retentionDays || 90;
    this.isRunning = false;
    
    // Event categories for filtering and reporting
    this.eventCategories = {
      AUTHENTICATION: ['LDAP_BIND_SUCCESS', 'LDAP_BIND_FAILURE', 'KERBEROS_AS_SUCCESS', 'KERBEROS_AS_FAILURE'],
      DIRECTORY_CHANGES: ['LDAP_ADD', 'LDAP_MODIFY', 'LDAP_DELETE'],
      SECURITY: ['SECURITY_ROLE_CREATED', 'SECURITY_ROLE_DELETED', 'SECURITY_ROLE_ASSIGNED'],
      SYSTEM: ['SERVICE_START', 'SERVICE_STOP', 'CONFIGURATION_CHANGE']
    };
  }

  async start() {
    try {
      if (!this.enableAuditing) {
        logger.info('Auditing is disabled');
        return;
      }

      // Connect to Redis for audit log storage
      this.redis = Redis.createClient({
        url: this.config.redis.url,
        db: this.config.redis.db || 2 // Use separate DB for audit logs
      });
      
      await this.redis.connect();
      
      // Start cleanup task
      this.startCleanupTask();
      
      this.isRunning = true;
      logger.info('Audit Service started successfully');
      
    } catch (error) {
      logger.error('Failed to start Audit Service:', error);
      throw error;
    }
  }

  async logEvent(event) {
    if (!this.enableAuditing || !this.redis) {
      return;
    }

    try {
      const auditEntry = {
        id: this.generateEventId(),
        timestamp: event.timestamp || new Date(),
        type: event.type,
        category: this.getCategoryForEvent(event.type),
        user: event.user || 'system',
        ip: event.ip || 'localhost',
        details: {
          ...event
        },
        severity: this.getSeverityForEvent(event.type)
      };

      // Store in Redis with expiration
      const key = `audit:${auditEntry.timestamp.getFullYear()}:${auditEntry.timestamp.getMonth() + 1}:${auditEntry.id}`;
      const ttl = this.retentionDays * 24 * 60 * 60; // Convert days to seconds
      
      await this.redis.setEx(key, ttl, JSON.stringify(auditEntry));
      
      // Add to daily index for efficient querying
      const dayKey = `audit:index:${this.formatDate(auditEntry.timestamp)}`;
      await this.redis.sAdd(dayKey, auditEntry.id);
      await this.redis.expire(dayKey, ttl);
      
      // Add to category index
      const categoryKey = `audit:category:${auditEntry.category}`;
      await this.redis.sAdd(categoryKey, auditEntry.id);
      
      // Add to user index
      if (auditEntry.user !== 'system') {
        const userKey = `audit:user:${auditEntry.user}`;
        await this.redis.sAdd(userKey, auditEntry.id);
      }
      
      // Log high-severity events immediately
      if (auditEntry.severity === 'HIGH' || auditEntry.severity === 'CRITICAL') {
        logger.warn('High-severity audit event', auditEntry);
      }
      
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  async getEvents(options = {}) {
    if (!this.redis) {
      return [];
    }

    try {
      const {
        startDate,
        endDate,
        category,
        user,
        eventType,
        severity,
        limit = 100,
        offset = 0
      } = options;

      let eventIds = new Set();
      
      // Get events by date range
      if (startDate || endDate) {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const end = endDate || new Date();
        
        const dateKeys = this.getDateRange(start, end).map(date => `audit:index:${this.formatDate(date)}`);
        
        for (const dateKey of dateKeys) {
          const dayEvents = await this.redis.sMembers(dateKey);
          dayEvents.forEach(id => eventIds.add(id));
        }
      } else {
        // Get recent events if no date range specified
        const recentKey = `audit:index:${this.formatDate(new Date())}`;
        const recentEvents = await this.redis.sMembers(recentKey);
        recentEvents.forEach(id => eventIds.add(id));
      }
      
      // Filter by category
      if (category) {
        const categoryKey = `audit:category:${category}`;
        const categoryEvents = await this.redis.sMembers(categoryKey);
        eventIds = new Set([...eventIds].filter(id => categoryEvents.includes(id)));
      }
      
      // Filter by user
      if (user) {
        const userKey = `audit:user:${user}`;
        const userEvents = await this.redis.sMembers(userKey);
        eventIds = new Set([...eventIds].filter(id => userEvents.includes(id)));
      }
      
      // Get event details
      const events = [];
      const eventIdArray = Array.from(eventIds).slice(offset, offset + limit);
      
      for (const eventId of eventIdArray) {
        const eventKeys = await this.redis.keys(`audit:*:*:${eventId}`);
        
        for (const eventKey of eventKeys) {
          const eventData = await this.redis.get(eventKey);
          if (eventData) {
            const event = JSON.parse(eventData);
            
            // Apply additional filters
            if (eventType && event.type !== eventType) continue;
            if (severity && event.severity !== severity) continue;
            
            events.push(event);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return events;
      
    } catch (error) {
      logger.error('Failed to retrieve audit events:', error);
      return [];
    }
  }

  async getEventById(eventId) {
    if (!this.redis) {
      return null;
    }

    try {
      const eventKeys = await this.redis.keys(`audit:*:*:${eventId}`);
      
      if (eventKeys.length > 0) {
        const eventData = await this.redis.get(eventKeys[0]);
        return eventData ? JSON.parse(eventData) : null;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to retrieve audit event by ID:', error);
      return null;
    }
  }

  async getStatistics(options = {}) {
    if (!this.redis) {
      return {};
    }

    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = options;

      const events = await this.getEvents({ startDate, endDate, limit: 10000 });
      
      const stats = {
        totalEvents: events.length,
        eventsByCategory: {},
        eventsByType: {},
        eventsBySeverity: {},
        eventsByUser: {},
        eventsByDay: {},
        topUsers: [],
        recentEvents: events.slice(0, 10)
      };
      
      // Calculate statistics
      events.forEach(event => {
        // By category
        stats.eventsByCategory[event.category] = (stats.eventsByCategory[event.category] || 0) + 1;
        
        // By type
        stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
        
        // By severity
        stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
        
        // By user
        if (event.user !== 'system') {
          stats.eventsByUser[event.user] = (stats.eventsByUser[event.user] || 0) + 1;
        }
        
        // By day
        const day = this.formatDate(new Date(event.timestamp));
        stats.eventsByDay[day] = (stats.eventsByDay[day] || 0) + 1;
      });
      
      // Top users
      stats.topUsers = Object.entries(stats.eventsByUser)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, count }));
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to generate audit statistics:', error);
      return {};
    }
  }

  async exportEvents(options = {}) {
    try {
      const events = await this.getEvents(options);
      
      const exportData = {
        exportDate: new Date(),
        criteria: options,
        eventCount: events.length,
        events: events.map(event => ({
          timestamp: event.timestamp,
          type: event.type,
          category: event.category,
          user: event.user,
          ip: event.ip,
          severity: event.severity,
          details: event.details
        }))
      };
      
      return exportData;
    } catch (error) {
      logger.error('Failed to export audit events:', error);
      throw error;
    }
  }

  generateEventId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getCategoryForEvent(eventType) {
    for (const [category, types] of Object.entries(this.eventCategories)) {
      if (types.includes(eventType)) {
        return category;
      }
    }
    return 'OTHER';
  }

  getSeverityForEvent(eventType) {
    const criticalEvents = ['SECURITY_BREACH', 'UNAUTHORIZED_ACCESS', 'SYSTEM_COMPROMISE'];
    const highEvents = ['LDAP_BIND_FAILURE', 'KERBEROS_AS_FAILURE', 'SECURITY_ROLE_DELETED'];
    const mediumEvents = ['LDAP_DELETE', 'SECURITY_ROLE_ASSIGNED', 'CONFIGURATION_CHANGE'];
    
    if (criticalEvents.some(e => eventType.includes(e))) return 'CRITICAL';
    if (highEvents.some(e => eventType.includes(e))) return 'HIGH';
    if (mediumEvents.some(e => eventType.includes(e))) return 'MEDIUM';
    
    return 'LOW';
  }

  formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  startCleanupTask() {
    // Run cleanup every 24 hours
    setInterval(async () => {
      await this.cleanupExpiredEvents();
    }, 24 * 60 * 60 * 1000);
    
    logger.info('Audit cleanup task started');
  }

  async cleanupExpiredEvents() {
    if (!this.redis) return;

    try {
      const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
      const cutoffKey = `audit:*:${cutoffDate.getFullYear()}:${cutoffDate.getMonth() + 1}:*`;
      
      const expiredKeys = await this.redis.keys(cutoffKey);
      
      if (expiredKeys.length > 0) {
        await this.redis.del(expiredKeys);
        logger.info(`Cleaned up ${expiredKeys.length} expired audit events`);
      }
      
    } catch (error) {
      logger.error('Failed to cleanup expired audit events:', error);
    }
  }

  async stop() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      
      this.isRunning = false;
      logger.info('Audit Service stopped');
    } catch (error) {
      logger.error('Error stopping Audit Service:', error);
    }
  }
}

module.exports = AuditService;
