const express = require('express');
const router = express.Router();
const { audit: logger } = require('../utils/logger');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.auditService = req.app.get('auditService');
  req.securityManager = req.app.get('securityManager');
  next();
};

router.use(getServices);

// Get audit events with filtering and pagination
router.get('/events', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      startDate,
      endDate,
      type,
      user,
      severity,
      search
    } = req.query;

    const filters = {};
    
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) filters.timestamp.$gte = new Date(startDate);
      if (endDate) filters.timestamp.$lte = new Date(endDate);
    }
    
    if (type) filters.type = type;
    if (user) filters.user = user;
    if (severity) filters.severity = severity;
    if (search) {
      filters.$or = [
        { type: { $regex: search, $options: 'i' } },
        { user: { $regex: search, $options: 'i' } },
        { 'details.targetUser': { $regex: search, $options: 'i' } },
        { 'details.targetGroup': { $regex: search, $options: 'i' } },
        { 'details.targetComputer': { $regex: search, $options: 'i' } }
      ];
    }

    const events = await req.auditService.getEvents(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Failed to get audit events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit events'
    });
  }
});

// Get audit statistics
router.get('/stats', async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    const stats = await req.auditService.getStatistics(period);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get audit statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit statistics'
    });
  }
});

// Export audit events
router.post('/export', async (req, res) => {
  try {
    const {
      format = 'json',
      startDate,
      endDate,
      filters = {}
    } = req.body;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be json or csv'
      });
    }

    const exportData = await req.auditService.exportEvents({
      format,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      filters
    });

    // Set appropriate headers
    const filename = `audit-export-${new Date().toISOString().split('T')[0]}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');

    res.send(exportData);
  } catch (error) {
    logger.error('Failed to export audit events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit events'
    });
  }
});

// Get event types
router.get('/event-types', async (req, res) => {
  try {
    const eventTypes = [
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_ENABLED',
      'USER_DISABLED',
      'USER_PASSWORD_RESET',
      'USER_LOGIN_SUCCESS',
      'USER_LOGIN_FAILED',
      'USER_LOGOUT',
      'GROUP_CREATED',
      'GROUP_UPDATED',
      'GROUP_DELETED',
      'GROUP_MEMBER_ADDED',
      'GROUP_MEMBER_REMOVED',
      'COMPUTER_CREATED',
      'COMPUTER_UPDATED',
      'COMPUTER_DELETED',
      'COMPUTER_ENABLED',
      'COMPUTER_DISABLED',
      'COMPUTER_PASSWORD_RESET',
      'COMPUTER_SPN_ADDED',
      'COMPUTER_SPN_REMOVED',
      'POLICY_CREATED',
      'POLICY_UPDATED',
      'POLICY_DELETED',
      'POLICY_LINKED',
      'POLICY_UNLINKED',
      'POLICIES_APPLIED',
      'POLICY_CREATED_FROM_TEMPLATE',
      'LDAP_BIND_SUCCESS',
      'LDAP_BIND_FAILED',
      'LDAP_SEARCH',
      'LDAP_ADD',
      'LDAP_MODIFY',
      'LDAP_DELETE',
      'KERBEROS_AS_REQ',
      'KERBEROS_TGS_REQ',
      'KERBEROS_TICKET_ISSUED',
      'KERBEROS_AUTH_FAILED',
      'DNS_QUERY',
      'DNS_UPDATE',
      'REPLICATION_START',
      'REPLICATION_SUCCESS',
      'REPLICATION_FAILED',
      'SECURITY_POLICY_VIOLATION',
      'ACCOUNT_LOCKOUT',
      'PASSWORD_POLICY_VIOLATION'
    ];

    res.json({
      success: true,
      data: eventTypes
    });
  } catch (error) {
    logger.error('Failed to get event types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve event types'
    });
  }
});

// Get severity levels
router.get('/severity-levels', async (req, res) => {
  try {
    const severityLevels = [
      { level: 'info', description: 'Informational events' },
      { level: 'warning', description: 'Warning events that may require attention' },
      { level: 'error', description: 'Error events indicating problems' },
      { level: 'critical', description: 'Critical events requiring immediate attention' }
    ];

    res.json({
      success: true,
      data: severityLevels
    });
  } catch (error) {
    logger.error('Failed to get severity levels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve severity levels'
    });
  }
});

// Cleanup old audit events
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 90 } = req.body;

    if (olderThanDays < 1) {
      return res.status(400).json({
        success: false,
        error: 'olderThanDays must be at least 1'
      });
    }

    const result = await req.auditService.cleanup(olderThanDays);

    // Audit the cleanup operation
    await req.auditService.logEvent({
      type: 'AUDIT_CLEANUP',
      user: req.user?.sAMAccountName || 'system',
      details: {
        olderThanDays,
        deletedCount: result.deletedCount
      }
    });

    logger.info(`Audit cleanup completed: ${result.deletedCount} events deleted`);

    res.json({
      success: true,
      data: result,
      message: 'Audit cleanup completed successfully'
    });
  } catch (error) {
    logger.error('Failed to cleanup audit events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup audit events'
    });
  }
});

// Get audit configuration
router.get('/config', async (req, res) => {
  try {
    const config = {
      retentionDays: process.env.AUDIT_RETENTION_DAYS || 365,
      enabledEvents: process.env.AUDIT_ENABLED_EVENTS?.split(',') || ['all'],
      logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
      exportFormats: ['json', 'csv'],
      maxEventsPerQuery: 1000
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get audit configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit configuration'
    });
  }
});

module.exports = router;
