const express = require('express');
const router = express.Router();
const { policy: logger } = require('../utils/logger');

// Middleware to get services from app
const getServices = (req, res, next) => {
  req.policyManager = req.app.get('policyManager');
  req.securityManager = req.app.get('securityManager');
  req.auditService = req.app.get('auditService');
  next();
};

router.use(getServices);

// Get all policies with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    const type = req.query.type; // 'computer' or 'user'

    const policies = await req.policyManager.getAllPolicies({
      page,
      limit,
      search,
      type
    });

    res.json({
      success: true,
      data: policies
    });
  } catch (error) {
    logger.error('Failed to get policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policies'
    });
  }
});

// Get policy by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await req.policyManager.getPolicy(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.error('Failed to get policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy'
    });
  }
});

// Create new policy
router.post('/', async (req, res) => {
  try {
    const policyData = req.body;

    if (!policyData.name || !policyData.type) {
      return res.status(400).json({
        success: false,
        error: 'Policy name and type are required'
      });
    }

    const policy = await req.policyManager.createPolicy(policyData);

    // Audit policy creation
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICY_CREATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          policyId: policy._id,
          policyName: policy.name,
          policyType: policy.type
        }
      });
    }

    logger.info(`Policy created: ${policy.name}`, { id: policy._id });

    res.status(201).json({
      success: true,
      data: policy,
      message: 'Policy created successfully'
    });
  } catch (error) {
    logger.error('Failed to create policy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create policy'
    });
  }
});

// Update policy
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const policy = await req.policyManager.updatePolicy(id, updates);

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    // Audit policy update
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICY_UPDATED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          policyId: policy._id,
          policyName: policy.name,
          changes: Object.keys(updates)
        }
      });
    }

    logger.info(`Policy updated: ${policy.name}`, { id: policy._id });

    res.json({
      success: true,
      data: policy,
      message: 'Policy updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update policy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update policy'
    });
  }
});

// Delete policy
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const policy = await req.policyManager.getPolicy(id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    await req.policyManager.deletePolicy(id);

    // Audit policy deletion
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICY_DELETED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          policyId: id,
          policyName: policy.name
        }
      });
    }

    logger.info(`Policy deleted: ${policy.name}`, { id });

    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete policy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete policy'
    });
  }
});

// Link policy to organizational unit
router.post('/:id/link', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetDN, linkOrder = 1, enforced = false } = req.body;

    if (!targetDN) {
      return res.status(400).json({
        success: false,
        error: 'targetDN is required'
      });
    }

    await req.policyManager.linkPolicy(id, targetDN, { linkOrder, enforced });

    // Audit policy link
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICY_LINKED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          policyId: id,
          targetDN,
          linkOrder,
          enforced
        }
      });
    }

    logger.info(`Policy linked: ${id} to ${targetDN}`);

    res.json({
      success: true,
      message: 'Policy linked successfully'
    });
  } catch (error) {
    logger.error('Failed to link policy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to link policy'
    });
  }
});

// Unlink policy from organizational unit
router.delete('/:id/link/:targetDN', async (req, res) => {
  try {
    const { id } = req.params;
    const targetDN = decodeURIComponent(req.params.targetDN);

    await req.policyManager.unlinkPolicy(id, targetDN);

    // Audit policy unlink
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICY_UNLINKED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          policyId: id,
          targetDN
        }
      });
    }

    logger.info(`Policy unlinked: ${id} from ${targetDN}`);

    res.json({
      success: true,
      message: 'Policy unlinked successfully'
    });
  } catch (error) {
    logger.error('Failed to unlink policy:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unlink policy'
    });
  }
});

// Get effective policies for a user or computer
router.get('/effective/:targetDN', async (req, res) => {
  try {
    const targetDN = decodeURIComponent(req.params.targetDN);
    const { type } = req.query; // 'user' or 'computer'

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type parameter is required (user or computer)'
      });
    }

    const effectivePolicies = await req.policyManager.getEffectivePolicies(targetDN, type);

    res.json({
      success: true,
      data: {
        targetDN,
        type,
        policies: effectivePolicies
      }
    });
  } catch (error) {
    logger.error('Failed to get effective policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve effective policies'
    });
  }
});

// Apply policies to a user or computer
router.post('/apply/:targetDN', async (req, res) => {
  try {
    const targetDN = decodeURIComponent(req.params.targetDN);
    const { type, force = false } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'type is required (user or computer)'
      });
    }

    const result = await req.policyManager.applyPolicies(targetDN, type, { force });

    // Audit policy application
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICIES_APPLIED',
        user: req.user?.sAMAccountName || 'system',
        details: {
          targetDN,
          type,
          appliedPolicies: result.appliedPolicies?.length || 0,
          force
        }
      });
    }

    logger.info(`Policies applied to ${targetDN}`, { type, count: result.appliedPolicies?.length });

    res.json({
      success: true,
      data: result,
      message: 'Policies applied successfully'
    });
  } catch (error) {
    logger.error('Failed to apply policies:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply policies'
    });
  }
});

// Get policy templates
router.get('/templates/:type', async (req, res) => {
  try {
    const { type } = req.params; // 'user' or 'computer'

    if (!['user', 'computer'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be user or computer'
      });
    }

    const templates = await req.policyManager.getPolicyTemplates(type);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Failed to get policy templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy templates'
    });
  }
});

// Create policy from template
router.post('/from-template', async (req, res) => {
  try {
    const { templateId, name, description, settings = {} } = req.body;

    if (!templateId || !name) {
      return res.status(400).json({
        success: false,
        error: 'templateId and name are required'
      });
    }

    const policy = await req.policyManager.createPolicyFromTemplate(templateId, {
      name,
      description,
      settings
    });

    // Audit policy creation from template
    if (req.auditService) {
      await req.auditService.logEvent({
        type: 'POLICY_CREATED_FROM_TEMPLATE',
        user: req.user?.sAMAccountName || 'system',
        details: {
          policyId: policy._id,
          policyName: policy.name,
          templateId
        }
      });
    }

    logger.info(`Policy created from template: ${policy.name}`, { templateId });

    res.status(201).json({
      success: true,
      data: policy,
      message: 'Policy created from template successfully'
    });
  } catch (error) {
    logger.error('Failed to create policy from template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create policy from template'
    });
  }
});

// Get policy links for an organizational unit
router.get('/links/:ouDN', async (req, res) => {
  try {
    const ouDN = decodeURIComponent(req.params.ouDN);

    const links = await req.policyManager.getPolicyLinks(ouDN);

    res.json({
      success: true,
      data: {
        ouDN,
        links
      }
    });
  } catch (error) {
    logger.error('Failed to get policy links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve policy links'
    });
  }
});

module.exports = router;
