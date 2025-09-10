const express = require('express');
const router = express.Router();
const { directory: logger } = require('../utils/logger');
const DomainComputer = require('../models/DomainComputer');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.directoryService = req.app.get('directoryService');
  req.securityManager = req.app.get('securityManager');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getServices);

// Get all computers with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const os = req.query.os; // Filter by operating system
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query.$or = [
        { sAMAccountName: { $regex: search, $options: 'i' } },
        { dNSHostName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (os) {
      query.operatingSystem = { $regex: os, $options: 'i' };
    }

    const [computers, total] = await Promise.all([
      DomainComputer.find(query)
        .sort({ sAMAccountName: 1 })
        .skip(skip)
        .limit(limit),
      DomainComputer.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        computers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get computers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve computers'
    });
  }
});

// Get computer by ID or SAM account name
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }
    if (!computer) {
      computer = await DomainComputer.findByHostname(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    res.json({
      success: true,
      data: computer
    });
  } catch (error) {
    logger.error('Failed to get computer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve computer'
    });
  }
});

// Create new computer account
router.post('/', async (req, res) => {
  try {
    const {
      sAMAccountName,
      dNSHostName,
      description,
      operatingSystem,
      operatingSystemVersion,
      operatingSystemServicePack,
      ou = 'Computers'
    } = req.body;

    // Validate required fields
    if (!sAMAccountName) {
      return res.status(400).json({
        success: false,
        error: 'sAMAccountName is required'
      });
    }

    // Ensure SAM account name ends with $
    const computerSAM = sAMAccountName.endsWith('$') ? sAMAccountName : `${sAMAccountName}$`;

    // Check if computer already exists
    const existingComputer = await DomainComputer.findBySAM(computerSAM);
    if (existingComputer) {
      return res.status(409).json({
        success: false,
        error: 'Computer already exists'
      });
    }

    // Generate DN
    const baseDN = req.directoryService.baseDN;
    const dn = `cn=${computerSAM.slice(0, -1)},cn=${ou},${baseDN}`;

    // Create computer object
    const computerData = {
      dn,
      cn: computerSAM.slice(0, -1),
      sAMAccountName: computerSAM,
      dNSHostName: dNSHostName || `${computerSAM.slice(0, -1).toLowerCase()}.${req.directoryService.domain.name}`,
      description,
      operatingSystem,
      operatingSystemVersion,
      operatingSystemServicePack,
      userAccountControl: 4096, // Workstation trust account
      memberOf: [`cn=Domain Computers,cn=Groups,${baseDN}`],
      objectClass: ['top', 'person', 'organizationalPerson', 'user', 'computer'],
      objectCategory: `cn=Computer,cn=Schema,cn=Configuration,${baseDN}`,
      servicePrincipalName: [
        `HOST/${dNSHostName || computerSAM.slice(0, -1)}`,
        `HOST/${computerSAM.slice(0, -1)}`
      ]
    };

    const computer = new DomainComputer(computerData);
    await computer.save();

    // Audit computer creation
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'COMPUTER_CREATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computerSAM,
          dn: computer.dn,
          dNSHostName: computer.dNSHostName
        }
      });
    }

    logger.info(`Computer created: ${computerSAM}`, { dn: computer.dn });

    res.status(201).json({
      success: true,
      data: computer,
      message: 'Computer created successfully'
    });
  } catch (error) {
    logger.error('Failed to create computer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create computer'
    });
  }
});

// Update computer
router.put('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const updates = req.body;

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    // Update computer
    Object.assign(computer, updates);
    await computer.save();

    // Audit computer update
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'COMPUTER_UPDATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computer.sAMAccountName,
          dn: computer.dn,
          changes: Object.keys(updates)
        }
      });
    }

    logger.info(`Computer updated: ${computer.sAMAccountName}`, { dn: computer.dn });

    res.json({
      success: true,
      data: computer,
      message: 'Computer updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update computer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update computer'
    });
  }
});

// Delete computer
router.delete('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    await DomainComputer.deleteOne({ _id: computer._id });

    // Audit computer deletion
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'COMPUTER_DELETED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computer.sAMAccountName,
          dn: computer.dn
        }
      });
    }

    logger.info(`Computer deleted: ${computer.sAMAccountName}`, { dn: computer.dn });

    res.json({
      success: true,
      message: 'Computer deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete computer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete computer'
    });
  }
});

// Enable/Disable computer account
router.patch('/:identifier/status', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean'
      });
    }

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    // Update account control flags
    if (enabled) {
      computer.userAccountControl &= ~2; // Remove disabled flag
    } else {
      computer.userAccountControl |= 2; // Add disabled flag
    }

    await computer.save();

    // Audit status change
    if (req.auditService) {
      await req.auditService.logEvent({
        type: enabled ? 'COMPUTER_ENABLED' : 'COMPUTER_DISABLED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computer.sAMAccountName,
          dn: computer.dn
        }
      });
    }

    logger.info(`Computer ${enabled ? 'enabled' : 'disabled'}: ${computer.sAMAccountName}`);

    res.json({
      success: true,
      data: {
        sAMAccountName: computer.sAMAccountName,
        enabled: !computer.isDisabled()
      },
      message: `Computer ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    logger.error('Failed to update computer status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update computer status'
    });
  }
});

// Reset computer password
router.post('/:identifier/reset-password', async (req, res) => {
  try {
    const { identifier } = req.params;

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    // Generate new random password for computer account
    const crypto = require('crypto');
    const newPassword = crypto.randomBytes(32).toString('hex');

    // Update password
    const bcrypt = require('bcryptjs');
    computer.password = await bcrypt.hash(newPassword, 12);
    computer.pwdLastSet = new Date();
    await computer.save();

    // Audit password reset
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'COMPUTER_PASSWORD_RESET',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computer.sAMAccountName,
          dn: computer.dn
        }
      });
    }

    logger.info(`Password reset for computer: ${computer.sAMAccountName}`);

    res.json({
      success: true,
      data: {
        newPassword // Return password for computer account setup
      },
      message: 'Computer password reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset computer password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset computer password'
    });
  }
});

// Get computer's service principal names
router.get('/:identifier/spn', async (req, res) => {
  try {
    const { identifier } = req.params;

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    res.json({
      success: true,
      data: {
        sAMAccountName: computer.sAMAccountName,
        servicePrincipalName: computer.servicePrincipalName || []
      }
    });
  } catch (error) {
    logger.error('Failed to get computer SPNs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve computer SPNs'
    });
  }
});

// Add service principal name
router.post('/:identifier/spn', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { spn } = req.body;

    if (!spn) {
      return res.status(400).json({
        success: false,
        error: 'SPN is required'
      });
    }

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    // Add SPN
    await computer.addSPN(spn);

    // Audit SPN addition
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'COMPUTER_SPN_ADDED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computer.sAMAccountName,
          spn
        }
      });
    }

    logger.info(`Added SPN ${spn} to computer ${computer.sAMAccountName}`);

    res.json({
      success: true,
      message: 'SPN added successfully'
    });
  } catch (error) {
    logger.error('Failed to add SPN:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add SPN'
    });
  }
});

// Remove service principal name
router.delete('/:identifier/spn/:spnValue', async (req, res) => {
  try {
    const { identifier } = req.params;
    const spn = decodeURIComponent(req.params.spnValue);

    let computer = await DomainComputer.findById(identifier);
    if (!computer) {
      computer = await DomainComputer.findBySAM(identifier);
    }

    if (!computer) {
      return res.status(404).json({
        success: false,
        error: 'Computer not found'
      });
    }

    // Remove SPN
    await computer.removeSPN(spn);

    // Audit SPN removal
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'COMPUTER_SPN_REMOVED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetComputer: computer.sAMAccountName,
          spn
        }
      });
    }

    logger.info(`Removed SPN ${spn} from computer ${computer.sAMAccountName}`);

    res.json({
      success: true,
      message: 'SPN removed successfully'
    });
  } catch (error) {
    logger.error('Failed to remove SPN:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove SPN'
    });
  }
});

module.exports = router;
