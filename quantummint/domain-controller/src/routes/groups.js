const express = require('express');
const router = express.Router();
const { directory: logger } = require('../utils/logger');
const DomainGroup = require('../models/DomainGroup');
const DomainUser = require('../models/DomainUser');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.directoryService = req.app.get('directoryService');
  req.securityManager = req.app.get('securityManager');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getServices);

// Get all groups with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const groupType = req.query.groupType; // 'security' or 'distribution'
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query.$or = [
        { sAMAccountName: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (groupType === 'security') {
      query.groupType = { $lt: 0 };
    } else if (groupType === 'distribution') {
      query.groupType = { $gt: 0 };
    }

    const [groups, total] = await Promise.all([
      DomainGroup.find(query)
        .sort({ sAMAccountName: 1 })
        .skip(skip)
        .limit(limit),
      DomainGroup.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        groups,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve groups'
    });
  }
});

// Get group by ID or SAM account name
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Get group members
    const members = [];
    if (group.member && group.member.length > 0) {
      for (const memberDN of group.member) {
        const user = await DomainUser.findOne({ dn: memberDN });
        if (user) {
          members.push({
            dn: user.dn,
            sAMAccountName: user.sAMAccountName,
            displayName: user.displayName,
            objectClass: user.objectClass
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...group.toObject(),
        members,
        memberCount: members.length
      }
    });
  } catch (error) {
    logger.error('Failed to get group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve group'
    });
  }
});

// Create new group
router.post('/', async (req, res) => {
  try {
    const {
      sAMAccountName,
      displayName,
      description,
      groupScope = 'Global',
      groupCategory = 'Security',
      ou = 'Groups'
    } = req.body;

    // Validate required fields
    if (!sAMAccountName) {
      return res.status(400).json({
        success: false,
        error: 'sAMAccountName is required'
      });
    }

    // Check if group already exists
    const existingGroup = await DomainGroup.findBySAM(sAMAccountName);
    if (existingGroup) {
      return res.status(409).json({
        success: false,
        error: 'Group already exists'
      });
    }

    // Generate DN
    const baseDN = req.directoryService.baseDN;
    const dn = `cn=${sAMAccountName},cn=${ou},${baseDN}`;

    // Determine group type based on scope and category
    let groupType;
    if (groupCategory === 'Security') {
      switch (groupScope) {
        case 'DomainLocal':
          groupType = -2147483644;
          break;
        case 'Global':
          groupType = -2147483646;
          break;
        case 'Universal':
          groupType = -2147483640;
          break;
        default:
          groupType = -2147483646; // Default to Global Security
      }
    } else {
      switch (groupScope) {
        case 'DomainLocal':
          groupType = 4;
          break;
        case 'Global':
          groupType = 2;
          break;
        case 'Universal':
          groupType = 8;
          break;
        default:
          groupType = 2; // Default to Global Distribution
      }
    }

    // Create group object
    const groupData = {
      dn,
      cn: sAMAccountName,
      sAMAccountName,
      displayName: displayName || sAMAccountName,
      description,
      groupType,
      groupScope,
      groupCategory,
      objectClass: ['top', 'group'],
      objectCategory: `cn=Group,cn=Schema,cn=Configuration,${baseDN}`
    };

    const group = new DomainGroup(groupData);
    await group.save();

    // Audit group creation
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'GROUP_CREATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetGroup: sAMAccountName,
          dn: group.dn,
          groupScope,
          groupCategory
        }
      });
    }

    logger.info(`Group created: ${sAMAccountName}`, { dn: group.dn });

    res.status(201).json({
      success: true,
      data: group,
      message: 'Group created successfully'
    });
  } catch (error) {
    logger.error('Failed to create group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create group'
    });
  }
});

// Update group
router.put('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const updates = req.body;

    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Update group
    Object.assign(group, updates);
    await group.save();

    // Audit group update
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'GROUP_UPDATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetGroup: group.sAMAccountName,
          dn: group.dn,
          changes: Object.keys(updates)
        }
      });
    }

    logger.info(`Group updated: ${group.sAMAccountName}`, { dn: group.dn });

    res.json({
      success: true,
      data: group,
      message: 'Group updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update group'
    });
  }
});

// Delete group
router.delete('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if group is protected
    const protectedGroups = ['Domain Admins', 'Enterprise Admins', 'Domain Users', 'Domain Computers'];
    if (protectedGroups.includes(group.sAMAccountName)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete protected group'
      });
    }

    await DomainGroup.deleteOne({ _id: group._id });

    // Audit group deletion
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'GROUP_DELETED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetGroup: group.sAMAccountName,
          dn: group.dn
        }
      });
    }

    logger.info(`Group deleted: ${group.sAMAccountName}`, { dn: group.dn });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete group'
    });
  }
});

// Add member to group
router.post('/:identifier/members', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { memberDN } = req.body;

    if (!memberDN) {
      return res.status(400).json({
        success: false,
        error: 'memberDN is required'
      });
    }

    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Check if member exists
    const member = await DomainUser.findOne({ dn: memberDN });
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Add member to group
    await group.addMember(memberDN);

    // Audit member addition
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'GROUP_MEMBER_ADDED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetGroup: group.sAMAccountName,
          memberDN,
          memberSAM: member.sAMAccountName
        }
      });
    }

    logger.info(`Added member ${member.sAMAccountName} to group ${group.sAMAccountName}`);

    res.json({
      success: true,
      message: 'Member added to group successfully'
    });
  } catch (error) {
    logger.error('Failed to add member to group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add member to group'
    });
  }
});

// Remove member from group
router.delete('/:identifier/members/:memberDN', async (req, res) => {
  try {
    const { identifier } = req.params;
    const memberDN = decodeURIComponent(req.params.memberDN);

    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    // Get member info for audit
    const member = await DomainUser.findOne({ dn: memberDN });

    // Remove member from group
    await group.removeMember(memberDN);

    // Audit member removal
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'GROUP_MEMBER_REMOVED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetGroup: group.sAMAccountName,
          memberDN,
          memberSAM: member?.sAMAccountName
        }
      });
    }

    logger.info(`Removed member ${member?.sAMAccountName || memberDN} from group ${group.sAMAccountName}`);

    res.json({
      success: true,
      message: 'Member removed from group successfully'
    });
  } catch (error) {
    logger.error('Failed to remove member from group:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove member from group'
    });
  }
});

// Get group members
router.get('/:identifier/members', async (req, res) => {
  try {
    const { identifier } = req.params;

    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    const members = [];
    if (group.member && group.member.length > 0) {
      for (const memberDN of group.member) {
        const user = await DomainUser.findOne({ dn: memberDN });
        if (user) {
          members.push({
            dn: user.dn,
            sAMAccountName: user.sAMAccountName,
            displayName: user.displayName,
            mail: user.mail,
            enabled: !user.isDisabled()
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        groupDN: group.dn,
        groupName: group.sAMAccountName,
        members,
        memberCount: members.length
      }
    });
  } catch (error) {
    logger.error('Failed to get group members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve group members'
    });
  }
});

// Get all members recursively (including nested groups)
router.get('/:identifier/members/recursive', async (req, res) => {
  try {
    const { identifier } = req.params;

    let group = await DomainGroup.findById(identifier);
    if (!group) {
      group = await DomainGroup.findBySAM(identifier);
    }

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    const allMembers = await group.getAllMembers();

    res.json({
      success: true,
      data: {
        groupDN: group.dn,
        groupName: group.sAMAccountName,
        members: allMembers.map(member => ({
          dn: member.dn,
          sAMAccountName: member.sAMAccountName,
          displayName: member.displayName,
          mail: member.mail,
          enabled: !member.isDisabled()
        })),
        memberCount: allMembers.length
      }
    });
  } catch (error) {
    logger.error('Failed to get recursive group members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recursive group members'
    });
  }
});

module.exports = router;
