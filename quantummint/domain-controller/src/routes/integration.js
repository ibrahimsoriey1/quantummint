const express = require('express');
const router = express.Router();
const { integration: logger } = require('../utils/logger');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.integration = req.app.get('integration');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getServices);

// Get integration status
router.get('/status', async (req, res) => {
  try {
    if (!req.integration) {
      return res.status(503).json({
        success: false,
        error: 'Integration service not available'
      });
    }

    const status = await req.integration.getHealthStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get integration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve integration status'
    });
  }
});

// Authenticate user via domain controller
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    if (!req.integration) {
      return res.status(503).json({
        success: false,
        error: 'Integration service not available'
      });
    }

    const result = await req.integration.authenticateUser(username, password);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Validate JWT token
router.post('/auth/validate', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    if (!req.integration) {
      return res.status(503).json({
        success: false,
        error: 'Integration service not available'
      });
    }

    const result = await req.integration.validateToken(token);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.user
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Token validation failed'
    });
  }
});

// Get user by email (for mail server integration)
router.get('/users/email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!req.integration) {
      return res.status(503).json({
        success: false,
        error: 'Integration service not available'
      });
    }

    const result = await req.integration.getUserByEmail(email);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.user
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('User lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'User lookup failed'
    });
  }
});

// Sync user to QuantumMint services
router.post('/users/:username/sync', async (req, res) => {
  try {
    const { username } = req.params;
    const directoryService = req.app.get('directoryService');

    if (!req.integration || !directoryService) {
      return res.status(503).json({
        success: false,
        error: 'Required services not available'
      });
    }

    // Get user from directory
    const user = await directoryService.getUser(username);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await req.integration.syncUserToQuantumMint(user);

    // Audit sync operation
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'USER_SYNC_QUANTUMMINT',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: username,
          operation: 'sync'
        }
      });
    }

    res.json({
      success: true,
      message: 'User synced successfully'
    });
  } catch (error) {
    logger.error('User sync error:', error);
    res.status(500).json({
      success: false,
      error: 'User sync failed'
    });
  }
});

// Remove user from QuantumMint services
router.delete('/users/:username/sync', async (req, res) => {
  try {
    const { username } = req.params;

    if (!req.integration) {
      return res.status(503).json({
        success: false,
        error: 'Integration service not available'
      });
    }

    await req.integration.removeUserFromQuantumMint(username);

    // Audit removal operation
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'USER_REMOVE_QUANTUMMINT',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: username,
          operation: 'remove'
        }
      });
    }

    res.json({
      success: true,
      message: 'User removed from QuantumMint services successfully'
    });
  } catch (error) {
    logger.error('User removal error:', error);
    res.status(500).json({
      success: false,
      error: 'User removal failed'
    });
  }
});

// Test connectivity to QuantumMint services
router.post('/test-connectivity', async (req, res) => {
  try {
    if (!req.integration) {
      return res.status(503).json({
        success: false,
        error: 'Integration service not available'
      });
    }

    await req.integration.testConnectivity();

    res.json({
      success: true,
      message: 'Connectivity test completed - check logs for details'
    });
  } catch (error) {
    logger.error('Connectivity test error:', error);
    res.status(500).json({
      success: false,
      error: 'Connectivity test failed'
    });
  }
});

module.exports = router;
