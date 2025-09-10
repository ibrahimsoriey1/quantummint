const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { directory: logger } = require('../utils/logger');
const DomainUser = require('../models/DomainUser');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.directoryService = req.app.get('directoryService');
  req.securityManager = req.app.get('securityManager');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getServices);

// Get all users with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { sAMAccountName: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } },
          { mail: { $regex: search, $options: 'i' } },
          { userPrincipalName: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const [users, total] = await Promise.all([
      DomainUser.find(query)
        .select('-password')
        .sort({ sAMAccountName: 1 })
        .skip(skip)
        .limit(limit),
      DomainUser.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

// Get user by ID or SAM account name
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let user = await DomainUser.findById(identifier).select('-password');
    if (!user) {
      user = await DomainUser.findBySAM(identifier).select('-password');
    }
    if (!user) {
      user = await DomainUser.findByUPN(identifier).select('-password');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's groups
    const groups = await user.getGroups();

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        groups: groups.map(g => ({
          dn: g.dn,
          cn: g.cn,
          sAMAccountName: g.sAMAccountName,
          description: g.description
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user'
    });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const {
      sAMAccountName,
      userPrincipalName,
      displayName,
      givenName,
      sn,
      mail,
      password,
      ou = 'Users'
    } = req.body;

    // Validate required fields
    if (!sAMAccountName || !password) {
      return res.status(400).json({
        success: false,
        error: 'sAMAccountName and password are required'
      });
    }

    // Validate password policy
    const passwordValidation = await req.securityManager.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet policy requirements',
        details: passwordValidation.errors
      });
    }

    // Check if user already exists
    const existingUser = await DomainUser.findBySAM(sAMAccountName);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Generate DN
    const baseDN = req.directoryService.baseDN;
    const dn = `cn=${sAMAccountName},cn=${ou},${baseDN}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user object
    const userData = {
      dn,
      cn: sAMAccountName,
      sAMAccountName,
      userPrincipalName: userPrincipalName || `${sAMAccountName}@${req.directoryService.domain.name}`,
      displayName: displayName || `${givenName || ''} ${sn || ''}`.trim() || sAMAccountName,
      givenName,
      sn,
      mail,
      password: hashedPassword,
      userAccountControl: 512, // Normal account
      pwdLastSet: new Date(),
      memberOf: [`cn=Domain Users,cn=Groups,${baseDN}`],
      objectClass: ['top', 'person', 'organizationalPerson', 'user'],
      objectCategory: `cn=Person,cn=Schema,cn=Configuration,${baseDN}`
    };

    const user = new DomainUser(userData);
    await user.save();

    // Audit user creation
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'USER_CREATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: sAMAccountName,
          dn: user.dn
        }
      });
    }

    logger.info(`User created: ${sAMAccountName}`, { dn: user.dn });

    res.status(201).json({
      success: true,
      data: {
        ...user.toObject(),
        password: undefined
      },
      message: 'User created successfully'
    });
  } catch (error) {
    logger.error('Failed to create user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user'
    });
  }
});

// Update user
router.put('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const updates = req.body;

    let user = await DomainUser.findById(identifier);
    if (!user) {
      user = await DomainUser.findBySAM(identifier);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Handle password update
    if (updates.password) {
      const passwordValidation = await req.securityManager.validatePassword(updates.password, user.dn);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Password does not meet policy requirements',
          details: passwordValidation.errors
        });
      }
      updates.password = await bcrypt.hash(updates.password, 12);
      updates.pwdLastSet = new Date();
    }

    // Update user
    Object.assign(user, updates);
    await user.save();

    // Audit user update
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'USER_UPDATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: user.sAMAccountName,
          dn: user.dn,
          changes: Object.keys(updates)
        }
      });
    }

    logger.info(`User updated: ${user.sAMAccountName}`, { dn: user.dn });

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        password: undefined
      },
      message: 'User updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update user'
    });
  }
});

// Delete user
router.delete('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    let user = await DomainUser.findById(identifier);
    if (!user) {
      user = await DomainUser.findBySAM(identifier);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user is protected (e.g., Administrator)
    if (user.sAMAccountName === 'Administrator') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete protected user account'
      });
    }

    await DomainUser.deleteOne({ _id: user._id });

    // Audit user deletion
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'USER_DELETED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: user.sAMAccountName,
          dn: user.dn
        }
      });
    }

    logger.info(`User deleted: ${user.sAMAccountName}`, { dn: user.dn });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
});

// Enable/Disable user account
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

    let user = await DomainUser.findById(identifier);
    if (!user) {
      user = await DomainUser.findBySAM(identifier);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update account control flags
    if (enabled) {
      user.userAccountControl &= ~2; // Remove disabled flag
    } else {
      user.userAccountControl |= 2; // Add disabled flag
    }

    await user.save();

    // Audit status change
    if (req.auditService) {
      await req.auditService.logEvent({
        type: enabled ? 'USER_ENABLED' : 'USER_DISABLED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: user.sAMAccountName,
          dn: user.dn
        }
      });
    }

    logger.info(`User ${enabled ? 'enabled' : 'disabled'}: ${user.sAMAccountName}`);

    res.json({
      success: true,
      data: {
        sAMAccountName: user.sAMAccountName,
        enabled: !user.isDisabled()
      },
      message: `User ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    logger.error('Failed to update user status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status'
    });
  }
});

// Reset user password
router.post('/:identifier/reset-password', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { newPassword, mustChangePassword = true } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'newPassword is required'
      });
    }

    let user = await DomainUser.findById(identifier);
    if (!user) {
      user = await DomainUser.findBySAM(identifier);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Validate password policy
    const passwordValidation = await req.securityManager.validatePassword(newPassword, user.dn);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet policy requirements',
        details: passwordValidation.errors
      });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 12);
    user.pwdLastSet = mustChangePassword ? new Date(0) : new Date();
    await user.save();

    // Audit password reset
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'USER_PASSWORD_RESET',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetUser: user.sAMAccountName,
          dn: user.dn,
          mustChangePassword
        }
      });
    }

    logger.info(`Password reset for user: ${user.sAMAccountName}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// Get user's group memberships
router.get('/:identifier/groups', async (req, res) => {
  try {
    const { identifier } = req.params;

    let user = await DomainUser.findById(identifier);
    if (!user) {
      user = await DomainUser.findBySAM(identifier);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const groups = await user.getGroups();

    res.json({
      success: true,
      data: groups.map(group => ({
        dn: group.dn,
        cn: group.cn,
        sAMAccountName: group.sAMAccountName,
        description: group.description,
        groupType: group.groupType,
        groupScope: group.groupScope
      }))
    });
  } catch (error) {
    logger.error('Failed to get user groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user groups'
    });
  }
});

module.exports = router;
