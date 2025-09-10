const Redis = require('redis');
const { replication: logger } = require('../utils/logger');

class ReplicationManager {
  constructor(config) {
    this.config = config;
    this.directoryService = config.directoryService;
    this.redis = null;
    this.auditService = config.auditService;
    
    this.replicationPartners = new Map();
    this.replicationSchedule = new Map();
    this.changeLog = new Map();
    this.isRunning = false;
    
    // Replication configuration
    this.replicationInterval = config.replicationInterval || 15 * 60 * 1000; // 15 minutes
    this.urgentReplicationDelay = config.urgentReplicationDelay || 15 * 1000; // 15 seconds
    this.maxReplicationRetries = config.maxReplicationRetries || 3;
  }

  async start() {
    try {
      // Connect to Redis for replication coordination
      this.redis = Redis.createClient({
        url: this.config.redis.url,
        db: this.config.redis.db || 3 // Use separate DB for replication
      });
      
      await this.redis.connect();
      
      // Initialize replication partners
      await this.initializeReplicationPartners();
      
      // Start replication monitoring
      this.startReplicationMonitoring();
      
      // Start change tracking
      this.startChangeTracking();
      
      this.isRunning = true;
      logger.info('Replication Manager started successfully');
      
    } catch (error) {
      logger.error('Failed to start Replication Manager:', error);
      throw error;
    }
  }

  async initializeReplicationPartners() {
    // Initialize with self as primary partner
    const selfPartner = {
      id: this.generatePartnerId(),
      hostname: process.env.HOSTNAME || 'dc1',
      ipAddress: process.env.DC_IP || '192.168.1.10',
      port: process.env.REPLICATION_PORT || 3269,
      role: 'primary',
      status: 'online',
      lastSync: new Date(),
      syncVersion: 1
    };
    
    this.replicationPartners.set(selfPartner.id, selfPartner);
    
    // Load additional partners from configuration
    const partners = process.env.REPLICATION_PARTNERS?.split(',') || [];
    
    for (const partnerConfig of partners) {
      const [hostname, ip, port] = partnerConfig.split(':');
      if (hostname && ip) {
        const partner = {
          id: this.generatePartnerId(),
          hostname,
          ipAddress: ip,
          port: port || 3269,
          role: 'secondary',
          status: 'unknown',
          lastSync: null,
          syncVersion: 0
        };
        
        this.replicationPartners.set(partner.id, partner);
      }
    }
    
    logger.info(`Initialized ${this.replicationPartners.size} replication partners`);
  }

  startReplicationMonitoring() {
    // Regular replication sync
    setInterval(async () => {
      await this.performScheduledReplication();
    }, this.replicationInterval);
    
    // Monitor partner health
    setInterval(async () => {
      await this.checkPartnerHealth();
    }, 60 * 1000); // Every minute
    
    logger.info('Replication monitoring started');
  }

  startChangeTracking() {
    // Monitor directory changes for replication
    // This would integrate with the DirectoryService to track changes
    logger.info('Change tracking started');
  }

  async recordChange(changeType, objectDN, changeData, urgent = false) {
    try {
      const change = {
        id: this.generateChangeId(),
        type: changeType, // 'add', 'modify', 'delete', 'move'
        objectDN,
        timestamp: new Date(),
        data: changeData,
        urgent,
        replicated: false,
        replicationAttempts: 0,
        originatingDC: process.env.HOSTNAME || 'dc1'
      };
      
      // Store change in Redis
      const changeKey = `repl:change:${change.id}`;
      await this.redis.setEx(changeKey, 7 * 24 * 60 * 60, JSON.stringify(change)); // 7 days TTL
      
      // Add to pending changes list
      await this.redis.lPush('repl:pending', change.id);
      
      // Cache locally
      this.changeLog.set(change.id, change);
      
      // Schedule urgent replication if needed
      if (urgent) {
        setTimeout(() => {
          this.performUrgentReplication(change);
        }, this.urgentReplicationDelay);
      }
      
      logger.debug('Recorded directory change for replication', {
        changeId: change.id,
        type: changeType,
        objectDN,
        urgent
      });
      
      return change.id;
    } catch (error) {
      logger.error('Failed to record change for replication:', error);
      throw error;
    }
  }

  async performScheduledReplication() {
    try {
      logger.debug('Starting scheduled replication');
      
      // Get pending changes
      const pendingChanges = await this.getPendingChanges();
      
      if (pendingChanges.length === 0) {
        logger.debug('No pending changes for replication');
        return;
      }
      
      // Replicate to all partners
      for (const [partnerId, partner] of this.replicationPartners) {
        if (partner.role === 'primary' || partner.status !== 'online') {
          continue; // Skip self and offline partners
        }
        
        await this.replicateToPartner(partner, pendingChanges);
      }
      
      logger.info(`Completed scheduled replication of ${pendingChanges.length} changes`);
      
    } catch (error) {
      logger.error('Scheduled replication failed:', error);
    }
  }

  async performUrgentReplication(change) {
    try {
      logger.info('Starting urgent replication', { changeId: change.id });
      
      // Replicate to all online partners immediately
      const replicationPromises = [];
      
      for (const [partnerId, partner] of this.replicationPartners) {
        if (partner.role === 'primary' || partner.status !== 'online') {
          continue;
        }
        
        replicationPromises.push(this.replicateToPartner(partner, [change]));
      }
      
      await Promise.allSettled(replicationPromises);
      
      logger.info('Completed urgent replication', { changeId: change.id });
      
    } catch (error) {
      logger.error('Urgent replication failed:', error);
    }
  }

  async replicateToPartner(partner, changes) {
    try {
      logger.debug(`Replicating ${changes.length} changes to partner ${partner.hostname}`);
      
      // Simulate replication to partner
      // In a real implementation, this would use LDAP replication protocol
      const replicationData = {
        sourcePartner: process.env.HOSTNAME || 'dc1',
        targetPartner: partner.hostname,
        changes: changes.map(change => ({
          id: change.id,
          type: change.type,
          objectDN: change.objectDN,
          timestamp: change.timestamp,
          data: change.data
        })),
        syncVersion: partner.syncVersion + 1
      };
      
      // Store replication attempt
      const replicationKey = `repl:attempt:${partner.id}:${Date.now()}`;
      await this.redis.setEx(replicationKey, 24 * 60 * 60, JSON.stringify(replicationData)); // 24 hours TTL
      
      // Update partner sync info
      partner.lastSync = new Date();
      partner.syncVersion = replicationData.syncVersion;
      partner.status = 'online';
      
      // Mark changes as replicated
      for (const change of changes) {
        change.replicated = true;
        change.replicationAttempts++;
        
        // Update in Redis
        const changeKey = `repl:change:${change.id}`;
        await this.redis.setEx(changeKey, 7 * 24 * 60 * 60, JSON.stringify(change));
        
        // Remove from pending list
        await this.redis.lRem('repl:pending', 1, change.id);
      }
      
      // Audit replication
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'REPLICATION_SUCCESS',
          details: {
            targetPartner: partner.hostname,
            changeCount: changes.length,
            syncVersion: replicationData.syncVersion
          }
        });
      }
      
      logger.info(`Successfully replicated to partner ${partner.hostname}`, {
        changeCount: changes.length,
        syncVersion: replicationData.syncVersion
      });
      
    } catch (error) {
      logger.error(`Replication to partner ${partner.hostname} failed:`, error);
      
      // Update partner status
      partner.status = 'error';
      
      // Increment retry count for changes
      for (const change of changes) {
        change.replicationAttempts++;
        
        if (change.replicationAttempts >= this.maxReplicationRetries) {
          logger.error(`Change ${change.id} exceeded max replication retries`);
          
          // Move to failed changes
          await this.redis.lPush('repl:failed', change.id);
          await this.redis.lRem('repl:pending', 1, change.id);
        }
      }
      
      // Audit replication failure
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'REPLICATION_FAILURE',
          details: {
            targetPartner: partner.hostname,
            error: error.message,
            changeCount: changes.length
          }
        });
      }
      
      throw error;
    }
  }

  async getPendingChanges(limit = 100) {
    try {
      const pendingIds = await this.redis.lRange('repl:pending', 0, limit - 1);
      const changes = [];
      
      for (const changeId of pendingIds) {
        const changeKey = `repl:change:${changeId}`;
        const changeData = await this.redis.get(changeKey);
        
        if (changeData) {
          const change = JSON.parse(changeData);
          changes.push(change);
        }
      }
      
      return changes;
    } catch (error) {
      logger.error('Failed to get pending changes:', error);
      return [];
    }
  }

  async checkPartnerHealth() {
    try {
      for (const [partnerId, partner] of this.replicationPartners) {
        if (partner.role === 'primary') {
          continue; // Skip self
        }
        
        // Simulate health check
        // In a real implementation, this would ping the partner DC
        const isHealthy = await this.pingPartner(partner);
        
        const previousStatus = partner.status;
        partner.status = isHealthy ? 'online' : 'offline';
        
        if (previousStatus !== partner.status) {
          logger.info(`Partner ${partner.hostname} status changed: ${previousStatus} -> ${partner.status}`);
          
          // Audit status change
          if (this.auditService) {
            await this.auditService.logEvent({
              type: 'REPLICATION_PARTNER_STATUS_CHANGE',
              details: {
                partnerId,
                hostname: partner.hostname,
                previousStatus,
                newStatus: partner.status
              }
            });
          }
        }
      }
    } catch (error) {
      logger.error('Partner health check failed:', error);
    }
  }

  async pingPartner(partner) {
    try {
      // Simulate network ping
      // In a real implementation, this would use actual network connectivity check
      return Math.random() > 0.1; // 90% success rate for simulation
    } catch (error) {
      return false;
    }
  }

  async addReplicationPartner(partnerConfig) {
    try {
      const partner = {
        id: this.generatePartnerId(),
        hostname: partnerConfig.hostname,
        ipAddress: partnerConfig.ipAddress,
        port: partnerConfig.port || 3269,
        role: partnerConfig.role || 'secondary',
        status: 'unknown',
        lastSync: null,
        syncVersion: 0,
        added: new Date(),
        addedBy: partnerConfig.addedBy || 'system'
      };
      
      this.replicationPartners.set(partner.id, partner);
      
      // Store in Redis
      const partnerKey = `repl:partner:${partner.id}`;
      await this.redis.setEx(partnerKey, 30 * 24 * 60 * 60, JSON.stringify(partner)); // 30 days TTL
      
      // Audit partner addition
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'REPLICATION_PARTNER_ADDED',
          user: partner.addedBy,
          details: {
            partnerId: partner.id,
            hostname: partner.hostname,
            ipAddress: partner.ipAddress
          }
        });
      }
      
      logger.info(`Added replication partner: ${partner.hostname}`, { partnerId: partner.id });
      return partner.id;
    } catch (error) {
      logger.error('Failed to add replication partner:', error);
      throw error;
    }
  }

  async removeReplicationPartner(partnerId, removedBy = 'system') {
    try {
      const partner = this.replicationPartners.get(partnerId);
      if (!partner) {
        throw new Error('Replication partner not found');
      }
      
      // Remove from memory
      this.replicationPartners.delete(partnerId);
      
      // Remove from Redis
      const partnerKey = `repl:partner:${partnerId}`;
      await this.redis.del(partnerKey);
      
      // Audit partner removal
      if (this.auditService) {
        await this.auditService.logEvent({
          type: 'REPLICATION_PARTNER_REMOVED',
          user: removedBy,
          details: {
            partnerId,
            hostname: partner.hostname,
            ipAddress: partner.ipAddress
          }
        });
      }
      
      logger.info(`Removed replication partner: ${partner.hostname}`, { partnerId });
      return true;
    } catch (error) {
      logger.error('Failed to remove replication partner:', error);
      throw error;
    }
  }

  async getReplicationStatus() {
    try {
      const pendingCount = await this.redis.lLen('repl:pending');
      const failedCount = await this.redis.lLen('repl:failed');
      
      const partners = Array.from(this.replicationPartners.values()).map(partner => ({
        id: partner.id,
        hostname: partner.hostname,
        ipAddress: partner.ipAddress,
        role: partner.role,
        status: partner.status,
        lastSync: partner.lastSync,
        syncVersion: partner.syncVersion
      }));
      
      return {
        isRunning: this.isRunning,
        pendingChanges: pendingCount,
        failedChanges: failedCount,
        partners,
        lastReplication: this.getLastReplicationTime(),
        nextReplication: this.getNextReplicationTime()
      };
    } catch (error) {
      logger.error('Failed to get replication status:', error);
      return {
        isRunning: false,
        error: error.message
      };
    }
  }

  getLastReplicationTime() {
    let lastReplication = null;
    
    for (const partner of this.replicationPartners.values()) {
      if (partner.lastSync && (!lastReplication || partner.lastSync > lastReplication)) {
        lastReplication = partner.lastSync;
      }
    }
    
    return lastReplication;
  }

  getNextReplicationTime() {
    const lastReplication = this.getLastReplicationTime();
    if (lastReplication) {
      return new Date(lastReplication.getTime() + this.replicationInterval);
    }
    return new Date(Date.now() + this.replicationInterval);
  }

  generatePartnerId() {
    return `partner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateChangeId() {
    return `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async forceReplication(partnerId = null) {
    try {
      if (partnerId) {
        const partner = this.replicationPartners.get(partnerId);
        if (!partner) {
          throw new Error('Partner not found');
        }
        
        const pendingChanges = await this.getPendingChanges();
        await this.replicateToPartner(partner, pendingChanges);
        
        logger.info(`Forced replication to partner ${partner.hostname}`);
      } else {
        await this.performScheduledReplication();
        logger.info('Forced replication to all partners');
      }
    } catch (error) {
      logger.error('Force replication failed:', error);
      throw error;
    }
  }

  async retryFailedChanges() {
    try {
      const failedIds = await this.redis.lRange('repl:failed', 0, -1);
      const retriedChanges = [];
      
      for (const changeId of failedIds) {
        const changeKey = `repl:change:${changeId}`;
        const changeData = await this.redis.get(changeKey);
        
        if (changeData) {
          const change = JSON.parse(changeData);
          change.replicationAttempts = 0; // Reset retry count
          
          // Move back to pending
          await this.redis.lPush('repl:pending', changeId);
          await this.redis.lRem('repl:failed', 1, changeId);
          
          retriedChanges.push(change);
        }
      }
      
      logger.info(`Retrying ${retriedChanges.length} failed changes`);
      return retriedChanges.length;
    } catch (error) {
      logger.error('Failed to retry failed changes:', error);
      throw error;
    }
  }

  async stop() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      
      this.isRunning = false;
      logger.info('Replication Manager stopped');
    } catch (error) {
      logger.error('Error stopping Replication Manager:', error);
    }
  }
}

module.exports = ReplicationManager;
