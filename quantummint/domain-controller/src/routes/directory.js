const express = require('express');
const router = express.Router();
const { directory: logger } = require('../utils/logger');

// Middleware to get directory service from app
const getDirectoryService = (req, res, next) => {
  req.directoryService = req.app.get('directoryService');
  req.securityManager = req.app.get('securityManager');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getDirectoryService);

// Get directory statistics
router.get('/stats', async (req, res) => {
  try {
    const DomainUser = require('../models/DomainUser');
    const DomainGroup = require('../models/DomainGroup');
    const DomainComputer = require('../models/DomainComputer');
    const OrganizationalUnit = require('../models/OrganizationalUnit');

    const [userCount, groupCount, computerCount, ouCount] = await Promise.all([
      DomainUser.countDocuments(),
      DomainGroup.countDocuments(),
      DomainComputer.countDocuments(),
      OrganizationalUnit.countDocuments()
    ]);

    const stats = {
      users: userCount,
      groups: groupCount,
      computers: computerCount,
      organizationalUnits: ouCount,
      total: userCount + groupCount + computerCount + ouCount
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get directory statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve directory statistics'
    });
  }
});

// Search directory objects
router.post('/search', async (req, res) => {
  try {
    const { baseDN, scope = 'sub', filter = '(objectClass=*)', attributes = [] } = req.body;

    if (!baseDN) {
      return res.status(400).json({
        success: false,
        error: 'baseDN is required'
      });
    }

    const results = await req.directoryService.search({
      baseDN,
      scope,
      filter,
      attributes
    });

    res.json({
      success: true,
      data: {
        results,
        count: results.length
      }
    });
  } catch (error) {
    logger.error('Directory search failed:', error);
    res.status(500).json({
      success: false,
      error: 'Search operation failed'
    });
  }
});

// Get object by DN
router.get('/object/:dn', async (req, res) => {
  try {
    const dn = decodeURIComponent(req.params.dn);
    
    const results = await req.directoryService.search({
      baseDN: dn,
      scope: 'base',
      filter: '(objectClass=*)'
    });

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    logger.error('Failed to get object:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve object'
    });
  }
});

// Add new directory object
router.post('/object', async (req, res) => {
  try {
    const { dn, attributes } = req.body;

    if (!dn || !attributes) {
      return res.status(400).json({
        success: false,
        error: 'DN and attributes are required'
      });
    }

    const result = await req.directoryService.addEntry(dn, attributes);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Object created successfully'
    });
  } catch (error) {
    logger.error('Failed to add object:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create object'
    });
  }
});

// Modify directory object
router.put('/object/:dn', async (req, res) => {
  try {
    const dn = decodeURIComponent(req.params.dn);
    const { changes } = req.body;

    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        error: 'Changes array is required'
      });
    }

    const result = await req.directoryService.modifyEntry(dn, changes);

    res.json({
      success: true,
      data: result,
      message: 'Object modified successfully'
    });
  } catch (error) {
    logger.error('Failed to modify object:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to modify object'
    });
  }
});

// Delete directory object
router.delete('/object/:dn', async (req, res) => {
  try {
    const dn = decodeURIComponent(req.params.dn);

    await req.directoryService.deleteEntry(dn);

    res.json({
      success: true,
      message: 'Object deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete object:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete object'
    });
  }
});

// Get directory schema information
router.get('/schema', async (req, res) => {
  try {
    const schema = {
      objectClasses: {
        user: {
          requiredAttributes: ['cn', 'sAMAccountName'],
          optionalAttributes: ['userPrincipalName', 'displayName', 'mail', 'telephoneNumber', 'description'],
          superiorClass: 'organizationalPerson'
        },
        group: {
          requiredAttributes: ['cn', 'sAMAccountName'],
          optionalAttributes: ['description', 'member', 'memberOf'],
          superiorClass: 'top'
        },
        computer: {
          requiredAttributes: ['cn', 'sAMAccountName'],
          optionalAttributes: ['dNSHostName', 'operatingSystem', 'operatingSystemVersion'],
          superiorClass: 'user'
        },
        organizationalUnit: {
          requiredAttributes: ['ou'],
          optionalAttributes: ['description', 'managedBy'],
          superiorClass: 'top'
        }
      },
      attributeTypes: {
        cn: { syntax: 'DirectoryString', singleValued: true },
        sAMAccountName: { syntax: 'DirectoryString', singleValued: true },
        userPrincipalName: { syntax: 'DirectoryString', singleValued: true },
        displayName: { syntax: 'DirectoryString', singleValued: true },
        mail: { syntax: 'IA5String', singleValued: true },
        telephoneNumber: { syntax: 'DirectoryString', singleValued: false },
        description: { syntax: 'DirectoryString', singleValued: true },
        member: { syntax: 'DN', singleValued: false },
        memberOf: { syntax: 'DN', singleValued: false }
      }
    };

    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    logger.error('Failed to get schema:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve schema information'
    });
  }
});

// Validate DN format
router.post('/validate-dn', async (req, res) => {
  try {
    const { dn } = req.body;

    if (!dn) {
      return res.status(400).json({
        success: false,
        error: 'DN is required'
      });
    }

    // Basic DN validation
    const dnRegex = /^([a-zA-Z]+=.+,)*[a-zA-Z]+=.+$/;
    const isValid = dnRegex.test(dn);

    let components = [];
    if (isValid) {
      components = dn.split(',').map(component => {
        const [attribute, value] = component.split('=');
        return { attribute: attribute.trim(), value: value.trim() };
      });
    }

    res.json({
      success: true,
      data: {
        isValid,
        dn,
        components
      }
    });
  } catch (error) {
    logger.error('DN validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'DN validation failed'
    });
  }
});

module.exports = router;
