const express = require('express');
const router = express.Router();
const { replication: logger } = require('../utils/logger');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.replicationManager = req.app.get('replicationManager');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getServices);

// Get replication partners
router.get('/partners', async (req, res) => {
  try {
    const partners = await req.replicationManager.getPartners();

    res.json({
      success: true,
      data: partners
    });
  } catch (error) {
    logger.error('Failed to get replication partners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve replication partners'
    });
  }
});

// Add replication partner
router.post('/partners', async (req, res) => {
  try {
    const { hostname, port, credentials } = req.body;

    if (!hostname) {
      return res.status(400).json({
        success: false,
        error: 'hostname is required'
      });
    }

    const partner = await req.replicationManager.addPartner({
      hostname,
      port: port || 389,
      credentials
    });

    // Audit partner addition
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'REPLICATION_PARTNER_ADDED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          partnerId: partner.id,
          hostname,
          port: port || 389
        }
      });
    }

    logger.info(`Replication partner added: ${hostname}`);

    res.status(201).json({
      success: true,
      data: partner,
      message: 'Replication partner added successfully'
    });
  } catch (error) {
    logger.error('Failed to add replication partner:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add replication partner'
    });
  }
});

// Remove replication partner
router.delete('/partners/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await req.replicationManager.removePartner(id);

    // Audit partner removal
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'REPLICATION_PARTNER_REMOVED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          partnerId: id
        }
      });
    }

    logger.info(`Replication partner removed: ${id}`);

    res.json({
      success: true,
      message: 'Replication partner removed successfully'
    });
  } catch (error) {
    logger.error('Failed to remove replication partner:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove replication partner'
    });
  }
});

// Get replication status
router.get('/status', async (req, res) => {
  try {
    const status = await req.replicationManager.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get replication status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve replication status'
    });
  }
});

// Trigger manual replication
router.post('/sync', async (req, res) => {
  try {
    const { partnerId, urgent = false } = req.body;

    let result;
    if (partnerId) {
      result = await req.replicationManager.replicateToPartner(partnerId, { urgent });
    } else {
      result = await req.replicationManager.replicateToAllPartners({ urgent });
    }

    // Audit replication trigger
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'REPLICATION_TRIGGERED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          partnerId,
          urgent,
          manual: true
        }
      });
    }

    logger.info(`Manual replication triggered`, { partnerId, urgent });

    res.json({
      success: true,
      data: result,
      message: 'Replication triggered successfully'
    });
  } catch (error) {
    logger.error('Failed to trigger replication:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger replication'
    });
  }
});

// Get replication history
router.get('/history', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      partnerId,
      status,
      startDate,
      endDate
    } = req.query;

    const filters = {};
    if (partnerId) filters.partnerId = partnerId;
    if (status) filters.status = status;
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) filters.timestamp.$gte = new Date(startDate);
      if (endDate) filters.timestamp.$lte = new Date(endDate);
    }

    const history = await req.replicationManager.getReplicationHistory(filters, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Failed to get replication history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve replication history'
    });
  }
});

// Get replication conflicts
router.get('/conflicts', async (req, res) => {
  try {
    const conflicts = await req.replicationManager.getConflicts();

    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    logger.error('Failed to get replication conflicts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve replication conflicts'
    });
  }
});

// Resolve replication conflict
router.post('/conflicts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, winningVersion } = req.body;

    if (!resolution || !['manual', 'automatic'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resolution type'
      });
    }

    const result = await req.replicationManager.resolveConflict(id, {
      resolution,
      winningVersion
    });

    // Audit conflict resolution
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'REPLICATION_CONFLICT_RESOLVED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          conflictId: id,
          resolution,
          winningVersion
        }
      });
    }

    logger.info(`Replication conflict resolved: ${id}`);

    res.json({
      success: true,
      data: result,
      message: 'Conflict resolved successfully'
    });
  } catch (error) {
    logger.error('Failed to resolve replication conflict:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resolve conflict'
    });
  }
});

// Get replication metrics
router.get('/metrics', async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    const metrics = await req.replicationManager.getMetrics(period);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get replication metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve replication metrics'
    });
  }
});

module.exports = router;
